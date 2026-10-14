(() => {
  "use strict";

  const CFG = window.PB_CONFIG || {};
  const PROBLEMS = (window.PB_PROBLEMS || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
  const STATEMENTS_REPO = "https://github.com/proof-bench/proofbench-statements";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CAT_LABEL = { open: "Open", research: "Research", calibration: "Calibration" };
  const CAT_ORDER = ["open", "research", "calibration"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /* ---------------- Lean highlighting ---------------- */
  const LEAN_TOKENS = new RegExp(
    [
      "(--[^\\n]*)",                                                   // 1 comment
      "\\b(sorry)\\b",                                                 // 2 sorry
      "\\b(theorem|lemma|def|by|fun|refine|exact|intro|have|show|let|in|where|with|match|Type|Prop)\\b", // 3 keyword
      "([∀∃¬→↔∧∨≤≥≠⟨⟩↦≃∩∪⊆∈⊢∘↪<|]+|:=)",                                 // 4 symbols
      "\\b(\\d+)\\b",                                                  // 5 number
      "([ℕℤℝ]|\\b[A-Z][a-z][A-Za-z0-9_']*(?:\\.[A-Za-z0-9_']+)*)",     // 6 type-ish
    ].join("|"),
    "gu"
  );
  const CLASSES = [null, "tok-com", "tok-sorry", "tok-kw", "tok-sym", "tok-num", "tok-ty"];

  function highlightLean(src) {
    let out = "";
    let last = 0;
    src.replace(LEAN_TOKENS, (m, ...groups) => {
      const offset = groups[groups.length - 2];
      out += esc(src.slice(last, offset));
      const idx = groups.slice(0, 6).findIndex((g) => g !== undefined);
      out += `<span class="${CLASSES[idx + 1]}">${esc(m)}</span>`;
      last = offset + m.length;
      return m;
    });
    return out + esc(src.slice(last));
  }

  const challengeSource = (p) => `${p.lean} := by\n  sorry`;

  /* ---------------- nav ---------------- */
  const navLinks = $$(".topnav a");
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  navLinks.forEach((a) => {
    const target = $(a.getAttribute("href"));
    if (target) sectionObserver.observe(target);
  });

  /* ---------------- tooltip ---------------- */
  const tip = $(".tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    const top = y - r.height - 10 < 8 ? y + 18 : y - r.height - 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------------- Figure 1: example challenge files ---------------- */
  (function teaser() {
    const SHOWCASE = [
      ["042", "theorem P042 : RiemannHypothesis := by\n  sorry"],
      ["076", "theorem P076 :\n    ∃ (G : SimpleGraph (Fin 99)) (_ : DecidableRel G.Adj),\n      G.IsSRGWith 99 14 1 2 := by\n  sorry"],
      ["080", "theorem P080 : ∀ {V : Type u} {V' : Type v} [Fintype V]\n    (G : SimpleGraph V) (G' : SimpleGraph V'),\n    3 ≤ Fintype.card V → G.SameDeck G' →\n    Nonempty (G ≃g G') := by\n  sorry"],
      ["098", "theorem P098 {V : Type} (G : SimpleGraph V) [Fintype V]\n    [DecidableRel G.Adj] {htf : triangle_free G} :\n    Finset.card (G.edgeSet.toFinset) ≤\n      (Fintype.card V)^2 / 4 := by\n  sorry"],
      ["109", "theorem P109 {V : Type*} [Fintype V] (G : SimpleGraph V)\n    [DecidableRel G.Adj] (h : 2 ≤ Fintype.card V) :\n    ∃ u v, u ≠ v ∧ G.degree u = G.degree v := by\n  sorry"],
      ["074", "theorem P074 : ∀ n : ℕ, 0 < n →\n    CollatzReachesOne n := by\n  sorry"],
      ["062", "theorem P062 : ∀ (V : Type u) (E : Type v) [Fintype E]\n    [DecidableEq V] (M : Multigraph V E), M.Bridgeless →\n    ∃ f : E → ZMod 5, M.IsNowhereZeroFlow f := by\n  sorry"],
    ].filter(([id]) => BY_ID[id]);

    const fig = $("#fig-challenge");
    const codeEl = $("[data-hero-code]");
    if (!fig || !codeEl || !SHOWCASE.length) return;
    const fileEl = $("[data-hero-file]");
    const posEl = $("[data-hero-pos]");
    const capEl = $("[data-hero-caption]");
    const linkEl = $("[data-hero-link]");
    let i = 0, timer = 0, paused = false, visible = true;

    function render(k) {
      const [id, src] = SHOWCASE[k];
      const p = BY_ID[id];
      fileEl.textContent = `P${id}.lean`;
      posEl.textContent = `${k + 1} / ${SHOWCASE.length}`;
      capEl.textContent = `Challenge file P${id}, ${p.name} (${p.cat}).`;
      linkEl.href = `#P${id}`;
      linkEl.onclick = (e) => { e.preventDefault(); openProblem(id); };
      codeEl.innerHTML = highlightLean(src);
    }
    function go(k) {
      i = (k + SHOWCASE.length) % SHOWCASE.length;
      const pre = codeEl.parentElement;
      if (reduceMotion) { render(i); return; }
      pre.classList.add("fading");
      setTimeout(() => { render(i); pre.classList.remove("fading"); }, 220);
    }
    function schedule() {
      clearTimeout(timer);
      if (reduceMotion) return;
      timer = setTimeout(() => { if (!paused && visible && !document.hidden) go(i + 1); schedule(); }, 7000);
    }
    $("[data-hero-prev]").addEventListener("click", () => { go(i - 1); schedule(); });
    $("[data-hero-next]").addEventListener("click", () => { go(i + 1); schedule(); });
    fig.addEventListener("pointerenter", () => { paused = true; });
    fig.addEventListener("pointerleave", () => { paused = false; });
    fig.addEventListener("focusin", () => { paused = true; });
    fig.addEventListener("focusout", () => { paused = false; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(fig);
    render(0);
    schedule();
  })();

  /* ---------------- Figure 2: waffle ---------------- */
  const waffle = $(".waffle");
  if (waffle) {
    const ordered = CAT_ORDER.flatMap((c) => PROBLEMS.filter((p) => p.cat === c));
    waffle.innerHTML = ordered
      .map((p) => `<button class="cell" data-id="${p.id}" data-cat="${p.cat}" aria-label="P${p.id}: ${esc(p.name)}, ${CAT_LABEL[p.cat]}"></button>`)
      .join("");
    const tipFor = (p) => `<span class="tt-meta">P${p.id} · ${CAT_LABEL[p.cat]} · ${esc(p.msc.slice(0, 5))}</span>${esc(p.name)}`;
    const tipAt = (c) => {
      const r = c.getBoundingClientRect();
      showTip(tipFor(BY_ID[c.dataset.id]), r.left + r.width / 2, r.top);
    };
    waffle.addEventListener("pointerover", (e) => { const c = e.target.closest(".cell"); if (c) tipAt(c); });
    waffle.addEventListener("pointerout", (e) => { if (e.target.closest(".cell")) hideTip(); });
    waffle.addEventListener("focusin", (e) => { const c = e.target.closest(".cell"); if (c) tipAt(c); });
    waffle.addEventListener("focusout", hideTip);
    waffle.addEventListener("click", (e) => {
      const c = e.target.closest(".cell");
      if (c) { hideTip(); openProblem(c.dataset.id); }
    });
    $$("[data-legend]").forEach((row) => {
      row.addEventListener("pointerenter", () => {
        waffle.classList.add("dim");
        $$(".cell", waffle).forEach((c) => c.classList.toggle("match", c.dataset.cat === row.dataset.legend));
      });
      row.addEventListener("pointerleave", () => waffle.classList.remove("dim"));
    });
  }

  /* ---------------- 1.1 problem list ---------------- */
  const list = $("[data-list]");
  const explorer = $(".explorer");
  const state = { q: "", cat: "all", area: "all", open: new Set(), all: false };
  const PREVIEW = 12;

  function matches(p) {
    if (state.cat !== "all" && p.cat !== state.cat) return false;
    if (state.area !== "all" && p.area !== state.area) return false;
    if (!state.q) return true;
    const hay = fold(`P${p.id} ${p.id} ${p.name} ${p.msc} ${p.area} ${p.summary} ${p.note}`);
    return fold(state.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  function detailHTML(p) {
    const file = `ProofBench/PROBLEMS/P${p.id}/P${p.id}.lean`;
    const fileLink = CFG.released ? `<a href="${STATEMENTS_REPO}/blob/main/${file}">${file}</a>` : `<span>${file}</span>`;
    const disprove = p.cat === "open" ? `<span>+ P${p.id}_DISPROVE.lean (negation)</span>` : "";
    return `
      <p>${esc(p.summary)}</p>
      ${p.note ? `<p class="note">Status: ${esc(p.note)}.</p>` : ""}
      <div class="code-block">
        <button class="btn btn-small copy-btn" type="button" data-copy-lean="${p.id}">Copy</button>
        <pre><code>${highlightLean(challengeSource(p))}</code></pre>
      </div>
      <div class="p-meta"><span>MSC ${esc(p.msc)}</span>${fileLink}${disprove}<a href="#P${p.id}" data-permalink="${p.id}">permalink</a></div>`;
  }

  function rowHTML(p) {
    const open = state.open.has(p.id);
    return `
      <li class="problem" id="P${p.id}">
        <button class="problem-row" type="button" aria-expanded="${open}" data-toggle="${p.id}">
          <span class="p-id">P${p.id}</span>
          <span class="p-name">${esc(p.name)}</span>
          <span class="p-area">${esc(p.area)}</span>
          <span class="p-cat"><span class="sw sw-${p.cat}"></span>${p.cat}</span>
        </button>
        ${open ? `<div class="problem-detail">${detailHTML(p)}</div>` : ""}
      </li>`;
  }

  function renderList() {
    if (!list) return;
    const hits = PROBLEMS.filter(matches);
    const filtered = state.q || state.cat !== "all" || state.area !== "all";
    const shown = filtered || state.all ? hits : hits.slice(0, PREVIEW);
    list.innerHTML = shown.length
      ? shown.map(rowHTML).join("")
      : `<li class="empty">No problem matches “${esc(state.q)}”.</li>`;
    const more = $("[data-more]");
    more.hidden = shown.length >= hits.length;
    more.textContent = `Show all ${hits.length} problems`;
    $("[data-count-label]").textContent = filtered
      ? `${hits.length} of ${PROBLEMS.length} problems`
      : `${PROBLEMS.length} problems; showing ${shown.length}`;
  }

  function setCat(cat) {
    state.cat = cat;
    $$(".tab[data-cat]", explorer).forEach((x) => {
      x.classList.toggle("is-on", x.dataset.cat === cat);
      x.setAttribute("aria-pressed", String(x.dataset.cat === cat));
    });
  }

  if (list) {
    $("[data-search]").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderList(); });
    $("[data-area]").addEventListener("change", (e) => { state.area = e.target.value; renderList(); });
    $$(".tab[data-cat]", explorer).forEach((b) => b.addEventListener("click", () => { setCat(b.dataset.cat); renderList(); }));
    $("[data-more]").addEventListener("click", () => { state.all = true; renderList(); });
    list.addEventListener("click", (e) => {
      const t = e.target.closest("[data-toggle]");
      if (t) {
        const id = t.dataset.toggle;
        state.open.has(id) ? state.open.delete(id) : state.open.add(id);
        t.closest("li").outerHTML = rowHTML(BY_ID[id]);
        $(`#P${id} .problem-row`)?.focus({ preventScroll: true });
        return;
      }
      const c = e.target.closest("[data-copy-lean]");
      if (c) copy(challengeSource(BY_ID[c.dataset.copyLean]), c);
      const pl = e.target.closest("[data-permalink]");
      if (pl) { e.preventDefault(); history.replaceState(null, "", `#P${pl.dataset.permalink}`); copy(location.href, pl, "copied"); }
    });
    renderList();
  }

  function openProblem(id) {
    if (!BY_ID[id] || !list) return;
    if (!matches(BY_ID[id])) {
      state.q = ""; state.area = "all";
      $("[data-search]").value = "";
      $("[data-area]").value = "all";
      setCat("all");
    }
    state.all = true;
    state.open.add(id);
    renderList();
    const el = $(`#P${id}`);
    history.replaceState(null, "", `#P${id}`);
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    $(".problem-row", el).focus({ preventScroll: true });
  }

  const openFromHash = () => {
    const m = location.hash.match(/^#P(\d{3})$/);
    if (m) openProblem(m[1]);
  };
  window.addEventListener("hashchange", openFromHash);
  setTimeout(openFromHash, 60);

  /* ---------------- Table 2: landscape ---------------- */
  (function landscape() {
    const body = $("[data-landscape]");
    if (!body) return;
    const ROWS = [
      ["informal-answer", "Informal", "final answer"],
      ["informal-proof", "Informal", "proof"],
      ["formal-proof", "Formal", "proof"],
    ];
    const LEVELS = [["competition", "Competition"], ["undergraduate", "Undergraduate"], ["graduate", "Graduate"], ["research", "Research"]];
    const B = [
      ["HLE", "informal-answer", "graduate", "expert level, multidisciplinary", "Humanity’s Last Exam: thousands of expert-level multiple-choice and short-answer questions, not only in mathematics, built to resist memorization and internet lookup."],
      ["FrontierMath", "informal-answer", "research", "research level", "Hundreds of original, exceptionally hard problems across most branches of modern mathematics; the answer is a Python object, typically a natural number, checked automatically."],
      ["RealMath", "informal-answer", "research", "research level", "A continuous benchmark built from new arXiv papers and Stack Exchange to limit contamination; it evaluates verifiable answers rather than proofs."],
      ["LiveMathematicianBench", "informal-answer", "research", "research level", "Multiple choice from recent arXiv papers, with plausible distractors that are false or too weak; the best reported model reaches 43.5%."],
      ["ProofBench (Ma et al.)", "informal-proof", "competition", "competition level", "435 expert-graded natural-language proofs for 145 competition problems; it evaluates proof graders rather than provers."],
      ["IMProofBench", "informal-proof", "research", "research level", "39 peer-reviewed research problems, each proof graded by the problem’s author; in the agentic setting GPT-5 writes 22% fully correct proofs."],
      ["FirstProof", "informal-proof", "research", "research level", "Ten original, unpublished questions from the authors’ own research; the answers were encrypted and released after a fixed date."],
      ["LemmaBench", "informal-proof", "research", "research level", "A live benchmark of self-contained lemmas from recent arXiv preprints, judged by LLMs and human experts."],
      ["MiniF2F", "formal-proof", "competition", "competition level", "244 AMC, AIME and IMO problems; Seed-Prover proves 243 of them, and a review found that formal and informal statements disagree in more than half."],
      ["PutnamBench", "formal-proof", "competition", "competition level", "Hundreds of Putnam problems with over a thousand formalizations in Lean 4, Isabelle and Coq."],
      ["CombiBench", "formal-proof", "competition", "school to IMO level", "100 combinatorics problems in Lean 4; the best model tested solved 7 of 100."],
      ["FormalMATH", "formal-proof", "undergraduate", "olympiad to undergraduate", "5,560 Lean 4 problems from high-school olympiads to undergraduate theorems; the strongest models reach 16.46%."],
      ["ProofNet", "formal-proof", "undergraduate", "undergraduate", "371 problems in analysis, algebra and topology, formalized in Lean 3."],
      ["MSC-180", "formal-proof", "graduate", "undergraduate to graduate", "180 Lean 4 problems, three from each of 60 MSC branches; the best overall pass rate is 18.89%."],
      ["AMBER", "formal-proof", "graduate", "undergraduate to PhD level", "Applied mathematics in Lean 4 with a construct-then-verify workflow: convex analysis, optimization, numerical algebra, probability."],
      ["FormalProofBench", "formal-proof", "graduate", "graduate level", "A private VALS AI benchmark pairing natural-language problems with Lean 4 statements; the best foundation model reaches 33.5%."],
      ["LeanEval", "formal-proof", "research", "research level", "The Lean FRO’s Comparator-based benchmark of hard research-level problems, with a live leaderboard."],
      ["LeanOpenProblems", "formal-proof", "research", "open problems", "Epoch AI’s Inspect-based framework for open conjectures in Lean, home to OEIS Open (492 conjectures) and FrontierMath Erdős (68 problems)."],
      ["ProofBench", "formal-proof", "research", "research level, including open problems", "114 problems, mostly in combinatorics and graph theory, 32 of them open; theorem sandwiches guard against mis-formalization, and all systems are evaluated under the same agentic protocol with two-layer Lean grading.", true],
    ];

    body.innerHTML = ROWS.map(([key, a, b]) => {
      const cells = LEVELS.map(([lvl, label]) => {
        const names = B.filter((x) => x[1] === key && x[2] === lvl)
          .map((x) => `<button type="button" class="bm${x[5] ? " bm-us" : ""}" data-bm="${esc(x[0])}">${esc(x[0]).replace(/([a-z])([A-Z][a-z]+)$/, "$1<wbr>$2")}</button>`)
          .join("");
        return `<td data-level="${label}">${names}</td>`;
      }).join("");
      return `<tr><td class="land-format">${a}<i>${b}</i></td>${cells}</tr>`;
    }).join("");

    const note = $("[data-land-note]");
    function select(name) {
      const x = B.find((b) => b[0] === name);
      if (!x) return;
      $$(".bm", body).forEach((b) => b.classList.toggle("is-active", b.dataset.bm === name));
      const row = ROWS.find((r) => r[0] === x[1]);
      note.innerHTML = `<b>${esc(x[0])}</b> <i>(${row[1].toLowerCase()}, ${row[2]}; ${esc(x[3])})</i>. ${esc(x[4])}`;
    }
    body.addEventListener("pointerover", (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); });
    body.addEventListener("focusin", (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); });
    body.addEventListener("click", (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); });
    select("ProofBench");
  })();

  /* ---------------- Figure 3: sandwich ---------------- */
  (function sandwich() {
    const stack = $(".sw-stack");
    if (!stack) return;
    const S = {
      ok: {
        up: ["ok", "✓ implication proved"], down: ["ok", "✓ corollaries derived"],
        desc: "the formal statement the AI system must prove",
        text: "With a correct formalization both implications are proved in Lean, so the statement is pinned from above and below.",
      },
      strong: {
        up: ["bad", "✗ implication unprovable"], down: ["ok", "✓ corollaries still follow"],
        desc: "accidentally too strong, e.g. a hypothesis was dropped",
        text: "A statement that is too strong no longer follows from the key lemmata, so the upper bound cannot be proved and the error surfaces during construction.",
      },
      weak: {
        up: ["ok", "✓ implication proved"], down: ["bad", "✗ corollaries fail"],
        desc: "accidentally too weak, e.g. a quantifier in the wrong place",
        text: "A statement that is too weak no longer yields the known corollaries, so the lower bound fails.",
      },
    };
    function set(k) {
      const s = S[k];
      stack.dataset.state = k;
      [["up", s.up], ["down", s.down]].forEach(([which, [cls, label]]) => {
        const v = $(`[data-verdict="${which}"]`, stack);
        v.className = `sw-verdict ${cls}`;
        v.textContent = label;
        $(`[data-arrow="${which}"]`, stack).classList.toggle("broken", cls === "bad");
      });
      $("[data-sw-desc]").textContent = s.desc;
      $("[data-sw-explain]").textContent = s.text;
      $$("[data-sw]").forEach((b) => {
        b.classList.toggle("is-on", b.dataset.sw === k);
        b.setAttribute("aria-pressed", String(b.dataset.sw === k));
      });
    }
    $$("[data-sw]").forEach((b) => b.addEventListener("click", () => set(b.dataset.sw)));
    set("ok");
  })();

  /* ---------------- Figure 4: session replay ---------------- */
  (function sessions() {
    const row = $("[data-sessions]");
    const log = $("[data-runlog-code]");
    if (!row || !log) return;
    row.innerHTML = Array.from({ length: 10 }, (_, k) => `<li class="sess">S${k + 1}</li>`).join("");
    const cells = $$(".sess", row);
    const L = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;
    const SCRIPT = [
      { s: 0, mark: "working", line: L("log-hl", "session 1") + "   agent drafts lemmas in Submission/" },
      { s: 0, mark: "fail", line: L("log-dim", "  check") + "     " + L("log-bad", "✗ layer 1: declaration uses 'sorry'") },
      { line: L("log-dim", "  handoff") + "   2 lemmas proved · 1 goal open · 1 dead end" },
      { s: 1, mark: "working", line: L("log-hl", "session 2") + "   fresh context, resumes from the handoff note" },
      { s: 1, mark: "fail", line: L("log-dim", "  check") + "     " + L("log-bad", "✗ layer 1: unsolved goals") },
      { s: 2, mark: "working", line: L("log-hl", "session 3") + "   restructures the main argument" },
      { s: 2, mark: "fail", line: L("log-dim", "  check") + "     " + L("log-bad", "✗ layer 1: new axiom introduced, rejected") },
      { s: 3, mark: "working", line: L("log-hl", "session 4") + "   closes the last case" },
      { s: 3, line: L("log-dim", "  check") + "     " + L("log-ok", "✓ layer 1: unchanged · compiles · standard axioms") },
      { s: 3, mark: "pass", line: "            " + L("log-ok", "✓ layer 2: Comparator accepts") },
      { unusedRest: true, line: L("log-dim", "  verdict") + "   " + L("log-ok", "solved") + L("log-dim", "; chain ends, sessions 5–10 unused") },
    ];
    let k = 0, timer = 0, playing = false;
    const apply = (st) => {
      if (st.mark) cells[st.s].className = `sess ${st.mark}`;
      if (st.unusedRest) cells.slice(4).forEach((c) => c.classList.add("unused"));
    };
    function reset() { k = 0; log.innerHTML = ""; cells.forEach((c) => (c.className = "sess")); }
    function step() {
      if (k >= SCRIPT.length) { timer = setTimeout(() => { reset(); step(); }, 6000); return; }
      const st = SCRIPT[k++];
      apply(st);
      log.innerHTML += (log.innerHTML ? "\n" : "") + st.line;
      timer = setTimeout(step, st.mark === "working" ? 1350 : 750);
    }
    if (reduceMotion) {
      SCRIPT.forEach(apply);
      log.innerHTML = SCRIPT.map((s) => s.line).join("\n");
      return;
    }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !playing) { playing = true; reset(); step(); }
      else if (!e.isIntersecting && playing) { playing = false; clearTimeout(timer); }
    }, { threshold: 0.35 }).observe($("#fig-run"));
  })();

  /* ---------------- Table 3: results ---------------- */
  (function results() {
    const el = $("[data-results]");
    if (!el) return;
    const rows = CFG.results || [];
    const body = rows.length
      ? rows.map((r) => `<tr><td>${esc(r.model)}</td><td>${r.search ? "yes" : "no"}</td><td class="num">${r.open}</td><td class="num">${r.research}</td><td class="num">${r.calibration}</td><td class="num">${esc(r.cost || "")}</td></tr>`).join("")
      : `<tr><td class="empty-row" colspan="6">Results will be released with the paper.</td></tr>`;
    el.innerHTML = `
      <table class="booktabs results-table">
        <thead><tr><th>Model</th><th>Web search</th><th class="num">Open (32)</th><th class="num">Research (68)</th><th class="num">Calibration (14)</th><th class="num">Cost</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  })();

  /* ---------------- 5: repositories ---------------- */
  (function repos() {
    const el = $("[data-repos]");
    if (!el) return;
    el.innerHTML = (CFG.repos || []).map((r) => {
      const name = CFG.released
        ? `<a class="repo-name" href="${esc(r.url)}">proof-bench/${esc(r.name)}</a>`
        : `<span class="repo-name">proof-bench/${esc(r.name)}</span>`;
      const status = CFG.released ? "" : ` · ${esc((CFG.releaseLabel || "coming soon").toLowerCase())}`;
      return `
        <dt>${name}<span class="repo-meta">${esc(r.lang)}${status}</span></dt>
        <dd>${esc(r.blurb)} <span class="repo-facts">(${r.facts.map(esc).join("; ")})</span></dd>`;
    }).join("");
  })();

  /* ---------------- title links & citation ---------------- */
  (function paper() {
    const P = CFG.paper || {};
    const abs = P.arxivId ? `https://arxiv.org/abs/${P.arxivId}` : "";
    const pdf = P.pdfUrl || (P.arxivId ? `https://arxiv.org/pdf/${P.arxivId}` : "");
    const link = (label, href, title) =>
      href
        ? `<a class="btn" href="${esc(href)}">${label}</a>`
        : `<span class="btn" aria-disabled="true" title="${esc(title || "")}">${label}</span>`;
    const actions = $("[data-paper-actions]");
    if (actions) {
      actions.innerHTML =
        link(P.arxivId ? `arXiv:${esc(P.arxivId)}` : "arXiv", abs, "Available when the paper is announced") +
        link("PDF", pdf, "Available when the paper is announced") +
        `<a class="btn" href="#code">Code</a>` +
        `<a class="btn" href="#explorer">Problems</a>` +
        `<a class="btn" href="#cite">BibTeX</a>`;
    }

    const bib = [
      "@misc{bajpai2026proofbench,",
      "  title         = {{ProofBench}: A Lean-based Formal Benchmark for {AI} Capabilities in Combinatorics},",
      "  author        = {Bajpai, Vaibhav and Bowler, Nathan and Carmesin, Johannes and Groppe, Jinghua and Groppe, Sven and Okur, Utku},",
      `  year          = {${P.year || 2026}},`,
      ...(P.arxivId
        ? [`  eprint        = {${P.arxivId}},`, "  archivePrefix = {arXiv},", `  url           = {https://arxiv.org/abs/${P.arxivId}}`]
        : ["  note          = {Preprint},", "  url           = {https://proof-bench.github.io}"]),
      "}",
    ].join("\n");
    const code = $("[data-bibtex]");
    if (code) code.textContent = bib;
    $('[data-copy="bibtex"]')?.addEventListener("click", (e) => copy(bib, e.currentTarget));
  })();

  /* ---------------- misc ---------------- */
  const leanSnippet = $("[data-lean]");
  if (leanSnippet) leanSnippet.innerHTML = highlightLean(leanSnippet.textContent);

  const contact = $("[data-contact]");
  if (contact && CFG.contact) {
    contact.href = `mailto:${CFG.contact}?subject=${encodeURIComponent("ProofBench: problem proposal")}`;
    contact.textContent = CFG.contact;
  }

  function copy(text, btn, done = "Copied") {
    const original = btn.textContent;
    const finish = () => { btn.textContent = done; setTimeout(() => (btn.textContent = original), 1500); };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(finish, () => fallback(text, finish));
    } else {
      fallback(text, finish);
    }
  }
  function fallback(text, finish) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); finish(); } catch (e) { /* ignore */ }
    ta.remove();
  }
})();
