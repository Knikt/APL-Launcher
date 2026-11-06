"""Connect, inspect, install or launch CleanFrame. These commands preserve Home/startup settings.

When Developer Mode's Host PC IP is 127.0.0.1 (needed by Vetro and TizenBrew), the PC
cannot use sdb at all. The TV can still be reached through Vetro's own HTTP interface on
port 8099, which the bundled service runs as root: the package is copied to the screen in
base64 chunks, checked against the local SHA-256, installed with the screen's own
`pkgcmd`, then confirmed in the package list. Nothing about developer mode is changed.
"""
import argparse
import base64
import hashlib
import ipaddress
import json
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as XML

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['info', 'install', 'launch'])
parser.add_argument('--host')
parser.add_argument('--widget', default='dist/CleanFrame.wgt',
                    help='package to install, for a build made for another set')
parser.add_argument('--app', help='application id to install or launch, for a build with its own identity')
parser.add_argument('--via', choices=['auto', 'sdb', 'vetro'], default='auto',
                    help='how to reach the TV; auto uses sdb and falls back to Vetro')
args = parser.parse_args()
config_file = ROOT / '.local/device.json'
config = json.loads(config_file.read_text()) if config_file.exists() else {}
host = args.host or config.get('host')
if not host:
    raise SystemExit('Add the TV address to .local/device.json or pass --host.')
ipaddress.ip_address(host)
manifest = XML.parse(ROOT / 'app/config.xml').getroot()
app_id = args.app or manifest.find('{http://tizen.org/ns/widgets}application').get('id')
package_id = app_id.split('.')[0]

sdb_candidates = [ROOT / '.local/tizen-sdk/tools/sdb', ROOT / '.local/tizen-sdk/tools/sdb.exe', Path(r'C:\tizen-studio\tools\sdb.exe')]
sdb = next((c for c in sdb_candidates if c.exists()), None)


def run(*command, quiet=False):
    if not sdb:
        raise SystemExit('Local SDB tool missing. See docs/development.md.')
    result = subprocess.run([str(sdb), *command], text=True, capture_output=True, timeout=45)
    output = result.stdout + result.stderr
    if not quiet:
        print(output, end='' if output.endswith('\n') else '\n', flush=True)
    if result.returncode:
        raise SystemExit('SDB command failed.')
    return output


def connect_sdb():
    """Return True when developer mode lets this PC in; sdb is unusable with Host PC IP 127.0.0.1."""
    if not sdb or args.via == 'vetro':
        return False
    serial = host + ':26101'
    try:
        connected = run('connect', serial, quiet=True)
    except SystemExit:
        return False
    if 'connected to ' in connected.lower() or 'already connected' in connected.lower():
        return True
    print('Developer mode refused this PC (Host PC IP is probably 127.0.0.1). Using Vetro instead.', flush=True)
    return False


def vetro(path, body=None, timeout=60):
    url = 'http://' + host + ':8099' + path
    data = None if body is None else json.dumps(body).encode('utf-8')
    request = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode('utf-8') or '{}')


def vetro_ready():
    try:
        status = vetro('/status', timeout=10)
    except (urllib.error.URLError, OSError, ValueError) as error:
        print('Vetro did not answer: ' + str(error), flush=True)
        return False
    agent = (status.get('agent') or {})
    if not agent.get('connected'):
        print('Vetro answered but its root agent is not connected. Open Vetro once on the TV, wait a minute, then retry.', flush=True)
        return False
    return True


def vetro_exec(command, timeout=90):
    answer = vetro('/exec', {'cmd': command}, timeout=timeout)
    if not answer.get('ok'):
        raise SystemExit('The TV refused a command: ' + str(answer.get('stderr') or answer.get('error')))
    return str(answer.get('output') or '')


def vetro_installed():
    listing = vetro_exec('pkgcmd -l 2>/dev/null')
    return package_id in listing


def install_via_vetro(widget):
    remote = '/tmp/cleanframe.wgt'
    payload = base64.b64encode(widget.read_bytes()).decode('ascii')
    vetro_exec(': > ' + remote + '.b64')
    chunk = 48000
    print('Sending ' + widget.name + ' to the TV (' + str(len(payload) // 1024) + ' KiB encoded)', flush=True)
    for offset in range(0, len(payload), chunk):
        part = payload[offset:offset + chunk]
        vetro_exec("printf '%s' '" + part + "' >> " + remote + '.b64')
        done = 100 * min(offset + chunk, len(payload)) // len(payload)
        print('\r  ' + str(done) + '%', end='', flush=True)
    print('', flush=True)
    digest = hashlib.sha256(widget.read_bytes()).hexdigest()
    arrived = vetro_exec('base64 -d ' + remote + '.b64 > ' + remote + ' && rm -f ' + remote + '.b64'
                         ' && chmod 644 ' + remote + ' && sha256sum ' + remote)
    if digest not in arrived:
        raise SystemExit('The package arrived damaged (hash mismatch). Try the installation again.')
    print('Package copied and verified.', flush=True)
    answer = vetro_exec('pkgcmd -i -t wgt -p ' + remote + ' 2>&1; echo exit=$?', timeout=300)
    print(answer.strip(), flush=True)
    found = vetro_installed()
    if not found:
        print('pkgcmd did not report the app; asking Vetro to install it.', flush=True)
        try:
            print(str(vetro('/install', {'path': remote}, timeout=300)), flush=True)
        except (urllib.error.URLError, OSError, ValueError) as error:
            print('Vetro install: ' + str(error), flush=True)
        for _ in range(5):
            if found:
                break
            time.sleep(4)
            found = vetro_installed()
    vetro_exec('rm -f ' + remote)
    if not found:
        raise SystemExit('The TV did not install the package (' + package_id + ' is not in its package list).')
    print('CleanFrame installation confirmed through Vetro. Startup defaults are unchanged.')


def launch_via_vetro():
    vetro('/apps/launch', {'appId': app_id}, timeout=40)
    print('Launch requested for ' + app_id + '.')


if connect_sdb():
    serial = host + ':26101'
    if args.action == 'info':
        run('-s', serial, 'capability')
    elif args.action == 'launch':
        output = run('-s', serial, 'shell', '0', 'execute', app_id)
        if 'successfully launched' not in output:
            raise SystemExit('App launch was not confirmed. Check the TV.')
    else:
        widget = ROOT / args.widget
        if not widget.exists():
            raise SystemExit('Run npm run package first.')
        digest = hashlib.sha256(widget.read_bytes()).hexdigest()[:12]
        remote = '/home/owner/share/tmp/sdk_tools/CleanFrame-' + digest + '-' + str(time.time_ns()) + '.wgt'
        pushed = run('-s', serial, 'push', str(widget), remote)
        if '1 file(s) pushed' not in pushed or 'failed' in pushed.lower():
            raise SystemExit('Widget transfer was not confirmed.')
        output = run('-s', serial, 'shell', '0', 'vd_appinstall', app_id, remote)
        if 'install completed' not in output or 'install failed' in output:
            raise SystemExit('TV installation failed or was not confirmed.')
        installed = run('-s', serial, 'shell', '0', 'applist', quiet=True)
        if app_id not in installed:
            raise SystemExit('App was not found in the installed-app list.')
        print('CleanFrame installation confirmed. Startup defaults are unchanged.')
else:
    if not vetro_ready():
        raise SystemExit('The TV could not be reached over developer mode or Vetro.')
    if args.action == 'info':
        print(vetro_exec('sdb devices 2>&1 || true').strip() or 'Vetro reachable, root agent connected.')
    elif args.action == 'launch':
        launch_via_vetro()
    else:
        widget = ROOT / args.widget
        if not widget.exists():
            raise SystemExit('Run npm run package first.')
        install_via_vetro(widget)
