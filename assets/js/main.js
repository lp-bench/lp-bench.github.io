(() => {
  "use strict";

  const CFG = window.PB_CONFIG || {};
  const PROBLEMS = (window.PB_PROBLEMS || []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const BY_ID = Object.fromEntries(PROBLEMS.map((p) => [p.id, p]));
  const STATEMENTS_REPO = "https://github.com/proof-bench/proofbench-statements";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CAT_LABEL = { open: "Open", research: "Research", calibration: "Calibration" };
  const CAT_ORDER = ["open", "research", "calibration"];

  document.documentElement.classList.add("js");

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

  /* ---------------- theme ---------------- */
  $(".theme-toggle")?.addEventListener("click", () => {
    const root = document.documentElement;
    const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("pb-theme", next); } catch (e) { /* storage unavailable */ }
  });

  /* ---------------- nav ---------------- */
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const navLinks = $$(".nav-links a");
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  navLinks.forEach((a) => {
    const target = $(a.getAttribute("href"));
    if (target) sectionObserver.observe(target);
  });

  /* ---------------- reveal & counters ---------------- */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        revealObserver.unobserve(e.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px" }
  );
  $$(".reveal").forEach((el) => revealObserver.observe(el));

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (reduceMotion || !target) return;
    const start = performance.now();
    const dur = 1300;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    el.textContent = "0";
    requestAnimationFrame(tick);
  }
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      $$("[data-count]", e.target).forEach(countUp);
      statsObserver.unobserve(e.target);
    });
  }, { threshold: 0.4 });
  const stats = $(".stats");
  if (stats) statsObserver.observe(stats);

  /* ---------------- tooltip ---------------- */
  const tip = $(".tooltip");
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    const left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
    const top = y - r.height - 12 < 8 ? y + 18 : y - r.height - 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  /* ---------------- hero graph canvas ---------------- */
  (function heroGraph() {
    const canvas = $(".hero-graph");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, nodes = [], mouse = null, running = false, raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(70, Math.round((w * h) / 21000));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      }));
    }

    function draw() {
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim() || "#1d1b16";
      ctx.clearRect(0, 0, w, h);
      const R = 132;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < R) {
            ctx.globalAlpha = 0.16 * (1 - d / R);
            ctx.strokeStyle = ink;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (mouse) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 170) {
            ctx.globalAlpha = 0.28 * (1 - d / 170);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = ink;
      nodes.forEach((n) => { ctx.beginPath(); ctx.arc(n.x, n.y, 2.1, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }

    function step() {
      nodes.forEach((n) => {
        n.x += n.vx; n.y += n.vy;
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
      });
      draw();
      if (running) raf = requestAnimationFrame(step);
    }

    resize();
    draw();
    window.addEventListener("resize", () => { resize(); draw(); });
    if (reduceMotion) return;
    const hero = $(".hero");
    hero.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    hero.addEventListener("pointerleave", () => { mouse = null; });
    new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(step);
    }).observe(hero);
  })();

  /* ---------------- hero editor ---------------- */
  (function heroEditor() {
    const SHOWCASE = [
      ["042", "theorem P042 : RiemannHypothesis := by\n  sorry"],
      ["076", "theorem P076 :\n    ∃ (G : SimpleGraph (Fin 99)) (_ : DecidableRel G.Adj),\n      G.IsSRGWith 99 14 1 2 := by\n  sorry"],
      ["027", "theorem P027 {V : Type*} [Finite V] (G : OrientedGraph V) :\n    ∃ v, (G.outNeighborhood v).ncard ≤\n      (G.secondOutNeighborhood v).ncard := by\n  sorry"],
      ["080", "theorem P080 : ∀ {V : Type u} {V' : Type v} [Fintype V]\n    (G : SimpleGraph V) (G' : SimpleGraph V'),\n    3 ≤ Fintype.card V → G.SameDeck G' →\n    Nonempty (G ≃g G') := by\n  sorry"],
      ["109", "theorem P109 {V : Type*} [Fintype V] (G : SimpleGraph V)\n    [DecidableRel G.Adj] (h : 2 ≤ Fintype.card V) :\n    ∃ u v, u ≠ v ∧ G.degree u = G.degree v := by\n  sorry"],
      ["074", "theorem P074 : ∀ n : ℕ, 0 < n →\n    CollatzReachesOne n := by\n  sorry"],
      ["062", "theorem P062 : ∀ (V : Type u) (E : Type v) [Fintype E]\n    [DecidableEq V] (M : Multigraph V E), M.Bridgeless →\n    ∃ f : E → ZMod 5, M.IsNowhereZeroFlow f := by\n  sorry"],
    ].filter(([id]) => BY_ID[id]);

    const codeEl = $("[data-hero-code]");
    const fileEl = $("[data-hero-file]");
    const capEl = $("[data-hero-caption]");
    const linkEl = $("[data-hero-link]");
    if (!codeEl || !SHOWCASE.length) return;

    let i = 0, timer = 0, visible = true;

    function caption(p) {
      const status = p.resolved ? `${CAT_LABEL[p.cat]} · ${p.resolved} Oct 2026` : CAT_LABEL[p.cat];
      return `${p.name} · ${status}`;
    }

    function show(k, typed) {
      const [id, src] = SHOWCASE[k];
      const p = BY_ID[id];
      fileEl.textContent = `P${id}.lean`;
      capEl.textContent = caption(p);
      linkEl.href = `#P${id}`;
      linkEl.onclick = (e) => { e.preventDefault(); openProblem(id); };
      if (!typed || reduceMotion) {
        codeEl.innerHTML = highlightLean(src);
        timer = setTimeout(next, reduceMotion ? 6000 : 4200);
        return;
      }
      let n = 0;
      const type = () => {
        if (!visible) { timer = setTimeout(type, 400); return; }
        n = Math.min(src.length, n + (src[n] === " " ? 2 : 1));
        codeEl.innerHTML = highlightLean(src.slice(0, n)) + '<span class="caret"></span>';
        if (n < src.length) timer = setTimeout(type, 18 + Math.random() * 22);
        else timer = setTimeout(next, 4200);
      };
      type();
    }

    function next() {
      i = (i + 1) % SHOWCASE.length;
      show(i, true);
    }

    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(codeEl);
    show(0, true);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { clearTimeout(timer); } else { clearTimeout(timer); show(i, false); }
    });
  })();

  /* ---------------- waffle ---------------- */
  const waffle = $(".waffle");
  if (waffle) {
    const ordered = CAT_ORDER.flatMap((c) => PROBLEMS.filter((p) => p.cat === c));
    waffle.innerHTML = ordered
      .map((p) => `<button class="cell${p.resolved ? " resolved" : ""}" data-id="${p.id}" data-cat="${p.cat}" aria-label="P${p.id}: ${esc(p.name)}, ${CAT_LABEL[p.cat]}"></button>`)
      .join("");
    const tipFor = (p) =>
      `<span class="tt-meta">P${p.id} · ${CAT_LABEL[p.cat]}${p.resolved ? ` · ${p.resolved} Oct 2026` : ""} · ${esc(p.msc.slice(0, 5))}</span><b>${esc(p.name)}</b>`;
    waffle.addEventListener("pointerover", (e) => {
      const c = e.target.closest(".cell");
      if (!c) return;
      const r = c.getBoundingClientRect();
      showTip(tipFor(BY_ID[c.dataset.id]), r.left + r.width / 2, r.top);
    });
    waffle.addEventListener("pointerout", (e) => { if (e.target.closest(".cell")) hideTip(); });
    waffle.addEventListener("focusin", (e) => {
      const c = e.target.closest(".cell");
      if (!c) return;
      const r = c.getBoundingClientRect();
      showTip(tipFor(BY_ID[c.dataset.id]), r.left + r.width / 2, r.top);
    });
    waffle.addEventListener("focusout", hideTip);
    waffle.addEventListener("click", (e) => {
      const c = e.target.closest(".cell");
      if (c) { hideTip(); openProblem(c.dataset.id); }
    });
    $$(".waffle-card .legend li").forEach((li, k) => {
      const cat = CAT_ORDER[k];
      li.addEventListener("pointerenter", () => {
        waffle.classList.add("dim");
        $$(".cell", waffle).forEach((c) => c.classList.toggle("match", c.dataset.cat === cat));
      });
      li.addEventListener("pointerleave", () => waffle.classList.remove("dim"));
    });
  }

  /* ---------------- explorer ---------------- */
  const list = $("[data-list]");
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
    const fileLink = CFG.released
      ? `<a href="${STATEMENTS_REPO}/blob/main/${file}">${file}</a>`
      : `<span>${file}</span>`;
    const disprove = p.cat === "open" ? `<span>+ P${p.id}_DISPROVE.lean (negation)</span>` : "";
    return `
      <p>${esc(p.summary)}</p>
      ${p.note ? `<p class="note">${esc(p.note.charAt(0).toUpperCase() + p.note.slice(1))}.</p>` : ""}
      <div class="code-block">
        <button class="copy-btn" type="button" data-copy-lean="${p.id}">Copy</button>
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
          <span class="p-name">${esc(p.name)}${p.resolved ? `<span class="p-res">${p.resolved} 2026</span>` : ""}</span>
          <span class="p-area">${esc(p.area)}</span>
          <span class="p-cat"><span class="sw sw-${p.cat}"></span>${CAT_LABEL[p.cat]}</span>
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
      : `<li class="empty">No problem matches “${esc(state.q)}”. Try a broader term, such as <em>colouring</em>, <em>matroid</em> or <em>Ramsey</em>.</li>`;
    const more = $("[data-more]");
    more.hidden = shown.length >= hits.length;
    more.textContent = `Show all ${hits.length} problems`;
    $("[data-count-label]").textContent = filtered
      ? `${hits.length} of ${PROBLEMS.length} problems`
      : `${PROBLEMS.length} problems · showing ${shown.length}`;
  }

  if (list) {
    $("[data-search]").addEventListener("input", (e) => { state.q = e.target.value.trim(); renderList(); });
    $("[data-area]").addEventListener("change", (e) => { state.area = e.target.value; renderList(); });
    $$("[data-cat]", $(".explorer")).forEach((b) =>
      b.addEventListener("click", () => {
        state.cat = b.dataset.cat;
        $$("[data-cat]", $(".explorer")).forEach((x) => {
          x.classList.toggle("is-on", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
        renderList();
      })
    );
    $("[data-more]").addEventListener("click", () => { state.all = true; renderList(); });
    list.addEventListener("click", (e) => {
      const t = e.target.closest("[data-toggle]");
      if (t) {
        const id = t.dataset.toggle;
        state.open.has(id) ? state.open.delete(id) : state.open.add(id);
        const li = t.closest("li");
        li.outerHTML = rowHTML(BY_ID[id]);
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
    const p = BY_ID[id];
    if (!matches(p)) {
      state.q = ""; state.cat = "all"; state.area = "all";
      $("[data-search]").value = "";
      $("[data-area]").value = "all";
      $$("[data-cat]", $(".explorer")).forEach((x) => {
        const on = x.dataset.cat === "all";
        x.classList.toggle("is-on", on);
        x.setAttribute("aria-pressed", String(on));
      });
    }
    state.all = true;
    state.open.add(id);
    renderList();
    $("#explorer").classList.add("in");
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

  /* ---------------- landscape ---------------- */
  (function landscape() {
    const grid = $(".land-grid");
    if (!grid) return;
    const ROWS = [
      ["informal-answer", "Informal", "final answer"],
      ["informal-proof", "Informal", "proof"],
      ["formal-proof", "Formal", "proof, machine-checked"],
    ];
    const LEVELS = ["competition", "undergraduate", "graduate", "research"];
    const B = [
      ["HLE", "informal-answer", "graduate", "Expert level, multidisciplinary", "Humanity’s Last Exam: thousands of expert-level multiple-choice and short-answer questions, not only in mathematics, built to resist memorization and internet lookup."],
      ["FrontierMath", "informal-answer", "research", "Research level", "Hundreds of original, exceptionally hard problems across most branches of modern mathematics. The answer is a Python object, typically a natural number, and is checked automatically."],
      ["RealMath", "informal-answer", "research", "Research level", "A continuous benchmark built from new arXiv papers and Stack Exchange to limit contamination. It evaluates verifiable answers rather than proofs."],
      ["LiveMathematicianBench", "informal-answer", "research", "Research level", "Multiple choice from recent arXiv papers, with plausible distractors that are false or too weak. The best reported model reaches 43.5%."],
      ["ProofBench (Ma et al.)", "informal-proof", "competition", "Competition level", "435 expert-graded natural-language proofs for 145 competition problems. Despite the shared name, it evaluates proof graders rather than provers."],
      ["IMProofBench", "informal-proof", "research", "Research level", "39 peer-reviewed research problems, each proof graded by the problem’s author. In the agentic setting, GPT-5 writes 22% fully correct proofs."],
      ["FirstProof", "informal-proof", "research", "Research level", "Ten original, unpublished questions from the authors’ own research. The answers were encrypted and released after a fixed date."],
      ["LemmaBench", "informal-proof", "research", "Research level", "A live benchmark of self-contained lemmas from recent arXiv preprints, judged by LLMs and human experts."],
      ["MiniF2F", "formal-proof", "competition", "Competition level", "244 AMC, AIME and IMO problems. Seed-Prover proves 243 of them, and a review found that formal and informal statements disagree in more than half."],
      ["PutnamBench", "formal-proof", "competition", "Competition level", "Hundreds of Putnam problems with over a thousand formalizations in Lean 4, Isabelle and Coq."],
      ["CombiBench", "formal-proof", "competition", "School to IMO level", "100 combinatorics problems in Lean 4. The best model tested solved 7 of 100."],
      ["FormalMATH", "formal-proof", "undergraduate", "Olympiad to undergraduate", "5,560 Lean 4 problems from high-school olympiads to undergraduate theorems. The strongest models reach 16.46%."],
      ["ProofNet", "formal-proof", "undergraduate", "Undergraduate", "371 problems in analysis, algebra and topology, formalized in Lean 3."],
      ["MSC-180", "formal-proof", "graduate", "Undergraduate to graduate", "180 Lean 4 problems, three from each of 60 MSC branches. The best overall pass rate is 18.89%."],
      ["AMBER", "formal-proof", "graduate", "Undergraduate to PhD level", "Applied mathematics in Lean 4 with a construct-then-verify workflow: convex analysis, optimization, numerical algebra, probability."],
      ["FormalProofBench", "formal-proof", "graduate", "Graduate level", "A private VALS AI benchmark that pairs natural-language problems with Lean 4 statements. The best foundation model reaches 33.5%."],
      ["LeanEval", "formal-proof", "research", "Research level", "The Lean FRO’s Comparator-based benchmark of hard research-level problems, with a live leaderboard. A solution counts only if Comparator accepts it."],
      ["LeanOpenProblems", "formal-proof", "research", "Open problems", "Epoch AI’s Inspect-based framework for open conjectures in Lean, home to OEIS Open (492 conjectures) and FrontierMath Erdős (68 problems)."],
      ["ProofBench", "formal-proof", "research", "Research level · open problems", "114 problems, mostly combinatorics and graph theory, 32 of them open. Theorem sandwiches guard against mis-formalization, and every model gets the same agentic protocol and two-layer Lean grading.", true],
    ];

    const rowsHTML = ROWS.map(([key, a, b]) => {
      const cells = LEVELS.map((lvl) => {
        const chips = B.filter((x) => x[1] === key && x[2] === lvl)
          .map((x) => `<button class="bm${x[5] ? " bm-us" : ""}" type="button" data-bm="${esc(x[0])}">${esc(x[0]).replace(/([a-z])([A-Z][a-z]+)$/, "$1<wbr>$2")}</button>`)
          .join("");
        return `<div class="land-cell" role="cell" data-level="${lvl}">${chips}</div>`;
      }).join("");
      return `<div class="land-row is-${key}" role="row"><div class="land-label" role="rowheader"><b>${a}</b>${b}</div>${cells}</div>`;
    }).join("");
    grid.insertAdjacentHTML("beforeend", rowsHTML);

    const detail = $(".land-detail");
    function select(name) {
      const x = B.find((b) => b[0] === name);
      if (!x) return;
      $$(".bm", grid).forEach((b) => b.classList.toggle("is-active", b.dataset.bm === name));
      const row = ROWS.find((r) => r[0] === x[1]);
      detail.innerHTML = `
        <p class="land-detail-meta">${row[1]} · ${row[2]} · ${esc(x[3])}</p>
        <p class="land-detail-name">${esc(x[0])}</p>
        <p class="land-detail-text">${esc(x[4])}</p>`;
    }
    grid.addEventListener("pointerover", (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); });
    grid.addEventListener("focusin", (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); });
    grid.addEventListener("click", (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); });
    select("ProofBench");
  })();

  /* ---------------- sandwich ---------------- */
  (function sandwich() {
    const stack = $(".sw-stack");
    if (!stack) return;
    const S = {
      ok: {
        up: ["ok", "✓ implication proved"], down: ["ok", "✓ corollaries derived"],
        desc: "The formal statement the AI system must prove.",
        text: "Both implications check out in Lean. The statement is pinned from above and below, so it is unlikely to drift from what the mathematician meant.",
      },
      strong: {
        up: ["bad", "✗ implication unprovable"], down: ["ok", "✓ corollaries still follow"],
        desc: "Accidentally too strong, e.g. a hypothesis was dropped.",
        text: "A statement that is too strong no longer follows from the key lemmata. The upper bound cannot be proved, so the error surfaces while the problem is built, not after a model has been graded on it.",
      },
      weak: {
        up: ["ok", "✓ implication proved"], down: ["bad", "✗ corollaries fail"],
        desc: "Accidentally too weak, e.g. a quantifier in the wrong place.",
        text: "A statement that is too weak no longer implies the known corollaries, so the lower bound fails. A model could otherwise “solve” a problem that is easier than intended.",
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

  /* ---------------- session replay ---------------- */
  (function sessions() {
    const row = $("[data-sessions]");
    const log = $("[data-runlog-code]");
    if (!row || !log) return;
    row.innerHTML = Array.from({ length: 10 }, (_, k) => `<li class="sess">S${k + 1}</li>`).join("");
    const cells = $$(".sess", row);
    const L = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;
    const SCRIPT = [
      { s: 0, mark: "working", line: L("log-hl", "▸ session 1") + "   agent drafts lemmas in Submission/" },
      { s: 0, mark: "fail", line: L("log-dim", "  check") + "       " + L("log-bad", "✗ layer 1: declaration uses 'sorry'") },
      { line: L("log-dim", "  handoff") + "     2 lemmas proved · 1 goal open · 1 dead end" },
      { s: 1, mark: "working", line: L("log-hl", "▸ session 2") + "   fresh context, resumes from the handoff note" },
      { s: 1, mark: "fail", line: L("log-dim", "  check") + "       " + L("log-bad", "✗ layer 1: unsolved goals") },
      { s: 2, mark: "working", line: L("log-hl", "▸ session 3") + "   restructures the main argument" },
      { s: 2, mark: "fail", line: L("log-dim", "  check") + "       " + L("log-bad", "✗ layer 1: new axiom introduced, rejected") },
      { s: 3, mark: "working", line: L("log-hl", "▸ session 4") + "   closes the last case" },
      { s: 3, line: L("log-dim", "  check") + "       " + L("log-ok", "✓ layer 1: unchanged · compiles · standard axioms") },
      { s: 3, mark: "pass", line: "              " + L("log-ok", "✓ layer 2: Comparator accepts") },
      { skipRest: true, line: L("log-dim", "  verdict") + "     " + L("log-ok", "SOLVED") + L("log-dim", " · chain ends, sessions 5–10 unused") },
    ];
    let k = 0, timer = 0, playing = false;
    function reset() {
      k = 0; log.innerHTML = "";
      cells.forEach((c) => (c.className = "sess"));
    }
    function stepRun() {
      if (k >= SCRIPT.length) { timer = setTimeout(() => { reset(); stepRun(); }, 5200); return; }
      const st = SCRIPT[k++];
      if (st.mark) cells[st.s].className = `sess ${st.mark}`;
      if (st.skipRest) cells.slice(4).forEach((c) => c.classList.add("unused"));
      log.innerHTML += (log.innerHTML ? "\n" : "") + st.line;
      timer = setTimeout(stepRun, st.mark === "working" ? 1350 : 750);
    }
    if (reduceMotion) {
      SCRIPT.forEach((st) => {
        if (st.mark) cells[st.s].className = `sess ${st.mark}`;
        if (st.skipRest) cells.slice(4).forEach((c) => c.classList.add("unused"));
      });
      log.innerHTML = SCRIPT.map((s) => s.line).join("\n");
      return;
    }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !playing) { playing = true; reset(); stepRun(); }
      else if (!e.isIntersecting && playing) { playing = false; clearTimeout(timer); }
    }, { threshold: 0.35 }).observe($(".run"));
  })();

  /* ---------------- results ---------------- */
  (function results() {
    const el = $("[data-results]");
    if (!el) return;
    const rows = CFG.results || [];
    $("[data-results-note]").textContent = "Solved problems by category. An open problem counts when the statement or its negation is proved.";
    if (!rows.length) {
      el.innerHTML = `
        <div class="results-empty">
          <p class="big">Evaluation runs are under way.</p>
          <p>The first results will be published here with the paper.</p>
          <table class="ghost-table" aria-hidden="true">
            <thead><tr><th>Model</th><th>Search</th><th>Open</th><th>Research</th><th>Calibration</th><th>Cost</th></tr></thead>
            <tbody>${"<tr>" + "<td><span></span></td>".repeat(6) + "</tr>"}${"<tr>" + "<td><span></span></td>".repeat(6) + "</tr>"}</tbody>
          </table>
        </div>`;
      return;
    }
    el.innerHTML = `
      <div class="lb-wrap"><table class="lb">
        <thead><tr><th>Model</th><th>Search</th><th>Open / 32</th><th>Research / 68</th><th>Calibration / 14</th><th>Cost</th><th>Date</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.model)}</td><td>${r.search ? "on" : "off"}</td><td>${r.open}</td><td>${r.research}</td><td>${r.calibration}</td><td>${esc(r.cost || "")}</td><td>${esc(r.date || "")}</td></tr>`).join("")}</tbody>
      </table></div>`;
  })();

  /* ---------------- repos ---------------- */
  (function repos() {
    const el = $("[data-repos]");
    if (!el) return;
    const GH = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';
    const DOT = { "Lean 4": "#6b5bd2", Python: "#3572A5" };
    el.innerHTML = (CFG.repos || []).map((r) => {
      const tag = CFG.released ? "a" : "article";
      const href = CFG.released ? ` href="${esc(r.url)}"` : "";
      const foot = CFG.released ? `<span>View on GitHub →</span>` : `<span class="soon">${esc(CFG.releaseLabel || "Coming soon")}</span>`;
      return `
        <${tag} class="card repo"${href}>
          <div class="repo-top">${GH}<span>proof-bench /</span></div>
          <p class="repo-name">${esc(r.name)}</p>
          <p class="repo-blurb">${esc(r.blurb)}</p>
          <ul class="repo-facts">${r.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
          <div class="repo-foot"><span class="lang-dot" style="--dot:${DOT[r.lang] || "#888"}">${esc(r.lang)}</span>${foot}</div>
        </${tag}>`;
    }).join("");
  })();

  /* ---------------- paper ---------------- */
  (function paper() {
    const P = CFG.paper || {};
    const abs = P.arxivId ? `https://arxiv.org/abs/${P.arxivId}` : "";
    const pdf = P.pdfUrl || (P.arxivId ? `https://arxiv.org/pdf/${P.arxivId}` : "");
    const actions = $("[data-paper-actions]");
    const btn = (label, href, solid) =>
      href
        ? `<a class="btn ${solid ? "btn-solid" : "btn-ghost"}" href="${esc(href)}">${label}</a>`
        : `<span class="btn ${solid ? "btn-solid" : "btn-ghost"}" aria-disabled="true">${label}</span>`;
    if (actions) {
      actions.innerHTML =
        btn(P.arxivId ? `arXiv:${esc(P.arxivId)}` : "arXiv · October 2026", abs, true) +
        btn("PDF", pdf, false) +
        `<a class="btn btn-ghost" href="#code">Code</a>`;
    }
    const cta = $("[data-paper-cta]");
    if (cta && abs) cta.href = abs;

    const bib = [
      "@misc{bajpai2026proofbench,",
      `  title         = {{ProofBench}: A Lean-based Formal Benchmark for {AI} Capabilities in Combinatorics},`,
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
  if (contact && CFG.contact) contact.href = `mailto:${CFG.contact}?subject=${encodeURIComponent("ProofBench: problem proposal")}`;

  function copy(text, btn, done = "Copied ✓") {
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
