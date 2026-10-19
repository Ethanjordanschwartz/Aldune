#!/usr/bin/env python3
# Build gate: every inline <script> in the built page must parse. Fails the build on any syntax error.
import re, subprocess, sys, tempfile
path = sys.argv[1] if len(sys.argv) > 1 else 'dist/paycure-standalone.html'
html = open(path, encoding='utf-8').read(); bad = 0
for i, s in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', html, flags=re.S)):
    if len(s) < 50: continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False) as f: f.write(s); name = f.name
    r = subprocess.run(['node', '--check', name], capture_output=True, text=True)
    if r.returncode: bad += 1; print(f'SYNTAX ERROR in script block {i}:\n{r.stderr[:600]}', file=sys.stderr)
if bad: sys.exit(1)
print('build check: all scripts parse')
