# Shelfmark

Used-book shop for homestead kids. Scan once. Count the stamp. Keep a dollar.

**Public destination (send this):** [nathanplatteruser.github.io/childrens-books](https://nathanplatteruser.github.io/childrens-books/)

| Copy | URL |
| --- | --- |
| Children’s books aisle | https://nathanplatteruser.github.io/childrens-books/ |
| Family shop (GitHub Pages) | https://nathanplatteruser.github.io/shelfmark/ |
| Same family shop under the aisle | https://nathanplatteruser.github.io/childrens-books/shelfmark/ |
| This repo | https://github.com/nathanplatteruser/shelfmark |

The family copy is shop, story, and jar in the browser — three bins, no typing, Count the stamp. The files in `src/` are the full desk: camera stack, grocery-gun ISBN, unique per-ISBN comps, keep-a-dollar reverse-engineer, Pile remove, eBay File Exchange, Amazon Inventory Loader, and optional Wire to Amazon / eBay.

Nothing publishes until a grown-up uploads the sheet. Listed is not sold.

## What a stack night looks like

1. Camera on (laptop webcam or phone). Grocery gun still works.
2. Stack or Single.
3. Beep per ISBN.
4. Done → Very Good default. Excellent / Good / Poor are taps.
5. Hydrate title, description, unique ISBN tag. Progress bar.
6. Optional: “I want to keep $X.XX per book.” List price is `max(comp, reverse-keep)`. Blank keep = market only.
7. Download eBay File Exchange CSV and Amazon Inventory Loader. Click to eBay Upload opens Seller Hub Reports.
8. Listed ≠ sold. The jar waits for a buyer.

## Three speeds

- **Hands** — skip the sheet. Sort bins. Practice spines.
- **File** — CSV / TSV tonight. No API keys. First-class path.
- **Wire** — Amazon SP-API and eBay Inventory API behind Connect, when keys exist.

If every book comes back $4.99, it is not a shop. Generic 4.99 / 5.99 / 8.99 / 9.99 tags are rejected unless that ISBN really sells there.

## Kids learn

Gross is not profit. An eight-dollar paperback can leave less than a dollar after the shop, the envelope, and the stamp. Practice six spines (Calculus, Gatsby, Boxcar, F451, Hobbit, Huck) with Count the stamp on. Two should be green, two ochre, two oxblood.

## Desk source

TanStack Start + React 19 + Vite + Tailwind. Local preview uses PGLite; Neon is optional. Auth is Better Auth, off until Connect needs it.

```
npm install
npm run dev
```

`docs/` is the static family copy that GitHub Pages serves from the portfolio repo (`nathanplatteruser.github.io`), not from this repo’s Actions.

## Product notes

See [docs/PRODUCT.md](docs/PRODUCT.md) for keep math, comps, files, and what is not in the family copy.
