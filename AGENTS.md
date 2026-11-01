# AGENTS.md

Guidance for AI coding agents working in this repository.

## Commits

- Do **not** add co-author or co-sign trailers to commit messages. No `Co-Authored-By:`, `Signed-off-by:`, `Claude-Session:` or similar lines, and no "Generated with" footers in commits or pull requests.
- Commit as the repository owner's configured git identity; don't override `user.name` or `user.email`.
- No PRs; everything in this repo goes directly to `main`.

## Project

- Edit the app in `src/template.html` and the data in `data/places.json`; never hand-edit `dist/` (build output, gitignored).
- `npm run build` writes `dist/index.html`. Run it (and look at the page) before committing changes to the template or data.
- After adding or moving places, run `npm run enrich` so country and city fields stay correct.
- Every push to `main` builds on Node 26 and deploys to GitHub Pages (https://h3h.github.io/places/) via `.github/workflows/pages.yml`.
- See README.md for the data update workflow and tools.

## Privacy

- The repo and site are public. Never commit raw Google Takeout exports, browser lookup results, or `local/` overrides; they're gitignored for that reason.
- `data/places.json` holds only what the public page already shows. Don't add fields beyond that (e.g. review text).
- Throttle any Google Maps lookups (the browser scripts default to one place every 2–3.5 s and stop on errors).
