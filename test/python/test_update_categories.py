import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))
import types
sys.modules['requests'] = types.ModuleType('requests')
from scripts.update_categories import _parse_lines


def test_parse_lines_basic():
    lines = [
        "0.0.0.0 ads.example.com",
        "127.0.0.1 tracker.example.com",
        "||img.example.com^$third-party",
        "||scripts.example.com/path/file.js",
        "",
        "# comment",
        "! another comment",
    ]
    expected = [
        "https://ads.example.com",
        "https://tracker.example.com",
        "https://img.example.com",
        "https://scripts.example.com",
    ]
    assert _parse_lines(lines) == expected
