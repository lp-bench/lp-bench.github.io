# proof-bench.github.io

Website of **ProofBench**, a formal benchmark for research-level mathematics in Lean 4.
A plain static site (HTML, CSS, vanilla JavaScript) built on the Ten Challenges UI and served by GitHub Pages.
There is no build step and nothing to install.

## Pages

| File | Page |
|---|---|
| `index.html` | Home: hero, why ProofBench, problem set, theorem sandwich, evaluation, landscape, leaderboard, open source, team |
| `problems.html` | All 114 problems with summaries and Lean statements; each has a permanent link such as `problems.html#P042` |
| `ten-challenges.html` | The Ten Challenges sister project. Statements and leaderboard load live from its own site; submissions open a pre-filled GitHub issue in `utkuokur/ten-challenges-submissions` |
| `workshop.html` | The inaugural ProofBench workshop (Freiberg, September–October 2025) |

## Layout

```
assets/css/style.css          shared design (Computer Modern, black and white, deep navy front-page hero, Ten Challenges components)
assets/js/config.js           launch switches: release flag, arXiv id, repositories, leaderboard rows, contacts
assets/js/common.js           shared helpers: Lean highlighting, tooltip, copy, paper and contact links
assets/js/home.js             front page interactions
assets/js/problems-page.js    problem list, filters and deep links
assets/js/ten-challenges.js   Ten Challenges list, live statements, leaderboard and submission forms
assets/js/problem-data.js     GENERATED problem data, do not edit by hand
assets/fonts/                 Computer Modern Unicode (CMU Serif, CMU Typewriter), subset to woff2, SIL OFL (see OFL.txt)
assets/img/                   bench sketch, favicon, social preview (og.png)
scripts/build_problems.py     regenerates problem-data.js from proofbench-statements
scripts/og.html               source of the link preview image og.png (render instructions inside)
```

## Preview locally

```sh
python -m http.server 8000
# open http://localhost:8000
```

## Common edits

| What | Where |
|---|---|
| Paper is on arXiv | `config.js`: set `paper.arxivId`; every "Paper" button becomes a link |
| Repositories went public | `config.js`: set `released: true`; repository cards and problem files become links |
| First results | `config.js`: add rows to `results`; the leaderboard replaces its placeholder |
| Problem set changed | `python scripts/build_problems.py ../proofbench-statements/ProofBench/DATABASE/Database.json` |
| Area shown for a problem | `scripts/build_problems.py`: `AREA_OVERRIDES` (area and graph theory subarea), then re-run it |
| Headline numbers (114, 32, 82, 87) | `index.html` hero statistics and section text |
| Text on any page | the page's `.html` file |

## Launch checklist

1. Paper announced on arXiv: put the id in `config.js` → `paper.arxivId`.
2. Make `proofbench-statements`, `proofbench-eval-apptainer` and `inspect-apptainer` public.
3. Set `released: true` in `config.js`.
4. If the problem set changed since the last export, re-run `scripts/build_problems.py`.
5. Commit and push to `main`. Pages redeploys in about a minute.
6. Check the live site, a deep link (`problems.html#P042`), the Ten Challenges page and the link preview (`og.png`).

## GitHub Pages setup (once)

The repository is named `proof-bench.github.io` in the `proof-bench` organisation, so it serves at
`https://proof-bench.github.io/`. In **Settings → Pages**, choose *Deploy from a branch*, branch `main`, folder `/ (root)`.
