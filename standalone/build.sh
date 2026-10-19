#!/bin/sh
# Rebuild the standalone single-file app: engine bundle + UI parts -> dist/paycure-standalone.html
set -e
cd "$(dirname "$0")/.."
npx esbuild standalone/entry.ts --bundle --format=iife --platform=browser --target=es2020 --minify --define:process.env.NODE_ENV='"production"' --define:process.env.AI_MODEL=undefined --external:canvas --external:path2d-polyfill --alias:@=./src --outfile=standalone/engine.js
python3 - <<'PY'
parts=[open('standalone/'+f).read() for f in ['head.html','body.html']]
js=lambda f: open('standalone/'+f).read().replace('</script','<\\/script')
html=parts[0]+parts[1]+'<script>'+js('engine.js')+'</script>\n<script>'+js('samples.js')+'</script>\n'+''.join('<script>'+js(f)+'</script>\n' for f in ['app1.js','app2.js','app3.js','app4.js','app5.js','app6.js','app7.js','app8.js','app9.js','app10.js','app11.js','app12.js','app13.js','app14.js','app15.js','app16.js','app17.js','app18.js','app19.js','app20.js','app21.js','app22.js','app23.js','app24.js','app25.js','app26.js','app27.js','app28.js','app29.js','app30.js','app31.js','app32.js','app33.js','app34.js','app35.js','app36.js','app37.js','app38.js','app39.js','app40.js','app41.js','app42.js','app43.js','app44.js','app45.js','app46.js'])+'<style id="al-rail-final">'+open('standalone/final.css').read()+'</style>\n</body></html>'
import os; os.makedirs('dist', exist_ok=True); open('dist/paycure-standalone.html','w').write(html)
PY
echo "dist/paycure-standalone.html"
python3 scripts/check-built-scripts.py dist/paycure-standalone.html || exit 1
