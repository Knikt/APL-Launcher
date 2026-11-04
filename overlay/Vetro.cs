using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace APL
{
    /// <summary>
    /// Vetro's local API, on the screen itself. The panel has no rights of its own:
    /// picture, Bluetooth and input commands all run through <c>/exec</c>, as in the launcher.
    /// A raw socket rather than HttpClient: it starts much faster on the screen.
    /// </summary>
    internal static class Vetro
    {
        private const int Port = 8099;
        private const string InfraredRemote = "/dev/input/event2";
        private static readonly TimeSpan ConnectTimeout = TimeSpan.FromSeconds(5);
        private static int hostIndex;

        /// <summary>
        /// The addresses tried, in order: loopback, the same in IPv6 form, then the screen's own LAN addresses
        /// (The Frame 2025 blocks both loopback forms for apps; Vetro listens on every interface), as the bridge.
        /// </summary>
        private static List<string> cachedHosts;
        private static DateTime hostsUntil = DateTime.MinValue;
        private static readonly TimeSpan HostsFor = TimeSpan.FromMinutes(1);

        /// <summary>The address list, built at most once a minute (requests come every 100 ms at times), or again after every address failed.</summary>
        private static List<string> Hosts()
        {
            var cached = cachedHosts;
            if (cached != null && DateTime.UtcNow < hostsUntil) return cached;
            cached = BuildHosts();
            cachedHosts = cached;
            hostsUntil = DateTime.UtcNow + HostsFor;
            return cached;
        }

        private static void ForgetHosts() { hostsUntil = DateTime.MinValue; }

        private static List<string> BuildHosts()
        {
            var hosts = new List<string> { "127.0.0.1", "::ffff:127.0.0.1" };
            try
            {
                foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (nic.OperationalStatus != OperationalStatus.Up || nic.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                    foreach (var a in nic.GetIPProperties().UnicastAddresses)
                        if (a.Address.AddressFamily == AddressFamily.InterNetwork && !System.Net.IPAddress.IsLoopback(a.Address))
                            hosts.Add(a.Address.ToString());
                }
            }
            catch (Exception) { }
            return hosts.Distinct().ToList();
        }

        /// <summary>
        /// Connects to Vetro, starting with the address that worked last and trying the others in turn: one that
        /// does not let us connect within 5 s moves on to the next. Only a success is remembered, so requests
        /// failing at the same time cannot push each other off an address that works.
        /// </summary>
        private static async Task<TcpClient> Connect()
        {
            var hosts = Hosts();
            int start = Volatile.Read(ref hostIndex);
            Exception last = null;
            for (int tries = 0; tries < hosts.Count; tries++)
            {
                int index = (start + tries) % hosts.Count;
                string host = hosts[index];
                var client = new TcpClient(host.Contains(':') ? AddressFamily.InterNetworkV6 : AddressFamily.InterNetwork);
                try
                {
                    using (var connect = new CancellationTokenSource(ConnectTimeout))
                        await client.ConnectAsync(host, Port, connect.Token);
                    Volatile.Write(ref hostIndex, index);
                    return client;
                }
                catch (Exception ex)
                {
                    client.Dispose();
                    last = ex is OperationCanceledException ? new TimeoutException(host + ": no answer") : ex;
                }
            }
            ForgetHosts();                     // every address failed: the network may have changed
            throw last ?? new SocketException((int)SocketError.HostUnreachable);
        }

        private static async Task<string> Request(string method, string path, string body)
        {
            using (TcpClient client = await Connect())
            {
                NetworkStream stream = client.GetStream();
                byte[] content = Encoding.UTF8.GetBytes(body ?? "");
                string head = method + " " + path + " HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n" +
                              "Content-Type: application/json\r\nContent-Length: " + content.Length + "\r\n\r\n";
                byte[] headBytes = Encoding.ASCII.GetBytes(head);
                await stream.WriteAsync(headBytes, 0, headBytes.Length);
                if (content.Length > 0) await stream.WriteAsync(content, 0, content.Length);
                byte[] buffer = new byte[16384];
                List<byte> all = new List<byte>();
                int read;
                while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                {
                    for (int i = 0; i < read; i++) all.Add(buffer[i]);
                }
                string text = Encoding.UTF8.GetString(all.ToArray());
                int split = text.IndexOf("\r\n\r\n", StringComparison.Ordinal);
                return split < 0 ? "" : text.Substring(split + 4);
            }
        }

        /// <summary>Runs a shell command as root and returns its output. No backslashes: Vetro doubles them.</summary>
        public static async Task<string> Exec(string command)
        {
            string answer = await Request("POST", "/exec", "{\"cmd\":" + JsonSerializer.Serialize(command) + "}");
            using (JsonDocument doc = JsonDocument.Parse(answer))
            {
                JsonElement output;
                return doc.RootElement.TryGetProperty("output", out output) ? output.GetString() ?? "" : "";
            }
        }

        /// <summary>A key event from the physical remote, as Vetro's input bridge reports it.</summary>
        public struct KeyEvent
        {
            public int Code;        // evdev code
            public bool Down;       // pressed, or still held (Repeat)
            public bool Repeat;     // the receiver's own repeat of a held key
            public bool Blocked;    // kept from the screen by a Vetro rule
            public long Sequence;   // counted from 1 each time the input helper starts
            public DateTime Time;
            public string Foreground;
        }

        /// <summary>The remote's latest events, oldest first.</summary>
        public static async Task<List<KeyEvent>> KeyEvents()
        {
            List<KeyEvent> list = new List<KeyEvent>();
            string answer = await Request("GET", "/input", null);
            using (JsonDocument doc = JsonDocument.Parse(answer))
            {
                JsonElement status, events;
                if (!doc.RootElement.TryGetProperty("status", out status)) return list;
                if (!status.TryGetProperty("events", out events)) return list;
                foreach (JsonElement e in events.EnumerateArray())
                {
                    KeyEvent k = new KeyEvent();
                    k.Code = e.GetProperty("code").GetInt32();
                    string action = e.GetProperty("action").GetString();
                    k.Repeat = action == "repeat";
                    k.Down = action == "down" || k.Repeat;
                    JsonElement decision, sequence;
                    k.Blocked = e.TryGetProperty("decision", out decision) && decision.GetString() == "blocked";
                    k.Sequence = e.TryGetProperty("sequence", out sequence) ? sequence.GetInt64() : 0;
                    long seconds = e.GetProperty("time_seconds").GetInt64();
                    long micros = e.GetProperty("time_microseconds").GetInt64();
                    k.Time = DateTime.UnixEpoch.AddSeconds(seconds).AddTicks(micros * 10);
                    JsonElement fg;
                    k.Foreground = e.TryGetProperty("tv_fullscreen_appid", out fg) ? fg.GetString() ?? "" : "";
                    list.Add(k);
                }
            }
            return list;
        }

        /// <summary>
        /// Gives the screen the release of a key it still believes is down. Posting the same rules stops
        /// the input helper, and Vetro starts it again within 5 s. Until then the remote's device is free:
        /// what is written there reaches the screen, which ignores the press and keeps the release.
        /// </summary>
        public static async Task ReleaseKey(int code)
        {
            string rules = await Request("GET", "/remap", null);
            using (JsonDocument doc = JsonDocument.Parse(rules))
            {
                JsonElement list;
                if (!doc.RootElement.TryGetProperty("rules", out list) || list.GetArrayLength() == 0) return;
            }
            string write = "echo " + Convert.ToBase64String(PressAndRelease(code)) + " | base64 -d > " + await RemoteNode();
            string helper = "$(pgrep -f '[S]amsungTvRemoteInputAgent' | head -1)";
            await Exec("p=" + helper + "; (n=0; while [ -n \"$p\" ] && [ -d /proc/$p ] && [ $n -lt 400 ]; do sleep 0.02; n=$((n+1)); done; " +
                       "[ -n \"$p\" ] && [ -d /proc/$p ] || " + write + ") >/dev/null 2>&1 &");
            await Request("POST", "/remap", rules);
        }

        /// <summary>
        /// The device Vetro intercepts: event2 while the remote works by infrared, one of the
        /// "Smart Control 2016" devices once it is paired over Bluetooth.
        /// </summary>
        private static async Task<string> RemoteNode()
        {
            string answer = await Request("GET", "/input", null);
            using (JsonDocument doc = JsonDocument.Parse(answer))
            {
                JsonElement status, policy, node;
                if (doc.RootElement.TryGetProperty("status", out status) && status.TryGetProperty("policy", out policy) &&
                    policy.TryGetProperty("node", out node) && node.ValueKind == JsonValueKind.String)
                {
                    string path = node.GetString() ?? "";
                    // It goes into a shell command: only a plain input device
                    if (System.Text.RegularExpressions.Regex.IsMatch(path, "^/dev/input/event[0-9]+$")) return path;
                }
            }
            return InfraredRemote;
        }

        private static byte[] PressAndRelease(int code)
        {
            int size = IntPtr.Size == 8 ? 24 : 16, typeAt = IntPtr.Size == 8 ? 16 : 8;
            byte[] events = new byte[size * 4];
            for (int i = 0; i < 2; i++)
            {
                int key = (i * 2) * size + typeAt;      // each key event is followed by an empty one: a sync
                BitConverter.GetBytes((ushort)1).CopyTo(events, key);
                BitConverter.GetBytes((ushort)code).CopyTo(events, key + 2);
                BitConverter.GetBytes(i == 0 ? 1 : 0).CopyTo(events, key + 4);
            }
            return events;
        }
    }
}
