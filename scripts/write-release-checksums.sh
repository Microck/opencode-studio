#!/bin/sh
set -eu
cd "$1"
sha256sum -- *.tgz > SHA256SUMS
