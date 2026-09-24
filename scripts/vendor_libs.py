"""Download the pinned browser libraries used by the arcade into assets/vendor/.

Uses only the standard library. Run from the repository root:

    python scripts/vendor_libs.py

To upgrade, change a version below, run the script, and update the import map
paths in the arcade pages and the worker import in engine.worker.js.
"""

import io
import shutil
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "assets" / "vendor"

THREE = "0.186.0"
CHESS = "1.4.0"

# (package, version, {path inside the package tarball: path inside the vendor folder})
PACKAGES = [
    (
        "three",
        THREE,
        {
            "examples/jsm/controls/OrbitControls.js": "addons/controls/OrbitControls.js",
            "examples/jsm/geometries/RoundedBoxGeometry.js": "addons/geometries/RoundedBoxGeometry.js",
            "examples/jsm/environments/RoomEnvironment.js": "addons/environments/RoomEnvironment.js",
            "examples/jsm/utils/BufferGeometryUtils.js": "addons/utils/BufferGeometryUtils.js",
            "LICENSE": "LICENSE",
        },
    ),
    (
        "chess.js",
        CHESS,
        {
            "dist/esm/chess.js": "chess.js",
            "LICENSE": "LICENSE",
        },
    ),
]


# The npm package has no minified builds, so these come from jsDelivr's
# minified copy of the same version.
MINIFIED = {
    "three.module.min.js": f"https://cdn.jsdelivr.net/npm/three@{THREE}/build/three.module.min.js",
    "three.core.min.js": f"https://cdn.jsdelivr.net/npm/three@{THREE}/build/three.core.min.js",
}


def fetch(package: str, version: str) -> tarfile.TarFile:
    name = package.split("/")[-1]
    url = f"https://registry.npmjs.org/{package}/-/{name}-{version}.tgz"
    print(f"Downloading {url}")
    with urllib.request.urlopen(url) as response:
        return tarfile.open(fileobj=io.BytesIO(response.read()), mode="r:gz")


def main() -> None:
    for package, version, files in PACKAGES:
        target = VENDOR / f"{package}@{version}"
        if target.exists():
            shutil.rmtree(target)
        archive = fetch(package, version)
        for source, dest in files.items():
            member = archive.extractfile(f"package/{source}")
            if member is None:
                raise SystemExit(f"Missing {source} in {package}@{version}")
            # Addons import 'three' by bare name; each page's import map resolves it.
            data = member.read()
            path = target / dest
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            print(f"  {path.relative_to(ROOT)} ({len(data) // 1024} KB)")
        if package == "three":
            for dest, url in MINIFIED.items():
                print(f"Downloading {url}")
                with urllib.request.urlopen(url) as response:
                    text = response.read().decode("utf-8")
                text = text.replace('"./three.core.js"', '"./three.core.min.js"')
                (target / dest).write_bytes(text.encode("utf-8"))
                print(f"  {dest} ({len(text) // 1024} KB)")


if __name__ == "__main__":
    main()
