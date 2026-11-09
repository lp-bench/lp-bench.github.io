// Front page.
(() => {
  "use strict";
  const { CFG, reduceMotion, $, $$, esc, highlightLean, showTip, hideTip, PROBLEMS, BY_ID, CAT_LABEL, CAT_ORDER } = window.PB;
  const problemUrl = (id) => `problems.html#P${id}`;

  /* ---------- workshop panel under the "Keep exploring" cards ---------- */
  (function workshop() {
    const panel = $("#workshop");
    if (!panel) return;
    const card = $("[data-ws-toggle]");
    const scrollTo = (el) => el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    const set = (open) => {
      panel.hidden = !open;
      if (card) card.setAttribute("aria-expanded", String(open));
    };
    const open = () => { set(true); history.replaceState(null, "", "#workshop"); scrollTo(panel); };
    const close = () => {
      set(false);
      history.replaceState(null, "", location.pathname + location.search);
      if (card) scrollTo(card);
    };
    // Visible without JavaScript; collapsed on load unless the address asks for it.
    set(location.hash === "#workshop");
    if (!panel.hidden) setTimeout(() => scrollTo(panel), 60);
    if (card) card.addEventListener("click", (e) => { e.preventDefault(); panel.hidden ? open() : close(); });
    $$('a[href="#workshop"]:not([data-ws-toggle])').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); open(); }));
    $$("[data-ws-close]", panel).forEach((b) => b.addEventListener("click", close));
    window.addEventListener("hashchange", () => { if (location.hash === "#workshop") { set(true); scrollTo(panel); } });
  })();

  /* ---------- "Propose a problem" form in a dialog ---------- */
  (function proposeForm() {
    const dialog = $("[data-propose]");
    const opener = $("[data-propose-open]");
    // Without any of these the button stays a plain email link.
    if (!dialog || !opener || !dialog.showModal || !CFG.proposeEndpoint) return;
    const form = $("[data-propose-form]", dialog);
    const sent = $("[data-propose-sent]", dialog);
    const status = $("[data-propose-status]", dialog);
    const submit = $('button[type="submit"]', form);
    const contact = [].concat(CFG.contact || []);
    const primary = decodeURIComponent(CFG.proposeEndpoint.split("/").pop());
    const subject = (data) => `LPBench problem proposal: ${data["Problem title"]}`;

    const fields = () => Object.fromEntries(Array.from(new FormData(form)).filter(([, v]) => String(v).trim()));
    const emailLink = (data) => {
      const body = Object.entries(data).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}: ${v}`).join("\n\n");
      return `mailto:${contact.join(",")}?subject=${encodeURIComponent(subject(data))}&body=${encodeURIComponent(body)}`;
    };

    opener.addEventListener("click", (e) => {
      e.preventDefault();
      form.hidden = false;
      sent.hidden = true;
      status.hidden = true;
      dialog.showModal();
    });
    $$("[data-propose-close]", dialog).forEach((b) => b.addEventListener("click", () => dialog.close()));
    // A click on the backdrop closes the form; what was typed stays for the next time it opens.
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const data = fields();
      const label = submit.textContent;
      submit.disabled = true;
      submit.textContent = "Sending…";
      status.hidden = true;
      try {
        const res = await fetch(CFG.proposeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            ...data,
            _subject: subject(data),
            _cc: contact.filter((a) => a.toLowerCase() !== primary.toLowerCase()).join(","),
            _template: "table",
            _captcha: "false",
          }),
        });
        const reply = await res.json();
        // The service answers 200 with success "false" too, for example before the form has been activated.
        if (String(reply.success) !== "true") throw new Error(reply.message);
        $("[data-propose-reply]", sent).textContent = data.email;
        form.reset();
        form.hidden = true;
        sent.hidden = false;
        $("[data-propose-close]", sent).focus();
      } catch (err) {
        status.innerHTML = `Your proposal could not be sent, but your text is still here. <a href="${esc(emailLink(data))}">Send it from your email program instead</a>.`;
        status.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = label;
      }
    });
  })();

  /* ---------- hero: drifting graph ---------- */
  (function heroGraph() {
    const canvas = $(".hero-graph");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const hero = $(".hero");
    let w = 0, h = 0, nodes = [], mouse = null, running = false, raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(80, Math.round((w * h) / 17000));
      nodes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        red: Math.random() < 0.08,
      }));
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      const R = 140;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ffffff";
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < R) {
            ctx.globalAlpha = 0.13 * (1 - d / R);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        if (mouse) {
          const d = Math.hypot(a.x - mouse.x, a.y - mouse.y);
          if (d < 180) {
            ctx.globalAlpha = 0.3 * (1 - d / 180);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
      }
      nodes.forEach((n) => {
        ctx.globalAlpha = n.red ? 0.8 : 0.32;
        ctx.fillStyle = n.red ? "#e0705a" : "#ffffff";
        ctx.beginPath(); ctx.arc(n.x, n.y, n.red ? 2.6 : 1.9, 0, Math.PI * 2); ctx.fill();
      });
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
    resize(); draw();
    window.addEventListener("resize", () => { resize(); draw(); });
    if (reduceMotion) return;
    hero.addEventListener("pointermove", (e) => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    hero.addEventListener("pointerleave", () => { mouse = null; });
    new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (running) raf = requestAnimationFrame(step);
    }).observe(hero);
  })();

  /* ---------- hero: example challenge files ---------- */
  (function showcase() {
    const SHOWCASE = [
      ["042", "theorem P042 : RiemannHypothesis := by\n  sorry"],
      ["076", "theorem P076 :\n    ∃ (G : SimpleGraph (Fin 99)) (_ : DecidableRel G.Adj),\n      G.IsSRGWith 99 14 1 2 := by\n  sorry"],
      ["080", "theorem P080 : ∀ {V : Type u} {V' : Type v} [Fintype V]\n    (G : SimpleGraph V) (G' : SimpleGraph V'),\n    3 ≤ Fintype.card V → G.SameDeck G' →\n    Nonempty (G ≃g G') := by\n  sorry"],
      ["098", "theorem P098 {V : Type} (G : SimpleGraph V) [Fintype V]\n    [DecidableRel G.Adj] {htf : triangle_free G} :\n    Finset.card (G.edgeSet.toFinset) ≤\n      (Fintype.card V)^2 / 4 := by\n  sorry"],
      ["109", "theorem P109 {V : Type*} [Fintype V] (G : SimpleGraph V)\n    [DecidableRel G.Adj] (h : 2 ≤ Fintype.card V) :\n    ∃ u v, u ≠ v ∧ G.degree u = G.degree v := by\n  sorry"],
      ["074", "theorem P074 : ∀ n : ℕ, 0 < n →\n    CollatzReachesOne n := by\n  sorry"],
      ["062", "theorem P062 : ∀ (V : Type u) (E : Type v) [Fintype E]\n    [DecidableEq V] (M : Multigraph V E), M.Bridgeless →\n    ∃ f : E → ZMod 5, M.IsNowhereZeroFlow f := by\n  sorry"],
    ].filter(([id]) => BY_ID[id]);
    const card = $("#showcase");
    const code = $("[data-hero-code]");
    if (!card || !code || !SHOWCASE.length) return;
    let i = 0, timer = 0, paused = false, visible = true;

    function header(k) {
      const [id] = SHOWCASE[k];
      const p = BY_ID[id];
      $("[data-hero-file]").textContent = `P${id}.lean`;
      $("[data-hero-pos]").textContent = `${k + 1} / ${SHOWCASE.length}`;
      $("[data-hero-caption]").textContent = `${p.name} · ${p.cat}`;
      $("[data-hero-link]").href = problemUrl(id);
    }
    function show(k, typed) {
      clearTimeout(timer);
      i = (k + SHOWCASE.length) % SHOWCASE.length;
      header(i);
      const src = SHOWCASE[i][1];
      if (!typed || reduceMotion) {
        code.innerHTML = highlightLean(src);
        schedule(7000);
        return;
      }
      let n = 0;
      const type = () => {
        n = Math.min(src.length, n + (src[n] === " " ? 2 : 1));
        code.innerHTML = highlightLean(src.slice(0, n)) + '<span class="caret"></span>';
        if (n < src.length) timer = setTimeout(type, 16 + Math.random() * 20);
        else schedule(5200);
      };
      type();
    }
    function schedule(ms) {
      clearTimeout(timer);
      if (reduceMotion) return;
      timer = setTimeout(() => {
        if (paused || !visible || document.hidden) { schedule(1500); return; }
        show(i + 1, true);
      }, ms);
    }
    $("[data-hero-prev]").addEventListener("click", () => show(i - 1, false));
    $("[data-hero-next]").addEventListener("click", () => show(i + 1, false));
    card.addEventListener("pointerenter", () => { paused = true; });
    card.addEventListener("pointerleave", () => { paused = false; });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(card);
    show(0, true);
  })();

  /* ---------- hero: counters ---------- */
  (function counters() {
    const stats = $(".stats");
    if (!stats || reduceMotion) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      $$("[data-count]", stats).forEach((el) => {
        const target = Number(el.dataset.count);
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / 1300);
          el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.3 });
    io.observe(stats);
  })();

  /* ---------- problem set: waffle & highlights ---------- */
  const waffle = $(".waffle");
  if (waffle) {
    const ordered = CAT_ORDER.flatMap((c) => PROBLEMS.filter((p) => p.cat === c));
    waffle.innerHTML = ordered
      .map((p) => `<a class="cell" href="${problemUrl(p.id)}" data-id="${p.id}" data-cat="${p.cat}" aria-label="P${p.id}: ${esc(p.name)}, ${CAT_LABEL[p.cat]}"></a>`)
      .join("");
    const tipAt = (c) => {
      const p = BY_ID[c.dataset.id];
      const r = c.getBoundingClientRect();
      showTip(`<span class="tt-meta">P${p.id} · ${CAT_LABEL[p.cat]} · ${esc(p.msc.slice(0, 5))}</span>${esc(p.name)}`, r.left + r.width / 2, r.top);
    };
    waffle.addEventListener("pointerover", (e) => { const c = e.target.closest(".cell"); if (c) tipAt(c); });
    waffle.addEventListener("pointerout", (e) => { if (e.target.closest(".cell")) hideTip(); });
    waffle.addEventListener("focusin", (e) => { const c = e.target.closest(".cell"); if (c) tipAt(c); });
    waffle.addEventListener("focusout", hideTip);
    $$("[data-legend]").forEach((li) => {
      li.addEventListener("pointerenter", () => {
        waffle.classList.add("dim");
        $$(".cell", waffle).forEach((c) => c.classList.toggle("match", c.dataset.cat === li.dataset.legend));
      });
      li.addEventListener("pointerleave", () => waffle.classList.remove("dim"));
    });
  }

  const featured = $("[data-featured]");
  if (featured) {
    featured.innerHTML = ["080", "076", "062", "085"].filter((id) => BY_ID[id]).map((id) => {
      const p = BY_ID[id];
      return `
        <a class="problem-item" href="${problemUrl(id)}">
          <div class="problem-header">
            <span class="problem-title">${esc(p.name)}</span>
            <span class="problem-meta-inline">P${id} · ${esc(p.msc.slice(0, 5))}</span>
          </div>
          <p class="problem-desc"><span class="sw sw-${p.cat}"></span>${CAT_LABEL[p.cat]} · ${esc(p.sub || p.area)}</p>
        </a>`;
    }).join("");
  }

  /* ---------- theorem sandwich ---------- */
  (function sandwich() {
    const stack = $(".sw-stack");
    if (!stack) return;
    const S = {
      ok: {
        up: ["ok", "✓ implication proved"], down: ["ok", "✓ corollaries derived"],
        desc: "The theorem exactly as the AI system receives it.",
        text: "Both checks pass. The key lemmata imply the statement, and the statement implies its known consequences, so it sits exactly where the mathematician intended.",
      },
      strong: {
        up: ["bad", "✗ implication fails"], down: ["ok", "✓ corollaries still follow"],
        desc: "Too strong: a hypothesis has gone missing.",
        text: "The statement now claims more than the key lemmata can deliver, so the upper implication no longer compiles. The mistake is caught while the problem is being built.",
      },
      weak: {
        up: ["ok", "✓ implication proved"], down: ["bad", "✗ corollaries fail"],
        desc: "Too weak: a quantifier has slipped.",
        text: "The statement now claims too little to recover its known consequences, so the lower implication fails. Without this check, a model could earn credit for an easier problem.",
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
        b.classList.toggle("active", b.dataset.sw === k);
        b.setAttribute("aria-pressed", String(b.dataset.sw === k));
      });
    }
    $$("[data-sw]").forEach((b) => b.addEventListener("click", () => set(b.dataset.sw)));
    set("ok");
  })();

  /* ---------- evaluation: session replay ---------- */
  (function sessions() {
    const row = $("[data-sessions]");
    const log = $("[data-runlog]");
    if (!row || !log) return;
    row.innerHTML = Array.from({ length: 10 }, (_, k) => `<li class="sess">S${k + 1}</li>`).join("");
    const cells = $$(".sess", row);
    const L = (cls, s) => `<span class="${cls}">${esc(s)}</span>`;
    const SCRIPT = [
      { s: 0, mark: "working", line: L("log-hl", "session 1") + "   drafts helper lemmas in Submission/" },
      { s: 0, mark: "fail", line: L("log-dim", "  check") + "     " + L("log-bad", "✗ declaration uses 'sorry'") },
      { line: L("log-dim", "  handoff") + "   2 lemmas proved · 1 goal open · 1 dead end noted" },
      { s: 1, mark: "working", line: L("log-hl", "session 2") + "   clean context, resumes from the handoff note" },
      { s: 1, mark: "fail", line: L("log-dim", "  check") + "     " + L("log-bad", "✗ unsolved goals") },
      { s: 2, mark: "working", line: L("log-hl", "session 3") + "   rewrites the main argument" },
      { s: 2, mark: "fail", line: L("log-dim", "  check") + "     " + L("log-bad", "✗ new axiom introduced: rejected") },
      { s: 3, mark: "working", line: L("log-hl", "session 4") + "   closes the final case" },
      { s: 3, line: L("log-dim", "  check") + "     " + L("log-ok", "✓ statement unchanged · compiles · standard axioms") },
      { s: 3, mark: "pass", line: "            " + L("log-ok", "✓ Comparator replays the proof") },
      { rest: true, line: L("log-dim", "  verdict") + "   " + L("log-ok", "solved") + L("log-dim", " · sessions 5–10 not needed") },
    ];
    let k = 0, timer = 0, playing = false;
    const apply = (st) => {
      if (st.mark) cells[st.s].className = `sess ${st.mark}`;
      if (st.rest) cells.slice(4).forEach((c) => c.classList.add("unused"));
    };
    const reset = () => { k = 0; log.innerHTML = ""; cells.forEach((c) => (c.className = "sess")); };
    function step() {
      if (k >= SCRIPT.length) { timer = setTimeout(() => { reset(); step(); }, 6000); return; }
      const st = SCRIPT[k++];
      apply(st);
      log.innerHTML += (log.innerHTML ? "\n" : "") + st.line;
      timer = setTimeout(step, st.mark === "working" ? 1350 : 750);
    }
    if (reduceMotion) { SCRIPT.forEach(apply); log.innerHTML = SCRIPT.map((s) => s.line).join("\n"); return; }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !playing) { playing = true; reset(); step(); }
      else if (!e.isIntersecting && playing) { playing = false; clearTimeout(timer); }
    }, { threshold: 0.35 }).observe($("#run"));
  })();

  /* ---------- landscape ---------- */
  (function landscape() {
    const body = $("[data-landscape]");
    if (!body) return;
    const ROWS = [["answer", "Informal", "final answer"], ["iproof", "Informal", "proof-based"], ["fproof", "Formal", "proof-based"]];
    const LEVELS = [["competition", "Competition"], ["undergraduate", "Undergraduate"], ["graduate", "Graduate"], ["research", "Research"]];
    const B = [
      ["HLE", "answer", "graduate", "Thousands of expert-level questions across many disciplines, designed to resist memorization and web lookup."],
      ["FrontierMath", "answer", "research", "Original, very hard problems from across modern mathematics, each with an automatically checkable numerical answer."],
      ["RealMath", "answer", "research", "A continuously refreshed set of questions drawn from new papers and forum posts, scored on verifiable answers."],
      ["LiveMathematicianBench", "answer", "research", "Multiple-choice questions built from recent arXiv papers, with deliberately plausible wrong options."],
      ["ProofBench (Ma et al.)", "iproof", "competition", "Expert-graded natural-language proofs of competition problems, used to evaluate proof graders. Unrelated to this project despite the name."],
      ["IMProofBench", "iproof", "research", "Peer-reviewed research problems whose proofs are graded by the mathematicians who posed them."],
      ["FirstProof", "iproof", "research", "A small set of unpublished research questions whose answers were sealed until a fixed release date."],
      ["LemmaBench", "iproof", "research", "Self-contained lemmas extracted from fresh arXiv preprints, judged by both LLMs and experts."],
      ["MiniF2F", "fproof", "competition", "Olympiad-style problems in several proof assistants. Now almost fully solved by the strongest provers."],
      ["PutnamBench", "fproof", "competition", "Putnam competition problems formalized in Lean 4, Isabelle and Coq."],
      ["CombiBench", "fproof", "competition", "Combinatorics problems in Lean 4, from school level to the IMO."],
      ["FormalMATH", "fproof", "undergraduate", "A large Lean 4 collection ranging from olympiad problems to undergraduate theorems."],
      ["ProofNet", "fproof", "undergraduate", "Undergraduate analysis, algebra and topology, formalized in Lean 3."],
      ["MSC-180", "fproof", "graduate", "Lean 4 problems sampled across sixty branches of the Mathematics Subject Classification."],
      ["AMBER", "fproof", "graduate", "Applied mathematics in Lean 4, where solutions must be constructed before they are verified."],
      ["FormalProofBench", "fproof", "graduate", "Graduate-level problems paired with Lean 4 statements, kept private."],
      ["LeanEval", "fproof", "research", "The Lean FRO’s research-level formalization benchmark, scored with Comparator."],
      ["Formal Conjectures", "fproof", "research", "Google DeepMind’s open collection of research-level problems in Lean 4, maintained by a community of contributors, with over a thousand open conjectures."],
      ["ArXivLean", "fproof", "research", "Research problems drawn from recent arXiv papers and formalized in Lean, refreshed every three months by a team at ETH Zurich and INSAIT."],
      ["LPBench", "fproof", "research", "Research-level combinatorics and graph theory in Lean 4, including 32 open problems, with statements guarded by theorem sandwiches and a single evaluation protocol for every model.", true],
    ];
    body.innerHTML = ROWS.map(([key, a, b]) => {
      const cells = LEVELS.map(([lvl, label]) => {
        const names = B.filter((x) => x[1] === key && x[2] === lvl)
          .map((x) => `<button type="button" class="bm${x[4] ? " bm-us" : ""}" data-bm="${esc(x[0])}">${esc(x[0]).replace(/([a-z])([A-Z][a-z]+)$/, "$1<wbr>$2")}</button>`)
          .join("");
        return `<td data-level="${label}">${names}</td>`;
      }).join("");
      return `<tr><td class="fmt">${a}<i>${b}</i></td>${cells}</tr>`;
    }).join("");
    const note = $("[data-land-note]");
    function select(name) {
      const x = B.find((b) => b[0] === name);
      if (!x) return;
      $$(".bm", body).forEach((b) => b.classList.toggle("is-active", b.dataset.bm === name));
      const row = ROWS.find((r) => r[0] === x[1]);
      const lvl = LEVELS.find((l) => l[0] === x[2])[1];
      note.innerHTML = `<b>${esc(x[0])}</b> <i>· ${row[1].toLowerCase()} ${row[2]} · ${lvl.toLowerCase()} level</i><br>${esc(x[3])}`;
    }
    ["pointerover", "focusin", "click"].forEach((ev) => body.addEventListener(ev, (e) => { const b = e.target.closest(".bm"); if (b) select(b.dataset.bm); }));
    select("LPBench");
  })();

  /* ---------- leaderboard ---------- */
  (function leaderboard() {
    const body = $("[data-results]");
    if (!body) return;
    const rows = (CFG.results || []).map((r) => ({ ...r, total: (r.open || 0) + (r.research || 0) + (r.calibration || 0) }));
    function render(key) {
      if (!rows.length) {
        body.innerHTML = `<tr><td class="empty-row" colspan="8">Results will be published with the paper.</td></tr>`;
        return;
      }
      body.innerHTML = rows.slice().sort((a, b) => b[key] - a[key]).map((r, i) => `
        <tr><td>${i + 1}</td><td>${esc(r.model)}</td><td>${r.search ? "yes" : "no"}</td>
        <td class="num">${r.open}</td><td class="num">${r.research}</td><td class="num">${r.calibration}</td>
        <td class="num"><b>${r.total}</b></td><td class="num">${esc(r.cost || "")}</td></tr>`).join("");
    }
    $$("[data-rank]").forEach((b) => b.addEventListener("click", () => {
      $$("[data-rank]").forEach((x) => x.classList.toggle("active", x === b));
      render(b.dataset.rank);
    }));
    render("total");
  })();

  /* ---------- repositories ---------- */
  (function repos() {
    const el = $("[data-repos]");
    if (!el) return;
    el.innerHTML = (CFG.repos || []).map((r) => {
      const tag = CFG.released ? "a" : "article";
      const href = CFG.released ? ` href="${esc(r.url)}"` : "";
      const status = CFG.released ? "View on GitHub →" : "Public with the paper";
      return `
        <${tag} class="problem-item"${href}>
          <span class="problem-meta-inline">lp-bench / ${esc(r.lang)}</span>
          <span class="repo-name">${esc(r.name)}</span>
          <span class="repo-blurb">${esc(r.blurb)}</span>
          <span class="repo-facts">${esc(r.facts)}</span>
          <span class="repo-status">${status}</span>
        </${tag}>`;
    }).join("");
  })();
})();
