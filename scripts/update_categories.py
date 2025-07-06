#!/usr/bin/env python3

import argparse
import json
import logging
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import requests
from requests import RequestException

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
        "https://raw.githubusercontent.com/easylist/easylist/master/fanboy-addon/fanboy_social_general_block.txt",
    ],
}

HOST_RE = re.compile(r"^(?:0\.0\.0\.0\s+|127\.0\.0\.1\s+)?")
FILTER_RE = re.compile(r"\^.*$")
HOSTNAME_RE = re.compile(r"^[A-Za-z0-9.-]+$")


def _is_valid_host(url: str) -> bool:
    """Return True if URL has a valid HTTPS hostname."""
    parsed = urlparse(url)
    return (
        parsed.scheme == "https"
        and bool(parsed.netloc)
        and HOSTNAME_RE.fullmatch(parsed.hostname or "") is not None
    )


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
            url = f"https://{line}"
            if _is_valid_host(url):
                hosts.append(url)
    return hosts


def update_categories(
    categories_path: Path, *, max_retries: int = 1, ignore_failures: bool = False
) -> None:
    """Download host lists and write ``categories.json``."""

    categories = []
    for name, urls in CATEGORY_SOURCES.items():
        hosts: list[str] = []
        for url in urls:
            attempt = 0
            while attempt < max_retries:
                try:
                    resp = requests.get(url, timeout=30)
                    resp.raise_for_status()
                except RequestException as exc:  # network or HTTP error
                    attempt += 1
                    logging.warning(
                        "Failed to fetch %s (attempt %s/%s): %s",
                        url,
                        attempt,
                        max_retries,
                        exc,
                    )
                    if attempt >= max_retries:
                        if ignore_failures:
                            break
                        raise
                else:
                    hosts.extend(_parse_lines(resp.text.splitlines()))
                    break
        categories.append({"name": name, "hosts": sorted(set(hosts))})

    categories_path.write_text(json.dumps(categories, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Update category host lists")
    parser.add_argument(
        "--max-retries",
        type=int,
        default=1,
        help="Number of times to retry failed downloads",
    )
    parser.add_argument(
        "--ignore-failures",
        action="store_true",
        help="Skip sources that fail even after retries",
    )
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    update_categories(
        Path(__file__).resolve().parent.parent / "categories.json",
        max_retries=args.max_retries,
        ignore_failures=args.ignore_failures,
    )
