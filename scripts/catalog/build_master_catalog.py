#!/usr/bin/env python3
"""
Compile Rebrickable parts metadata with LDraw bounding-box dimensions.

Inputs (see fetch_sources.py):
  data/rebrickable/parts.csv
  data/ldraw/  (complete library: parts/, p/)

Output:
  data/out/lego_master_catalog.json
  public/catalog/master-index.json  (has_3d only, slim — for catalog-lab UI)
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import math
import re
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# LDraw units → physical / LEGO grid
LDU_TO_MM = 0.4
LDU_PER_STUD = 20.0
LDU_PER_PLATE = 8.0

Vec3 = Tuple[float, float, float]
# Homogeneous 4x4 row-major: maps local point to parent space
Mat4 = Tuple[float, ...]


def mat_from_ldraw_line(parts: Sequence[str]) -> Mat4:
    """
    Type-1 line: 1 colour x y z a b c d e f g h i file

    Point transform (verified against official 3001.dat / box3u2p):
      x' = a*x + b*y + c*z + X
      y' = d*x + e*y + f*z + Y
      z' = g*x + h*y + i*z + Z

    Stored row-major as 4x4.
    """
    x, y, z = float(parts[2]), float(parts[3]), float(parts[4])
    a, b, c = float(parts[5]), float(parts[6]), float(parts[7])
    d, e, f = float(parts[8]), float(parts[9]), float(parts[10])
    g, h, i = float(parts[11]), float(parts[12]), float(parts[13])
    return (
        a, b, c, x,
        d, e, f, y,
        g, h, i, z,
        0.0, 0.0, 0.0, 1.0,
    )


def mat_transform(m: Mat4, v: Vec3) -> Vec3:
    x, y, z = v
    return (
        m[0] * x + m[1] * y + m[2] * z + m[3],
        m[4] * x + m[5] * y + m[6] * z + m[7],
        m[8] * x + m[9] * y + m[10] * z + m[11],
    )


class LDrawParser:
    """Extract geometry from LDraw .dat files and compute AABB dimensions."""

    def __init__(self, ldraw_root: Path):
        self.root = ldraw_root
        self.search_dirs = [
            ldraw_root / "parts",
            ldraw_root / "parts" / "s",
            ldraw_root / "p",
            ldraw_root / "p" / "48",
            ldraw_root / "p" / "8",
        ]
        # lowercase basename → path (built once)
        self._index: Dict[str, Path] = {}
        self._build_index()
        # lowercase basename → local-space vertices (subfile transforms baked in)
        self._cache: Dict[str, List[Vec3]] = {}
        self._in_progress: set[str] = set()

    def _build_index(self) -> None:
        for directory in self.search_dirs:
            if not directory.is_dir():
                continue
            for entry in directory.iterdir():
                if entry.is_file() and entry.suffix.lower() == ".dat":
                    self._index.setdefault(entry.name.lower(), entry)
        logger.info("LDraw index: %s .dat files", len(self._index))

    def resolve(self, filename: str) -> Optional[Path]:
        name = filename.replace("\\", "/").split("/")[-1].lower()
        return self._index.get(name)

    def get_part_dimensions(self, part_filename: str) -> Optional[Dict[str, float]]:
        if not part_filename.lower().endswith(".dat"):
            part_filename = f"{part_filename}.dat"

        vertices = self._local_vertices(part_filename, depth=0)
        if not vertices:
            return None

        xs = [v[0] for v in vertices]
        ys = [v[1] for v in vertices]
        zs = [v[2] for v in vertices]

        width_ldu = max(xs) - min(xs)
        height_ldu = max(ys) - min(ys)
        depth_ldu = max(zs) - min(zs)

        return {
            "width_mm": round(width_ldu * LDU_TO_MM, 2),
            "height_mm": round(height_ldu * LDU_TO_MM, 2),
            "depth_mm": round(depth_ldu * LDU_TO_MM, 2),
            "width_studs": round(width_ldu / LDU_PER_STUD, 2),
            "height_plates": round(height_ldu / LDU_PER_PLATE, 2),
            "depth_studs": round(depth_ldu / LDU_PER_STUD, 2),
        }

    def _local_vertices(self, filename: str, depth: int) -> List[Vec3]:
        if depth > 12:
            return []

        key = filename.replace("\\", "/").split("/")[-1].lower()
        if key in self._cache:
            return self._cache[key]
        if key in self._in_progress:
            return []  # break cycles

        path = self.resolve(filename)
        if path is None:
            self._cache[key] = []
            return []

        self._in_progress.add(key)
        vertices: List[Vec3] = []
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            logger.warning("Cannot read %s: %s", path, exc)
            self._in_progress.discard(key)
            self._cache[key] = []
            return []

        for line in text.splitlines():
            parts = line.strip().split()
            if not parts:
                continue
            line_type = parts[0]
            if line_type == "1" and len(parts) >= 15:
                m = mat_from_ldraw_line(parts)
                for v in self._local_vertices(parts[-1], depth + 1):
                    vertices.append(mat_transform(m, v))
            # Type 5 = optional lines (control points often outside the mesh) — skip for AABB
            elif line_type in ("2", "3", "4"):
                try:
                    coords = [float(c) for c in parts[2:]]
                except ValueError:
                    continue
                for i in range(0, len(coords) - 2, 3):
                    vertices.append((coords[i], coords[i + 1], coords[i + 2]))

        self._in_progress.discard(key)
        self._cache[key] = vertices
        return vertices


# Rebrickable print / pattern suffixes → fall back to base mold for geometry
_PRINT_SUFFIX = re.compile(
    r"(pr\d+|pat\d+|p[a-z]?\d{2,}|c\d{2}(pr\d+)?)$",
    re.IGNORECASE,
)


def load_ldraw_id_map(mappings_csv: Path) -> Dict[str, List[str]]:
    """part_num → ordered unique LDraw ext_ids from Rebrickable part_mappings (LD)."""
    out: Dict[str, List[str]] = {}
    if not mappings_csv.is_file():
        logger.warning("No part_mappings.csv at %s — exact part_num matching only", mappings_csv)
        return out
    with mappings_csv.open("r", encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if (row.get("ext_system") or "").upper() != "LD":
                continue
            part_num = (row.get("part_num") or "").strip()
            ext_id = (row.get("ext_id") or "").strip()
            if not part_num or not ext_id:
                continue
            bucket = out.setdefault(part_num, [])
            if ext_id not in bucket:
                bucket.append(ext_id)
    logger.info("LDraw id map: %s Rebrickable parts", len(out))
    return out


def ldraw_candidates(part_num: str, ld_map: Dict[str, List[str]]) -> List[str]:
    """Ordered .dat basenames to try for a Rebrickable part_num."""
    seen: set[str] = set()
    ordered: List[str] = []

    def add(name: str) -> None:
        key = name.lower()
        if not key.endswith(".dat"):
            key = f"{key}.dat"
        base = key[:-4]  # strip .dat for storage as filename
        fname = f"{base}.dat"
        if fname not in seen:
            seen.add(fname)
            ordered.append(fname)

    for ext in ld_map.get(part_num, []):
        add(ext)
    add(part_num)

    # Strip print/pattern suffixes: 3001pr0001 → 3001, 18835p02 already tried via map
    stripped = part_num
    for _ in range(3):
        next_s = _PRINT_SUFFIX.sub("", stripped)
        if next_s == stripped or not next_s:
            break
        stripped = next_s
        add(stripped)
        for ext in ld_map.get(stripped, []):
            add(ext)

    return ordered


def resolve_dimensions(
    parser: LDrawParser,
    part_num: str,
    ld_map: Dict[str, List[str]],
    dim_cache: Dict[str, Optional[Dict[str, float]]],
) -> tuple[Optional[Dict[str, float]], Optional[str]]:
    for fname in ldraw_candidates(part_num, ld_map):
        if fname in dim_cache:
            dims = dim_cache[fname]
        else:
            dims = parser.get_part_dimensions(fname)
            dim_cache[fname] = dims
        if dims is not None:
            return dims, fname[:-4] if fname.lower().endswith(".dat") else fname
    return None, None


def footprint_from_master_dims(dimensions: Dict[str, float]) -> List[int]:
    """
    Propose BC1 footprint [sx, py, sz] from LDraw AABB studs/plates.
    BC1 puts the long side on Z (Brick 2 x 4 = [2, 3, 4]) while LDraw puts it on X,
    so LDraw Z → sx and LDraw X → sz.
    Height strips ~0.5 plate stud protrusion (body-only heuristic).
    Half-up rounding (not banker's) to match Math.round in masterFootprint.ts.
    """

    def half_up(v: float) -> int:
        return int(math.floor(v + 0.5))

    sx = max(1, half_up(float(dimensions.get("depth_studs", 1))))
    sz = max(1, half_up(float(dimensions.get("width_studs", 1))))
    raw_h = float(dimensions.get("height_plates", 1))
    py = max(1, half_up(raw_h - 0.5))
    return [sx, py, sz]


def write_master_index(catalog_parts: List[dict], index_path: Path) -> int:
    """Slim navigable index for catalog-lab (has_3d only)."""
    entries: List[dict] = []
    for p in catalog_parts:
        if not p.get("has_3d_model") or not p.get("dimensions"):
            continue
        dims = p["dimensions"]
        entries.append(
            {
                "id": p["design_id"],
                "name": p.get("name", ""),
                "category_id": str(p.get("category_id", "")),
                "ldraw_id": p.get("ldraw_id"),
                "footprint": footprint_from_master_dims(dims),
                "dims_mm": {
                    "w": dims.get("width_mm"),
                    "h": dims.get("height_mm"),
                    "d": dims.get("depth_mm"),
                },
            }
        )
    index_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 1,
        "count": len(entries),
        "parts": entries,
    }
    index_path.write_text(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info("Wrote index %s (%s parts with 3d)", index_path, len(entries))
    return len(entries)


def build_master_catalog(
    rebrickable_csv: Path,
    ldraw_root: Path,
    output_json: Path,
    *,
    limit: Optional[int] = None,
    only_part_nums: Optional[Iterable[str]] = None,
    mappings_csv: Optional[Path] = None,
) -> Dict[str, int]:
    logger.info("LDraw root: %s", ldraw_root)
    parser = LDrawParser(ldraw_root)
    catalog: List[dict] = []
    only = set(only_part_nums) if only_part_nums else None
    maps_path = mappings_csv or (rebrickable_csv.parent / "part_mappings.csv")
    ld_map = load_ldraw_id_map(maps_path)
    dim_cache: Dict[str, Optional[Dict[str, float]]] = {}

    if not rebrickable_csv.is_file():
        raise FileNotFoundError(f"Missing Rebrickable CSV: {rebrickable_csv}")

    with rebrickable_csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            part_num = (row.get("part_num") or "").strip()
            if not part_num:
                continue
            if only is not None and part_num not in only:
                continue

            dimensions, ldraw_id = resolve_dimensions(parser, part_num, ld_map, dim_cache)
            catalog.append(
                {
                    "design_id": part_num,
                    "name": row.get("name", ""),
                    "category_id": row.get("part_cat_id", ""),
                    "material": row.get("part_material", ""),
                    "ldraw_id": ldraw_id,
                    "has_3d_model": dimensions is not None,
                    "dimensions": dimensions,
                }
            )

            if len(catalog) % 1000 == 0:
                logger.info("%s parts processed...", len(catalog))
            if limit is not None and len(catalog) >= limit:
                break

    matched = sum(1 for p in catalog if p["has_3d_model"])
    stats = {
        "total": len(catalog),
        "with_3d": matched,
        "without_3d": len(catalog) - matched,
        "ldraw_mapped": sum(1 for p in catalog if p.get("ldraw_id")),
    }

    output_json.parent.mkdir(parents=True, exist_ok=True)
    payload = {"version": 1, "stats": stats, "parts": catalog}
    output_json.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.info(
        "Wrote %s (%s/%s with LDraw dims, %.1f%%)",
        output_json,
        matched,
        len(catalog),
        (100.0 * matched / len(catalog)) if catalog else 0.0,
    )
    return stats


def export_index_from_master(master_json: Path, index_path: Path) -> int:
    """Rebuild public index from an existing master catalog (no LDraw re-parse)."""
    payload = json.loads(master_json.read_text(encoding="utf-8"))
    parts = payload.get("parts") or []
    return write_master_index(parts, index_path)


# Fountain BOM — design ids aligned with Rebrickable (see brick-manual-prompt.md)
FOUNTAIN_BOM_PARTS = (
    "74611",  # Plate Round 8 x 8 (doc listed #3128 historically)
    "85080",  # macaroni 2x2 corner
    "3941",  # Brick Round 2 x 2
    "3960",  # Dish 4 x 4 Inverted
    "3062b",  # Brick Round 1 x 1
    "4740",  # Dish 2 x 2 Inverted
    "6141",  # Plate Round 1 x 1
    "4589",  # Cone 1 x 1 (doc: 4589b)
)


def resolve_ldraw_root(path: Path) -> Path:
    """Accept data/ldraw or nested data/ldraw/ldraw from complete.zip."""
    if (path / "parts").is_dir():
        return path
    nested = path / "ldraw"
    if (nested / "parts").is_dir():
        return nested
    marker = path / "LIBRARY_ROOT.txt"
    if marker.is_file():
        pointed = Path(marker.read_text(encoding="utf-8").strip())
        if (pointed / "parts").is_dir():
            return pointed
    raise FileNotFoundError(
        f"No LDraw parts/ under {path}. Run: python scripts/catalog/fetch_sources.py"
    )


def main() -> None:
    repo = Path(__file__).resolve().parents[2]
    default_csv = repo / "data" / "rebrickable" / "parts.csv"
    default_ldraw = repo / "data" / "ldraw"
    default_out = repo / "data" / "out" / "lego_master_catalog.json"
    default_index = repo / "public" / "catalog" / "master-index.json"

    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--parts-csv", type=Path, default=default_csv)
    ap.add_argument("--ldraw-root", type=Path, default=default_ldraw)
    ap.add_argument("--output", type=Path, default=default_out)
    ap.add_argument("--index", type=Path, default=default_index)
    ap.add_argument(
        "--index-only",
        action="store_true",
        help="Only rebuild public index from --output master JSON",
    )
    ap.add_argument("--limit", type=int, default=None, help="Max parts to process")
    ap.add_argument(
        "--fountain-bom",
        action="store_true",
        help="Only process fountain BOM design ids (smoke test)",
    )
    ap.add_argument(
        "--part",
        action="append",
        dest="parts",
        help="Only this part_num (repeatable)",
    )
    ap.add_argument("--skip-index", action="store_true")
    args = ap.parse_args()

    if args.index_only:
        if not args.output.is_file():
            raise FileNotFoundError(f"Missing master catalog: {args.output}")
        export_index_from_master(args.output, args.index)
        return

    only: Optional[List[str]] = None
    if args.fountain_bom or args.parts:
        only = []
        if args.fountain_bom:
            only.extend(FOUNTAIN_BOM_PARTS)
        if args.parts:
            only.extend(args.parts)

    ldraw_root = resolve_ldraw_root(args.ldraw_root)
    build_master_catalog(
        args.parts_csv,
        ldraw_root,
        args.output,
        limit=args.limit,
        only_part_nums=only,
    )
    if not args.skip_index and args.output.is_file():
        export_index_from_master(args.output, args.index)


if __name__ == "__main__":
    main()
