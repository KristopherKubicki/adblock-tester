import importlib
import json
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

# reload module after inserting our stub
uc = importlib.import_module("scripts.update_categories")


def test_parse_lines_basic():
    lines = [
        "||example.com^",
        "||ads.example.net^$third-party",
        "127.0.0.1 tracker.example.org",
        "0.0.0.0 ads.example.org",
        "! comment",
        "",
    ]
    expected = [
        "https://example.com",
        "https://ads.example.net",
        "https://tracker.example.org",
        "https://ads.example.org",
    ]
    assert uc._parse_lines(lines) == expected


class DummyResp:
    def __init__(self, text, status=200):
        self.text = text
        self.status_code = status

    def raise_for_status(self):
        if self.status_code >= 400:
            raise uc.requests.RequestException("error")


def test_update_categories(tmp_path, monkeypatch):
    content = "||bad.com^\ntracker.net"

    def fake_get(url, timeout=30):
        return DummyResp(content)

    monkeypatch.setattr(uc, "CATEGORY_SOURCES", {"Demo": ["http://example.com"]})
    monkeypatch.setattr(uc.requests, "get", fake_get)

    out = tmp_path / "categories.json"
    uc.update_categories(out)
    data = json.loads(out.read_text())
    assert data == [
        {"name": "Demo", "hosts": ["https://bad.com", "https://tracker.net"]}
    ]


def test_update_categories_ignore_failures(tmp_path, monkeypatch):
    def fail_get(url, timeout=30):
        raise uc.requests.RequestException("boom")

    monkeypatch.setattr(uc, "CATEGORY_SOURCES", {"Demo": ["http://example.com"]})
    monkeypatch.setattr(uc.requests, "get", fail_get)

    out = tmp_path / "out.json"
    uc.update_categories(out, max_retries=2, ignore_failures=True)
    assert json.loads(out.read_text()) == [{"name": "Demo", "hosts": []}]


def test_parse_lines_strip_paths():
    lines = ["||example.com/ad.js^", "||example.com/foo/bar", "example.net/path"]
    assert uc._parse_lines(lines) == [
        "https://example.com",
        "https://example.com",
        "https://example.net",
    ]
