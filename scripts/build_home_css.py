"""Bundle the homepage stylesheets into assets/home.css (one render-blocking request).

Also rewrites the ?v= on the home.css link in index.html to a hash of the bundle,
so browsers refetch it whenever it changes. The pre-commit hook in .githooks runs
this automatically whenever one of the source files is staged.
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PARTS = ["portfolio", "cohesion", "liquid-metal-button", "eye-button", "navbar"]

out = "".join(
    f"/* {name}.css */\n{(ASSETS / f'{name}.css').read_text(encoding='utf-8').rstrip()}\n" for name in PARTS
)
(ASSETS / "home.css").write_text(out, encoding="utf-8", newline="\n")

version = hashlib.sha1(out.encode()).hexdigest()[:8]
index = ROOT / "index.html"
html = index.read_text(encoding="utf-8")
updated = re.sub(r"assets/home\.css\?v=[\w]+", f"assets/home.css?v={version}", html)
if updated != html:
    index.write_text(updated, encoding="utf-8", newline="")
print(f"home.css: {len(out.encode()) / 1024:.1f} KB, v={version}")
