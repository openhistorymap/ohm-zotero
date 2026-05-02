#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

NAME="ohm-zotero"
VERSION="$(python3 -c 'import json,sys; print(json.load(open("manifest.json"))["version"])')"
OUT="${NAME}-${VERSION}.xpi"

rm -f "$OUT"
# -D: skip directory entries (Mozilla's JAR enumerator is fussy about them)
# -X: strip extra fields (uid/gid/timestamps) for reproducible builds
zip -r -D -X "$OUT" \
    manifest.json \
    bootstrap.js \
    prefs.js \
    lib \
    content \
    locale \
    -x '*.DS_Store' '*~' '*.swp'

echo "Built $OUT"
unzip -l "$OUT"
