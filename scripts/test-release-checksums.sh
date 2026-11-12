#!/bin/sh
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf 'synthetic package\n' > "$tmp/package.tgz"
sh "$root/scripts/write-release-checksums.sh" "$tmp"
(cd "$tmp" && sha256sum -c SHA256SUMS)
