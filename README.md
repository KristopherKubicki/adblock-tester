# Adblock Tester

[![CI](https://github.com/kristopherkubicki/adblock-tester/actions/workflows/test.yml/badge.svg)](https://github.com/kristopherkubicki/adblock-tester/actions/workflows/test.yml)
[![Deploy](https://github.com/kristopherkubicki/adblock-tester/actions/workflows/pages.yml/badge.svg)](https://github.com/kristopherkubicki/adblock-tester/actions/workflows/pages.yml)
[![codecov](https://codecov.io/gh/kristopherkubicki/adblock-tester/branch/main/graph/badge.svg)](https://codecov.io/gh/kristopherkubicki/adblock-tester)

This repository contains a lightweight ad‑block detection tester that can be hosted using [GitHub Pages](https://pages.github.com/).


## [Try the Live Tester](https://kristopherkubicki.github.io/adblock-tester/)

It aims to replace several popular ad‑block test pages that have gone offline or are no longer maintained.

The GitHub Actions workflow in `.github/workflows/pages.yml` automatically publishes the contents of the repository to GitHub Pages whenever changes are pushed to the `main` branch.

To enable Pages on your fork:

1. Go to the repository settings on GitHub.
2. Select **Pages** from the sidebar.
3. Choose **GitHub Actions** as the source and save.

After the workflow runs successfully, the tester will be available at `https://<username>.github.io/<repository>/`.

## Setup

Install the Python requirements before running the helper script:

```bash
pip install -r requirements.txt
```

## Customizing Host Categories

The list of hosts that are tested is stored in `categories.json`. Each entry in
the JSON file has a `name` and an array of `hosts` URLs. You can add new
categories or remove hosts by editing this file as long as the JSON structure is
kept intact. The page will fetch `categories.json` at runtime, so any changes
take effect the next time the page is loaded.

You can also specify additional hosts at runtime. Use the **Custom host(s)**
field on the tester page or provide a comma‑separated list via the `custom`
query parameter:

```
https://<username>.github.io/<repository>/?custom=https://example.com/ad.js
```


## Updating Categories from EasyList

Run the helper script to download host lists and regenerate `categories.json`.
Install the required dependencies first:

```bash
pip install -r requirements.txt
python scripts/update_categories.py
```

If you prefer, the same command is available via npm:

```bash
npm run update-categories
```

The script fetches several EasyList sources, extracts the hostnames and writes
them to `categories.json`. A network connection is required when running it.


## Running Tests

The repository includes Node and Python tests. Run them with coverage using:

```
npm test
pytest --cov=scripts/update_categories.py
```

## License

This project is licensed under the [MIT License](LICENSE).
