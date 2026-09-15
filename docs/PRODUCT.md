# Shelfmark — product notes (Sep 2026)

Public aisle: https://nathanplatteruser.github.io/childrens-books/

## Family copy vs full desk

The GitHub Pages family copy (`docs/index.html`) is shop / story / jar. Practice six spines. Count the stamp. Click-along on first visit.

The full desk (`src/`) adds:

- Camera stack and single ISBN (webcam or phone). Grocery-gun HID bursts.
- Two-tone POS beep.
- Grade taps: Excellent / Very Good (default) / Good / Poor.
- Hydrate: Google Books + listing polish. Progress bar.
- Unique ISBN comps (backend prompt). Generic $4.99-class tags rejected.
- Target keep: dollars and cents. Reverse-engineer list price after Amazon referral 15% + $1.80 close, or eBay FVF 15.3% + order fee, plus $0.40 mailer and USPS Media Mail.
- Keep is a floor: `list = max(comp, reverse-keep)`. Blank keep = market only.
- Pile: per-row Remove. Dummy copies stay gone (no force-reseed).
- Session files: eBay File Exchange CSV, Amazon Inventory Loader TSV, Shelfmark session ledger (UTF-8 BOM).
- Click to eBay Upload: downloads CSV and opens https://www.ebay.com/sh/reports
- Three speeds: Hands / File / Wire.
- Connect: Amazon first, then eBay. Sell-everywhere default. Optional.

## Honest limits

- Nothing publishes until they upload.
- Listed ≠ sold.
- Family copy on Pages cannot run the camera desk.
- Wire needs marketplace keys. File path does not.
