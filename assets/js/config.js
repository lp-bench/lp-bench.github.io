// Everything that changes on launch day lives here.
window.PB_CONFIG = {
  // Flip to true when the paper is on arXiv and the repositories are public.
  released: false,

  paper: {
    arxivId: "",      // e.g. "2610.12345" — turns the "Paper" buttons into links
    year: 2026,
  },

  repos: [
    {
      name: "proofbench",
      url: "https://github.com/proof-bench/proofbench",
      lang: "Lean 4",
      blurb: "Everything a model is allowed to see: one challenge file per problem, the negated form of every open problem, and the library of definitions that Mathlib does not yet provide.",
      facts: "114 challenge files · Lean 4.34.1",
    },
    {
      name: "proofbench-eval-apptainer",
      url: "https://github.com/proof-bench/proofbench-eval-apptainer",
      lang: "Python",
      blurb: "The evaluation harness on Inspect AI: one agent loop, one toolset and one budget for every model, with grading by Lean and Comparator.",
      facts: "Docker or Apptainer · Slurm-ready",
    },
    {
      name: "inspect-apptainer",
      url: "https://github.com/proof-bench/inspect-apptainer",
      lang: "Python",
      blurb: "A drop-in Apptainer sandbox for Inspect AI, for HPC clusters where Docker is unavailable and users have no root access.",
      facts: "Works with any Inspect evaluation",
    },
  ],

  // Leaderboard rows. Leave empty until results are published.
  // { model: "provider/name", search: false, open: 0, research: 0, calibration: 0, cost: "$0" }
  results: [],

  // Every "Contact" and "Get in touch" link writes to all of these.
  contact: ["Vaibhav.Bajpai@math.tu-freiberg.de", "Utku.Okur@math.tu-freiberg.de"],
};
