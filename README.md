# lp-bench.github.io

The ProofBench website, served by GitHub Pages at https://lp-bench.github.io.
Plain HTML, CSS and JavaScript; no build step. Open `index.html` locally to preview.
Publishing runs through GitHub Actions (`.github/workflows/site.yml`; Settings → Pages →
Source: GitHub Actions).

* `assets/js/config.js`: everything that changes on launch day (`released`, arXiv id,
  repositories, leaderboard rows, contact).
* `assets/js/problem-data.js`: problem list, generated from the proofbench repo by
  `scripts/build_problems.py`; do not edit by hand. The script also fills the counts in the
  pages, at the elements marked `data-pb`, `data-pb-text` or `data-pb-<attribute>` (see the
  script's docstring). It runs automatically after every push to lp-bench/lp-bench,
  which signals this repository, and on demand (Actions → site → Run workflow).
