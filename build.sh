#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

NAME="ohm-zotero"
VERSION="$(python3 -c 'import json,sys; print(json.load(open("manifest.json"))["version"])')"
OUT="${NAME}-${VERSION}.xpi"

rm -f "$OUT"
zip -r -X "$OUT" \
    manifest.json \
    bootstrap.js \
    prefs.js \
    lib \
    content \
    locale \
    -x '*.DS_Store' '*~' '*.swp'

echo "Built $OUT"
