#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."
base=${1:-/solid2-pstack/}
output=frontend/dist-pages

sfw pnpm --dir frontend build --mode pages --base "$base" --outDir dist-pages
(cd backend && go run . -export-demo-catalog) > "$output/catalog.json"

mkdir -p "$output/notification-demo"
cp "$output/index.html" "$output/notification-demo/index.html"
cp LICENSE "$output/LICENSE"

# The Solid npm packages list MIT but omit the upstream license file.
{
  printf '\n## Solid and @solidjs/web MIT license\n\n'
  cat frontend/licenses/solid-MIT.txt
} >> "$output/THIRD_PARTY_LICENSES.md"
