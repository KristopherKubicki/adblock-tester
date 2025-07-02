#!/usr/bin/env python3

import json
import re
from pathlib import Path
from typing import Iterable

import requests

# Sources for each category of hosts. These lists are pulled from
# publicly available EasyList projects. The lists contain filters in
# Adblock Plus format; this script extracts just the domain names.
CATEGORY_SOURCES = {
    "Advertising": [
        "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_adservers.txt",
    ],
    "Analytics / Trackers": [
        "https://raw.githubusercontent.com/easylist/easylist/master/easyprivacy/easyprivacy_trackingservers.txt",
    ],
    "Social Widgets": [
        "https://raw.githubusercontent.com/easylist/easylist/master/easylist/easylist_social.txt",
    ],
}

HOST_RE = re.compile(r"^(?:0\.0\.0\.0\s+|127\.0\.0\.1\s+)?")
FILTER_RE = re.compile(r"\^.*$")


def _parse_lines(lines: Iterable[str]) -> list[str]:
    """Parse host rules from a list of lines."""
    hosts: list[str] = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("!"):
            continue
        line = HOST_RE.sub("", line)
        line = line.lstrip("||")
        line = FILTER_RE.sub("", line)
        line = line.split("/")[0]
        if line:
            hosts.append(f"https://{line}")
    return hosts


def update_categories(categories_path: Path) -> None:
    """Download host lists and write ``categories.json``."""

    categories = []
    for name, urls in CATEGORY_SOURCES.items():
        hosts: list[str] = []
        for url in urls:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            hosts.extend(_parse_lines(resp.text.splitlines()))
        categories.append({"name": name, "hosts": sorted(set(hosts))})

    categories_path.write_text(json.dumps(categories, indent=2))


if __name__ == "__main__":
    update_categories(Path(__file__).resolve().parent.parent / "categories.json")
