#!/usr/bin/env bash
# Builds the launcher package attached to GitHub Releases, for Apps2Samsung:
#
#   apl-launcher-v<version>.wgt   the launcher and its bridge service, version from launcher/config.xml
#   SHA256SUMS-wgt.txt
#
# The package is signed with the Tizen SDK's default certificate. A retail screen only accepts a
# package signed with a certificate that embeds its own DUID, so it does NOT install as is:
# Apps2Samsung re-signs it for the user's screen.
#
# What differs from a build made by APL Launcher Setup:
#   - js/keys.local.js is keys.example.js with empty keys. Apps2Samsung asks for the TMDB,
#     YouTube and Fanart.tv keys and writes them in before re-signing
#     (packaging/apps2samsung/, user_settings). Personal websites stay empty.
#   - no Memoji or custom avatars, no SF Pro fonts, no personal sounds (never published);
#   - no APL Overlay: it is a separate native package that APL Launcher Setup installs.
#
# Used by CI (.github/workflows/setup.yml). Needs the Tizen-Core CLI
# ($TIZEN_SDK/tools/tizen-core/tz, default ~/tizen-sdk) with the certificate generator, rsync,
# zip, unzip, python3.
#
# Usage: tools/make-package.sh [output-dir]   (default: dist)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/dist}"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

SDK="${TIZEN_SDK:-$HOME/tizen-sdk}"
TZ="$SDK/tools/tizen-core/tz"
[ -x "$TZ" ] || { echo "$TZ not found (set TIZEN_SDK)" >&2; exit 1; }
command -v zip >/dev/null || { echo "zip is required" >&2; exit 1; }

VERSION="$(python3 -c 'import re,sys; print(re.search(r"<widget[^>]*\sversion=\"([^\"]+)\"", open(sys.argv[1], encoding="utf-8").read()).group(1))' "$ROOT/launcher/config.xml")"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# version.json and js/build.js must match config.xml (tools/make-build.py).
python3 "$ROOT/tools/check.py"

echo "== Launcher $VERSION"
rsync -a \
    --exclude '*.wgt' --exclude '.manifest.tmp' --exclude 'author-signature.xml' --exclude 'signature1.xml' \
    --exclude '*.local.js' --exclude 'keys.example.js' \
    --exclude 'images/avatars/custom/' --exclude 'images/avatars/memoji/' \
    --exclude 'fonts/*.otf' --exclude 'fonts/*.OTF' --exclude 'fonts/*.ttf' --exclude 'fonts/*.TTF' \
    --exclude 'sounds/*.wav' --exclude '.DS_Store' \
    "$ROOT/launcher/" "$WORK/ui/"

# The keys file Apps2Samsung fills in. Its `tmdb: ""` style lines are the find strings of
# packaging/apps2samsung/*.json: keep them in sync.
cp "$ROOT/launcher/js/keys.example.js" "$WORK/ui/js/keys.local.js"
for k in tmdb youtube fanart; do
    grep -q "^    $k: \"\",\$" "$WORK/ui/js/keys.local.js" \
        || { echo "keys.example.js has no '$k: \"\",' line, update packaging/apps2samsung" >&2; exit 1; }
done

# Runs a CLI command; on failure prints the Tizen CLI logs.
run_cli() {
    if ! "$@"; then
        find "$SDK" "$SDK-data" "$HOME" -path '*tizen*' -name '*.log' 2>/dev/null | while read -r log; do
            echo "--- $log"; tail -n 60 "$log"
        done
        return 1
    fi
}

echo "== Package"
# Without -s, tz pack signs with the SDK's default certificate: every screen needs its own
# signature anyway, and Apps2Samsung replaces this one.
(cd "$WORK/ui" && zip -qr "$WORK/web.wgt" .)
WGT="$WORK/signed.wgt"
run_cli "$TZ" pack -t wgt -b "$WORK/web.wgt" -o "$WGT"
[ -f "$WGT" ] || { echo "tz pack produced no $WGT" >&2; exit 1; }

NAME="apl-launcher-v$VERSION.wgt"
cp "$WGT" "$OUT/$NAME"
# One listing, then a here-string: grep -q on a pipe would kill unzip with SIGPIPE (pipefail).
LIST="$(unzip -l "$OUT/$NAME")"
echo "$LIST" | tail -n 3
for f in config.xml index.html bridge/service.js js/boot.js js/build.js js/keys.local.js css/launcher.css icon.png author-signature.xml signature1.xml; do
    grep -q " $f\$" <<<"$LIST" || { echo "$f is missing from the .wgt" >&2; exit 1; }
done
(cd "$OUT" && sha256sum "$NAME" > SHA256SUMS-wgt.txt)
ls -l "$OUT"
