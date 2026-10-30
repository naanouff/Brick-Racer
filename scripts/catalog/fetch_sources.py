#!/usr/bin/env python3
"""
Download Rebrickable parts.csv and LDraw complete.zip into data/.

Rebrickable: https://rebrickable.com/downloads/ (CC BY / their DB terms)
LDraw: https://library.ldraw.org/ (Contributor Agreement — do not redistribute library in git)
"""

from __future__ import annotations

import argparse
import gzip
import shutil
import sys
import urllib.request
import zipfile
from pathlib import Path

REBRICKABLE_PARTS = "https://cdn.rebrickable.com/media/downloads/parts.csv.gz"
REBRICKABLE_CATEGORIES = (
    "https://cdn.rebrickable.com/media/downloads/part_categories.csv.gz"
)
REBRICKABLE_MAPPINGS = (
    "https://cdn.rebrickable.com/media/downloads/part_mappings.csv.gz"
)
LDRAW_COMPLETE = "https://library.ldraw.org/library/updates/complete.zip"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url}")
    print(f"  → {dest}")
    req = urllib.request.Request(url, headers={"User-Agent": "Brick-Racer-catalog-poc/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp, dest.open("wb") as out:
        shutil.copyfileobj(resp, out)
    print(f"  done ({dest.stat().st_size / 1e6:.1f} MB)")


def gunzip(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(src, "rb") as f_in, dest.open("wb") as f_out:
        shutil.copyfileobj(f_in, f_out)
    print(f"Extracted {dest}")


def extract_ldraw(zip_path: Path, dest_root: Path) -> Path:
    """
    complete.zip usually contains a top-level 'ldraw/' folder with parts/ and p/.
    We extract into dest_root and return the library root that contains 'parts'.
    """
    dest_root.mkdir(parents=True, exist_ok=True)
    print(f"Extracting LDraw → {dest_root} (may take a minute)...")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(dest_root)

    # Prefer .../ldraw if present
    candidate = dest_root / "ldraw"
    if (candidate / "parts").is_dir():
        return candidate
    if (dest_root / "parts").is_dir():
        return dest_root
    # Search one level
    for child in dest_root.iterdir():
        if child.is_dir() and (child / "parts").is_dir():
            return child
    raise FileNotFoundError(f"No LDraw parts/ folder found under {dest_root}")


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    data = repo / "data"
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--skip-ldraw", action="store_true", help="Only fetch Rebrickable CSVs")
    ap.add_argument("--skip-rebrickable", action="store_true")
    ap.add_argument("--force", action="store_true", help="Re-download even if present")
    args = ap.parse_args()

    if not args.skip_rebrickable:
        gz = data / "rebrickable" / "parts.csv.gz"
        csv_path = data / "rebrickable" / "parts.csv"
        if args.force or not csv_path.is_file():
            download(REBRICKABLE_PARTS, gz)
            gunzip(gz, csv_path)
        else:
            print(f"Keep existing {csv_path}")

        cat_gz = data / "rebrickable" / "part_categories.csv.gz"
        cat_csv = data / "rebrickable" / "part_categories.csv"
        if args.force or not cat_csv.is_file():
            download(REBRICKABLE_CATEGORIES, cat_gz)
            gunzip(cat_gz, cat_csv)
        else:
            print(f"Keep existing {cat_csv}")

        map_gz = data / "rebrickable" / "part_mappings.csv.gz"
        map_csv = data / "rebrickable" / "part_mappings.csv"
        if args.force or not map_csv.is_file():
            download(REBRICKABLE_MAPPINGS, map_gz)
            gunzip(map_gz, map_csv)
        else:
            print(f"Keep existing {map_csv}")

    if not args.skip_ldraw:
        zip_path = data / "ldraw" / "complete.zip"
        # Marker: parts folder after extract
        extracted_parts = data / "ldraw" / "parts"
        nested_parts = data / "ldraw" / "ldraw" / "parts"
        if args.force or not (extracted_parts.is_dir() or nested_parts.is_dir()):
            if args.force or not zip_path.is_file():
                download(LDRAW_COMPLETE, zip_path)
            root = extract_ldraw(zip_path, data / "ldraw")
            print(f"LDraw library root: {root}")
            # If nested as data/ldraw/ldraw, flatten pointer via note
            marker = data / "ldraw" / "LIBRARY_ROOT.txt"
            marker.write_text(str(root) + "\n", encoding="utf-8")
        else:
            print("Keep existing LDraw extract")

    print("Sources ready.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
