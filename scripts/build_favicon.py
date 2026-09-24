"""Build the original 32px pixel portrait and blink frame; Python stdlib only."""
from pathlib import Path
import struct
import zlib

ASSETS = Path(__file__).resolve().parents[1] / "assets"
# Tight square framing shared by every size and animation frame.
# Preserve the face's proportions, with only a pixel above the tallest curl.
VIEWBOX = (3, 1, 26)
PALETTE = {
    "hair": "242625", "shine": "424745",
    "skin": "dba77e", "light": "edbd94", "shade": "bd805e",
    "white": "fff8e9",
    "mouth": "a46150",
}
# Integer rectangles keep the silhouette crisp at favicon sizes.
RECTS = [
    (8, 9, 16, 13, "skin"), (10, 20, 12, 5, "skin"),
    (7, 14, 2, 5, "shade"), (23, 14, 2, 5, "shade"),
    (10, 9, 11, 12, "light"),
    # Staggered curl clusters, with short highlights instead of straight streaks.
    (8, 5, 16, 6, "hair"), (10, 3, 4, 3, "hair"),
    (15, 2, 4, 4, "hair"), (20, 3, 3, 3, "hair"),
    (7, 6, 3, 5, "hair"), (6, 9, 3, 4, "hair"),
    (23, 6, 3, 5, "hair"), (24, 10, 2, 3, "hair"),
    (8, 11, 2, 5, "hair"), (22, 11, 2, 5, "hair"),
    (10, 10, 3, 2, "hair"), (15, 10, 3, 1, "hair"),
    (20, 10, 2, 2, "hair"),
    (11, 4, 2, 1, "shine"), (10, 5, 1, 2, "shine"),
    (16, 3, 2, 1, "shine"), (18, 4, 1, 2, "shine"),
    (21, 5, 2, 1, "shine"), (20, 6, 1, 2, "shine"),
    (8, 8, 2, 1, "shine"), (7, 9, 1, 2, "shine"),
    (13, 7, 2, 1, "shine"), (12, 8, 1, 2, "shine"),
    (17, 8, 2, 1, "shine"), (19, 9, 1, 1, "shine"),
    (23, 8, 1, 2, "shine"),
    (10, 13, 4, 1, "hair"), (18, 13, 4, 1, "hair"),
    (15, 16, 1, 3, "skin"), (15, 19, 3, 1, "shade"),
    (9, 19, 1, 4, "hair"), (22, 19, 1, 4, "hair"),
    (10, 22, 2, 3, "hair"), (20, 22, 2, 3, "hair"),
    (12, 24, 8, 2, "hair"), (14, 25, 4, 2, "hair"),
    (12, 20, 8, 1, "hair"), (11, 21, 3, 1, "hair"),
    (18, 21, 3, 1, "hair"), (14, 22, 4, 1, "mouth"),
    (15, 23, 2, 1, "hair"),
]


def rectangles(blink=False):
    eyes = [(10, 16, 4, 1, "hair"), (18, 16, 4, 1, "hair")] if blink else [
        (10, 15, 4, 2, "white"), (18, 15, 4, 2, "white"),
        (11, 15, 2, 2, "hair"), (19, 15, 2, 2, "hair"),
    ]
    return RECTS + eyes


def png(path, size, blink=False):
    pixels = [[b"\0\0\0\0"] * 32 for _ in range(32)]
    for x, y, w, h, color in rectangles(blink):
        for row in range(y, y + h):
            for col in range(x, x + w):
                pixels[row][col] = bytes.fromhex(PALETTE[color]) + b"\xff"
    left, top, extent = VIEWBOX
    raw = b"".join(b"\0" + b"".join(pixels[top + y * extent // size][left + x * extent // size]
                                   for x in range(size)) for y in range(size))
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    path.write_bytes(b"\x89PNG\r\n\x1a\n" +
                     chunk(b"IHDR", struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)) +
                     chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    left, top, extent = VIEWBOX
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{left} {top} {extent} {extent}" shape-rendering="crispEdges">\n'
    svg += '  <title>Pixel portrait of Muhammad Rayyan</title>\n'
    for x, y, w, h, color in rectangles():
        svg += f'  <rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#{PALETTE[color]}"/>\n'
    (ASSETS / "favicon.svg").write_text(svg + "</svg>\n", encoding="utf-8")
    png(ASSETS / "favicon-avatar.png", 32)
    png(ASSETS / "favicon-avatar-blink.png", 32, blink=True)
    png(ASSETS / "apple-touch-icon.png", 180)
