# proof-bench.github.io

Website of **ProofBench**, a Lean 4 benchmark for AI in research mathematics.
A plain static site (HTML, CSS, vanilla JS) served by GitHub Pages. There is no build step and nothing to install.

## Layout

```
index.html                 all page content and copy
assets/css/style.css       design (light and dark theme tokens at the top)
assets/js/config.js        launch switches: release flag, arXiv id, repo cards, leaderboard rows, contact
assets/js/main.js          interactions: hero, problem explorer, waffle, landscape, sandwich, session replay
assets/js/problems.js      GENERATED problem data, do not edit by hand
assets/img/                bench sketch, favicon, social preview (og.png)
scripts/build_problems.py  regenerates problems.js from proofbench-statements
```

## Preview locally

```sh
python -m http.server 8000
# open http://localhost:8000
```

## Common edits

| What | Where |
|---|---|
| Paper is on arXiv | `config.js`: set `paper.arxivId` (fills the buttons and BibTeX) |
| Repositories went public | `config.js`: set `released: true` (repo cards become links, explorer links to files) |
| First results | `config.js`: add rows to `results` (the leaderboard replaces the placeholder) |
| Problem set changed | `python scripts/build_problems.py ../proofbench-statements/ProofBench/DATABASE/Database.json` |
| Headline numbers (114, 32, 82, 87, …) | `index.html`, hero `.stats` and the composition cards |
| Text, people, workshop | `index.html` |

Single problems can be linked directly: `https://proof-bench.github.io/#P042`.

## Launch checklist

1. Paper announced on arXiv: put the id in `config.js` → `paper.arxivId`.
2. Make `proofbench-statements`, `proofbench-eval-apptainer` and `inspect-apptainer` public.
3. Set `released: true` in `config.js`.
4. If the problem set changed since the last export, re-run `scripts/build_problems.py`.
5. Commit and push to `main`. Pages redeploys in about a minute.
6. Check the live site, a deep link (`/#P042`) and the link preview (`og.png`).

## GitHub Pages setup (once)

The repository is named `proof-bench.github.io` in the `proof-bench` organisation, so it serves at
`https://proof-bench.github.io/`. In **Settings → Pages**, choose *Deploy from a branch*, branch `main`, folder `/ (root)`.
A custom domain can be added in the same panel later.
