// Everything that changes on launch day lives here.
window.PB_CONFIG = {
  // Flip to true when the paper is on arXiv and the repositories are public.
  released: false,
  releaseLabel: "Public with the paper",

  paper: {
    title: "ProofBench: A Lean-based Formal Benchmark for AI Capabilities in Combinatorics",
    arxivId: "",      // e.g. "2610.12345" — fills the arXiv button and the BibTeX entry
    pdfUrl: "",       // optional direct PDF link; defaults to arXiv when arxivId is set
    year: 2026,
  },

  repos: [
    {
      name: "proofbench-statements",
      url: "https://github.com/proof-bench/proofbench-statements",
      lang: "Lean 4",
      blurb: "The problem set: one challenge file per problem with a single sorry, the negated statement for each open problem, and the statement library of definitions not yet in Mathlib.",
      facts: ["114 challenge files", "47 statement modules", "Lean 4.33.1 + Mathlib"],
    },
    {
      name: "proofbench-eval-apptainer",
      url: "https://github.com/proof-bench/proofbench-eval-apptainer",
      lang: "Python",
      blurb: "The evaluation harness on Inspect AI: the same agent loop, tools, sandbox and budgets for every model, and two-layer grading with Lean and Comparator.",
      facts: ["Docker or Apptainer", "Slurm-ready", "results.csv per run"],
    },
    {
      name: "inspect-apptainer",
      url: "https://github.com/proof-bench/inspect-apptainer",
      lang: "Python",
      blurb: "An Apptainer sandbox for Inspect AI. Runs any Inspect evaluation on HPC clusters, where Docker is unavailable and users have no administrator rights.",
      facts: ["Works with any Inspect eval", "No root needed", "No network, no host env"],
    },
  ],

  // Leaderboard rows. Leave empty until results are published.
  // { model: "provider/name", search: false, open: 0, research: 0, calibration: 0, cost: "$0", date: "2026-10" }
  results: [],

  contact: "vaibhav.bajpai@math.tu-freiberg.de",
};
