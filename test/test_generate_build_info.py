import json
import sys
from datetime import datetime
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

import scripts.generate_build_info as gbi


def test_generate_build_info(tmp_path):
    pkg = tmp_path / "package.json"
    pkg.write_text(json.dumps({"version": "2.3.4"}))
    out = tmp_path / "build_info.js"
    fake_now = datetime(2024, 1, 2, 3, 4)
    gbi.generate_build_info(pkg, out, now=fake_now)
    expected = 'const BUILD_INFO = { version: "2.3.4", buildDate: "2024-01-02" };\n'
    assert out.read_text() == expected
