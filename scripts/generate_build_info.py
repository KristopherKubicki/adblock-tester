#!/usr/bin/env python3
"""Generate build info script."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path


def generate_build_info(
    package_path: Path, out_path: Path, *, now: datetime | None = None
) -> str:
    """Write ``build_info.js`` from package data."""
    if now is None:
        now = datetime.utcnow()
    version = json.loads(package_path.read_text())["version"]
    build_date = now.date().isoformat()
    out_path.write_text(
        f'const BUILD_INFO = {{ version: "{version}", buildDate: "{build_date}" }};\n'
    )
    return build_date


if __name__ == "__main__":
    root = Path(__file__).resolve().parent.parent
    generate_build_info(root / "package.json", root / "build_info.js")
