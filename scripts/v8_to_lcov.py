import argparse
import bisect
import json
from pathlib import Path
from urllib.parse import urlparse


def load_coverage(path: Path):
    """Parse a V8 JSON coverage file.

    Args:
        path: Path to the coverage JSON file.

    Yields:
        Tuple of a file path and its function coverage data.
    """

    data = json.loads(path.read_text())
    for entry in data.get("result", []):
        url = entry.get("url")
        if not url or url.startswith("node:"):
            continue
        parsed = urlparse(url)
        if parsed.scheme == "file":
            fpath = Path(parsed.path)
        else:
            fpath = Path(url)
        yield fpath, entry.get("functions", [])


def line_offsets(text: str):
    """Return cumulative offsets for each line in ``text``.

    Args:
        text: File contents to analyze.

    Returns:
        List of byte offsets for line boundaries.
    """

    offs = [0]
    for line in text.splitlines(True):
        offs.append(offs[-1] + len(line))
    return offs


def lines_for_range(offs, start, end):
    """Calculate lines touched by a byte range.

    Args:
        offs: Offsets produced by :func:`line_offsets`.
        start: Start offset of the range.
        end: End offset of the range.

    Returns:
        ``range`` of 1-indexed line numbers.
    """

    start_line = bisect.bisect_right(offs, start) - 1
    end_line = bisect.bisect_left(offs, end)
    return range(start_line + 1, end_line + 1)


def process_file(path: Path, functions):
    """Compile coverage data for one source file.

    Args:
        path: Source file path.
        functions: Function coverage records.

    Returns:
        Tuple of hit counts per line and the line count, or ``None``
        when the file does not exist.
    """

    if not path.is_file():
        return None
    text = path.read_text()
    offs = line_offsets(text)
    hits = [0] * len(offs)
    for fn in functions:
        for r in fn.get("ranges", []):
            for ln in lines_for_range(
                offs, r["startOffset"], r["endOffset"]
            ):
                hits[ln - 1] = max(hits[ln - 1], r["count"])
    return hits, len(offs) - 1


def write_lcov(data, outfile: Path):
    """Write collected coverage data in lcov format.

    Args:
        data: Mapping of file paths to line hit counts.
        outfile: Destination for the ``lcov`` file.
    """

    with outfile.open("w") as fh:
        fh.write("TN:\n")
        for path, (hits, total) in data.items():
            fh.write(f"SF:{path}\n")
            for i in range(1, total + 1):
                fh.write(f"DA:{i},{hits[i-1]}\n")
            fh.write("end_of_record\n")


def main():
    """Convert V8 coverage JSON files to lcov.

    Parses coverage files from a directory and writes a single lcov
    report.
    """

    p = argparse.ArgumentParser()
    p.add_argument("coverage_dir", nargs="?", default="coverage")
    p.add_argument("--output", default="coverage/lcov.info")
    args = p.parse_args()
    cov_dir = Path(args.coverage_dir)
    files = cov_dir.glob("*.json")
    results = {}
    for file in files:
        for path, functions in load_coverage(file):
            data = process_file(path, functions)
            if data is None:
                continue
            if path not in results:
                results[path] = data
            else:
                existing, total = results[path]
                hits, _ = data
                for i, h in enumerate(hits):
                    if h > existing[i]:
                        existing[i] = h
    if results:
        outfile = Path(args.output)
        outfile.parent.mkdir(parents=True, exist_ok=True)
        write_lcov(results, outfile)


if __name__ == "__main__":
    main()
