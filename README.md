# Adblock Tester

This repository contains a lightweight ad‑block detection tester that can be hosted using [GitHub Pages](https://pages.github.com/).

You can try the live tester at [kristopherkubicki.github.io/adblock-tester](https://kristopherkubicki.github.io/adblock-tester/).

The GitHub Actions workflow in `.github/workflows/pages.yml` automatically publishes the contents of the repository to GitHub Pages whenever changes are pushed to the `main` branch.

To enable Pages on your fork:

1. Go to the repository settings on GitHub.
2. Select **Pages** from the sidebar.
3. Choose **GitHub Actions** as the source and save.

After the workflow runs successfully, the tester will be available at `https://<username>.github.io/<repository>/`.

## Customizing Host Categories

The list of hosts that are tested is stored in `categories.json`. Each entry in
the JSON file has a `name` and an array of `hosts` URLs. You can add new
categories or remove hosts by editing this file as long as the JSON structure is
kept intact. The page fetches `categories.json` at runtime, so any changes take
effect the next time the page is loaded.

You can also specify aditional hosts at runtime. Use the **Custom host(s)**
field on the tester page or provide a comma‑separated list via the `custom`
query parameter:

```
https://<username>.github.io/<repository>/?custom=https://example.com/ad.js
```

## Editing the Page Layout

All markup and styling live in `index.html`. The beginning of the file contains
a `<style>` block where background colors, spacing and fonts are defined. Feel
free to tweak these styles or add new elements to change how the results are
presented. Since the page is completely static, simply editing and refreshing
the file locally will show your updates immediately.

## Working on New Categories

When adding a new category to `categories.json`, follow the existing format:

```json
{
  "name": "My Category",
  "hosts": [
    "https://example.com/script.js"
  ]
}
```

Each host should be a full URL to the resource that would normally be blocked by
an ad blocker. Keeping the list small ensures the test page loads quickly.
