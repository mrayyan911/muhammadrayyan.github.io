"""Tell IndexNow engines (Bing, Yandex, Naver) about every URL in sitemap.xml; Python stdlib only.

Run after deploying: python scripts/indexnow.py
The key file must already be live at https://www.rayyandev.tech/<key>.txt.
"""
from pathlib import Path
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
HOST = "www.rayyandev.tech"
KEY = next(p.stem for p in ROOT.glob("*.txt") if re.fullmatch(r"[0-9a-f]{32}", p.stem))
URLS = re.findall(r"<loc>([^<]+)</loc>", (ROOT / "sitemap.xml").read_text(encoding="utf-8"))

body = json.dumps({
    "host": HOST,
    "key": KEY,
    "keyLocation": f"https://{HOST}/{KEY}.txt",
    "urlList": URLS,
}).encode()
request = urllib.request.Request(
    "https://api.indexnow.org/indexnow",
    body,
    {"Content-Type": "application/json; charset=utf-8"},
)
with urllib.request.urlopen(request, timeout=20) as response:
    print(response.status, f"submitted {len(URLS)} URLs")
