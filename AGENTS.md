# AGENTS.md

Guidance for AI coding agents working in this repository.

## Commits

- Do **not** add co-author or co-sign trailers to commit messages. No `Co-Authored-By:`, `Signed-off-by:`, `Claude-Session:` or similar lines, and no "Generated with" footers in commits or pull requests.
- Commit as the repository owner's configured git identity; don't override `user.name` or `user.email`.

## Project

- The whole app is `index.html`: a self-contained page with its data embedded as JSON `<script>` tags. d3 and topojson load from cdnjs.
- Every push to `main` deploys to GitHub Pages (https://h3h.github.io/places/) via `.github/workflows/pages.yml`.
- Never commit raw Google Takeout exports or other personal source data; only the built page belongs here.
