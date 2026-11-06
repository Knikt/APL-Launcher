"""
Safe reassign: swap original.json with cleanframe-target.json temporarily,
run native restore (which will set Home to nClrkHome1.FrameHome),
then put the real original.json back.
"""
import shutil, sys, os
from pathlib import Path

root = Path(__file__).resolve().parents[2]
local = root / '.local' / 'native-home'
original = local / 'original.json'
backup  = local / 'original.json.bak'
target  = local / 'cleanframe-target.json'

# Step 1: back up real original
shutil.copy(original, backup)
print('Backed up original.json -> original.json.bak')

try:
    # Step 2: replace original with our CleanFrame target
    shutil.copy(target, original)
    print('Swapped in cleanframe-target.json as original.json')

    # Step 3: run restore via run.py
    import subprocess
    result = subprocess.run(
        [sys.executable, str(root / 'scripts' / 'native-home' / 'run.py'), 'restore'],
        capture_output=True, text=True
    )
    print('--- STDOUT ---')
    print(result.stdout)
    print('--- STDERR ---')
    print(result.stderr)
    print('Return code:', result.returncode)
finally:
    # Step 4: always restore the real original.json
    shutil.copy(backup, original)
    print('Restored real original.json')
