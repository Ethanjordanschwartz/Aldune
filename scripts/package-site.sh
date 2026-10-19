#!/bin/sh
# Builds dist/site: the standalone app + the Penny server function, ready for Vercel.
set -e; cd "$(dirname "$0")/.."
mkdir -p dist/site/api && cp dist/paycure-standalone.html dist/site/index.html && cp deploy/vercel/api/penny.js dist/site/api/penny.js && cp deploy/vercel/api/law-feed.js dist/site/api/law-feed.js
echo "dist/site ready (index.html + api/penny.js)"
