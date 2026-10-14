// Ten Challenges page: statements and leaderboard are read live from the project's own sources.
(() => {
  "use strict";
  const { CFG, $, $$, esc } = window.PB;
  const TC = CFG.tenChallenges || {};
  const SITE = TC.site || "https://tenchallenges.github.io/ten-challenges/";
  const REPO = TC.submissionsRepo || "utkuokur/ten-challenges-submissions";
  const LEADERBOARD = `https://raw.githubusercontent.com/${REPO}/main/site-data/leaderboard.json`;

  const CHALLENGES = [
    { n: 1, title: "The Hadwiger Conjecture", desc: "Every graph without a <i>K</i><sub><i>r</i>+1</sub> minor can be properly coloured with <i>r</i> colours. Known for <i>r</i>&nbsp;≤&nbsp;5; the case <i>r</i>&nbsp;=&nbsp;4 is equivalent to the Four Colour Theorem." },
    { n: 2, title: "Excluded Minors of GF(pᵐ)-representable matroids", desc: "Give an explicit bound <i>B</i> on the number of excluded minors for matroids representable over each finite field with at most <i>r</i> elements." },
    { n: 3, title: "Caccetta–Häggkvist Conjecture", desc: "Every digraph on <i>n</i> vertices with minimum out-degree at least <i>r</i> has a directed cycle of length at most ⌈<i>n</i>/<i>r</i>⌉. Known for <i>r</i>&nbsp;≤&nbsp;5." },
    { n: 4, title: "Sidorenko Conjecture for Bipartite Graphs with Bounded Sides", desc: "Sidorenko’s inequality for every bipartite graph <i>H</i> whose two sides have at most <i>r</i> vertices each." },
    { n: 5, title: "Erdős–Hajnal Conjecture for paths", desc: "Graphs with no induced path on <i>r</i> vertices contain a clique or an independent set of polynomial size. Known up to <i>r</i>&nbsp;=&nbsp;5." },
    { n: 6, title: "Better-Quasi-Ordering of Finite Graphs under Minor Relation", desc: "Finite graphs are well-quasi-ordered by minors at ever higher ordinal levels <i>r</i>: even levels concern planar graphs, odd levels all finite graphs." },
    { n: 7, title: "Sphere Packing Problem", desc: "Is the densest sphere packing in dimension <i>r</i> achieved by a lattice? Known only for <i>r</i>&nbsp;∈&nbsp;{1, 2, 3, 8, 24}." },
    { n: 8, title: "Ryser's Hypergraph Conjecture", desc: "Every <i>r</i>-partite <i>r</i>-uniform hypergraph has a vertex cover at most <i>r</i>&nbsp;−&nbsp;1 times the size of its largest matching. Known for <i>r</i>&nbsp;≤&nbsp;3." },
    { n: 9, title: "Union-Closed Sets Conjecture", desc: "Every finite union-closed family has an element lying in at least a 1/2 − 1/(<i>r</i>+2) fraction of its sets. Settled for <i>r</i>&nbsp;≤&nbsp;6." },
    { n: 10, title: "Unfriendly Partition Conjecture", desc: "Partitioner wins the <i>r</i>-partitioning game on every countable graph: an ordinal ladder towards unfriendly partitions of all countable graphs." },
  ].map((c) => ({ ...c, id: `challenge_${c.n}`, path: `content/html/challenge_${String(c.n).padStart(2, "0")}.html` }));
  const ORDINAL = new Set(["challenge_6", "challenge_10"]);
  const NUMERIC_RANK = new Set(["challenge_1", "challenge_3", "challenge_4", "challenge_5", "challenge_7", "challenge_8", "challenge_9"]);

  let entries = [];
  let active = null;
  let tab = "all";
  const statementCache = new Map();

  /* ---------- header bits ---------- */
  const versions = $("[data-tc-versions]");
  if (versions) versions.innerHTML = `Lean ${esc(TC.lean || "")} · Mathlib <code>${esc((TC.mathlib || "").slice(0, 12))}</code>`;
  $$("[data-tc-site]").forEach((a) => (a.href = SITE));
  $$("[data-tc-problems]").forEach((a) => (a.href = TC.problemsRepo || a.href));
  $("[data-tc-policy]").href = `https://github.com/${REPO}/blob/main/docs/maintenance-policy.md`;
  const contact = $("[data-tc-contact]");
  if (contact) {
    const mails = (TC.contacts || []).map((m) => `<a href="mailto:${esc(m)}">${esc(m)}</a>`).join(" or ");
    contact.innerHTML = `Questions and suggestions about Ten Challenges are welcome at ${mails}.`;
  }

  /* ---------- ordinal comparison (Cantor normal form) ---------- */
  function cmpCnf(a, b) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = cmpCnf(a[i].exponent, b[i].exponent);
      if (c !== 0) return c;
      if (a[i].coefficient !== b[i].coefficient) return a[i].coefficient < b[i].coefficient ? -1 : 1;
    }
    return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
  }
  function parseCnf(raw) {
    let budget = 4096;
    const walk = (node, depth) => {
      if (!Array.isArray(node) || depth > 128) return null;
      const out = [];
      for (const term of node) {
        if (--budget < 0 || !Array.isArray(term) || term.length !== 2) return null;
        const [exp, coef] = term;
        if (typeof coef !== "string" || coef.length > 1300 || !/^[1-9][0-9]*$/.test(coef)) return null;
        const e = walk(exp, depth + 1);
        if (e === null || (out.length > 0 && cmpCnf(out[out.length - 1].exponent, e) <= 0)) return null;
        out.push({ exponent: e, coefficient: BigInt(coef) });
      }
      return out;
    };
    return walk(raw, 0);
  }
  const bigOrNull = (v) => { const t = String(v ?? "").trim(); return /^[0-9]+$/.test(t) ? BigInt(t) : null; };
  const baseId = (problem) => String(problem || "").replace(/_(univ|disprove)$/, "");

  /* ---------- per-challenge progress line ---------- */
  function progress(c) {
    const label = ORDINAL.has(c.id) ? "latest r" : "largest r so far";
    if (entries.some((e) => e.problem === `${c.id}_univ` && e.claim === "prove")) return `${label}: all r`;
    const proofs = entries.filter((e) => e.problem === c.id && e.claim === "prove");
    if (ORDINAL.has(c.id)) {
      const latest = proofs.reduce((best, e) => (!best || e.rank > best.rank ? e : best), null);
      return `${label}: ${latest ? `r = ${latest.parameter}` : "N/A"}`;
    }
    let r = null, bound = null;
    for (const e of proofs) {
      const v = bigOrNull(e.parameter);
      if (v === null) continue;
      const b = bigOrNull(e.bound);
      if (r === null || v > r) { r = v; bound = b; }
      else if (v === r && b !== null && (bound === null || b < bound)) bound = b;
    }
    const extra = c.id === "challenge_2" && bound !== null ? ` (B = ${bound})` : "";
    return `${label}: ${r === null ? "N/A" : `r = ${r}${extra}`}`;
  }

  /* ---------- challenge list ---------- */
  const list = $("[data-tc-list]");
  function renderList() {
    list.innerHTML = CHALLENGES.map((c) => {
      const on = active === c.id;
      return `
        <div class="problem-item${on ? " active" : ""}" id="${c.id}" data-open="${c.id}" role="button" tabindex="0" aria-expanded="${on}">
          <div class="problem-header">
            <span class="problem-title">${c.n}. ${esc(c.title)}</span>
            <span class="problem-meta-inline">${esc(progress(c))}</span>
          </div>
          <p class="problem-desc">${c.desc}</p>
        </div>
        ${on ? `<div class="detail-panel"><span class="back tt" data-close role="button" tabindex="0">← back to list</span><div class="statement" data-statement><p class="loading">Loading the statement…</p></div>
          <div class="info-box"><p class="info-box-label">Source</p><p>Statement from <a href="${SITE}${c.path}">tenchallenges.github.io</a>. The Lean formalization lives in <a href="${esc(TC.problemsRepo || "#")}">TenChallenges/ten-challenges</a>.</p></div></div>` : ""}`;
    }).join("");
    if (active) loadStatement(CHALLENGES.find((c) => c.id === active));
  }

  function sanitize(article, base) {
    article.querySelectorAll("script, style, link, iframe, object, embed, form").forEach((n) => n.remove());
    article.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((a) => {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if ((a.name === "href" || a.name === "src") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
      if (el.tagName === "A" && el.getAttribute("href") && !el.getAttribute("href").startsWith("#")) {
        el.setAttribute("href", new URL(el.getAttribute("href"), base).href);
        el.setAttribute("rel", "noopener");
      }
    });
    return article.innerHTML;
  }

  async function loadStatement(c) {
    const box = $("[data-statement]");
    if (!box) return;
    try {
      if (!statementCache.has(c.id)) {
        const url = SITE + c.path;
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.status);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");
        const article = doc.querySelector("article") || doc.body;
        statementCache.set(c.id, sanitize(article, url));
      }
      if (active === c.id) box.innerHTML = statementCache.get(c.id);
    } catch (e) {
      box.innerHTML = `<p>The statement could not be loaded right now. Read it on <a href="${SITE}${c.path}">tenchallenges.github.io</a>.</p>`;
    }
  }

  list.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) { const id = active; active = null; renderList(); $(`#${id}`)?.focus(); return; }
    const t = e.target.closest("[data-open]");
    if (!t) return;
    active = active === t.dataset.open ? null : t.dataset.open;
    renderList();
    $(`#${t.dataset.open}`)?.focus({ preventScroll: true });
  });
  list.addEventListener("keydown", (e) => {
    const t = e.target.closest("[data-open], [data-close]");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); t.click(); }
  });

  /* ---------- leaderboard ---------- */
  const tabs = $("[data-tc-tabs]");
  tabs.innerHTML = [`<button class="lb-tab active" data-tab="all">All</button>`]
    .concat(CHALLENGES.map((c) => `<button class="lb-tab" data-tab="${c.id}">${esc(c.title)}</button>`)).join("");
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    tab = b.dataset.tab;
    $$("[data-tab]", tabs).forEach((x) => x.classList.toggle("active", x === b));
    renderRows();
  });

  function ranked() {
    const rows = entries.filter((e) => tab === "all" || baseId(e.problem) === tab);
    const universalFirst = (a, b) => (a.universal !== b.universal ? (a.universal ? -1 : 1) : 0);
    if (ORDINAL.has(tab)) {
      return rows.map((e) => ({ e, universal: String(e.parameter).trim() === "universal", v: parseCnf(e.ordinal_cnf) }))
        .sort((a, b) => universalFirst(a, b) || (a.universal ? a.e.rank - b.e.rank
          : a.v && b.v ? cmpCnf(b.v, a.v) || a.e.rank - b.e.rank : (a.v === null) !== (b.v === null) ? (a.v === null ? 1 : -1) : a.e.rank - b.e.rank))
        .map((x, i) => ({ ...x.e, displayRank: x.universal || x.v ? i + 1 : null }));
    }
    if (tab === "challenge_2" || NUMERIC_RANK.has(tab)) {
      return rows.map((e) => ({ e, universal: String(e.parameter).trim() === "universal", v: bigOrNull(e.parameter), b: bigOrNull(e.bound) }))
        .sort((a, b) => universalFirst(a, b)
          || (a.v !== null && b.v !== null && a.v !== b.v ? (a.v > b.v ? -1 : 1) : 0)
          || ((a.v === null) !== (b.v === null) ? (a.v === null ? 1 : -1) : 0)
          || (tab === "challenge_2" && a.b !== null && b.b !== null && a.b !== b.b ? (a.b < b.b ? -1 : 1) : 0)
          || a.e.rank - b.e.rank)
        .map((x, i) => ({ ...x.e, displayRank: i + 1 }));
    }
    return rows.map((e) => ({ ...e, displayRank: e.rank }));
  }

  function result(e) {
    if (String(e.parameter) === "universal") return e.claim === "prove" ? "proven universally" : "fails for some r";
    return `${e.claim === "prove" ? "holds" : "fails"} for r = ${e.parameter}${e.bound ? ` with B = ${e.bound}` : ""}`;
  }
  function challengeLabel(problem) {
    const c = CHALLENGES.find((x) => x.id === baseId(problem));
    const suffix = /_univ$/.test(problem) ? " (all r)" : /_disprove$/.test(problem) ? " (disproof)" : "";
    return c ? `Challenge ${c.n}${suffix}` : problem;
  }

  function renderRows() {
    const body = $("[data-tc-rows]");
    const rows = ranked();
    $("[data-tc-note]").hidden = !rows.some((r) => r.displayRank === null);
    body.innerHTML = rows.length
      ? rows.map((e) => {
        const isPublic = e.submission_public !== false;
        const proof = isPublic ? (e.source_url ? `<a href="${esc(e.source_url)}" rel="noopener">view</a>` : "—") : "private";
        return `<tr><td>${e.displayRank ?? "—"}</td><td>${esc(e.nickname || "")}</td><td${e.name ? "" : ' style="color:#888"'}>${esc(e.name || "—")}</td>
          <td>${esc(challengeLabel(e.problem))}</td><td>${esc(result(e))}</td><td>${esc(e.date || "")}</td><td>${proof}</td></tr>`;
      }).join("")
      : `<tr><td class="empty-row" colspan="7">No submissions yet.</td></tr>`;
  }

  fetch(LEADERBOARD)
    .then((r) => (r.ok ? r.json() : { entries: [] }))
    .then((d) => { entries = Array.isArray(d.entries) ? d.entries : []; })
    .catch(() => { entries = []; })
    .finally(() => { renderRows(); renderList(); });

  /* ---------- submission forms (open a pre-filled GitHub issue) ---------- */
  $$("[data-problem-select]").forEach((s) => {
    s.innerHTML = `<option value="">Select a challenge…</option>` + CHALLENGES.map((c) => `<option value="${c.id}">${c.n}. ${esc(c.title)}</option>`).join("");
  });

  function wireForm(form, kind) {
    const link = $("[data-submit]", form);
    const hint = $("[data-hint]", form);
    const boundRow = $("[data-bound-row]", form);
    const update = () => {
      const f = Object.fromEntries(new FormData(form).entries());
      if (boundRow) boundRow.hidden = f.problem_id !== "challenge_2";
      const needBound = kind === "specific" && f.problem_id === "challenge_2";
      const ok = f.nickname?.trim() && f.problem_id && (kind === "specific" ? f.parameter?.trim() && (!needBound || f.bound?.trim()) : f.claim);
      const q = new URLSearchParams();
      q.set("template", kind === "specific" ? "submit-specific.yml" : "submit-universal.yml");
      q.set("problem_id", f.problem_id || "");
      if (kind === "specific") { q.set("parameter", (f.parameter || "").trim()); if (needBound) q.set("bound", (f.bound || "").trim()); }
      else q.set("claim", f.claim || "");
      q.set("nickname", (f.nickname || "").trim());
      if (f.full_name?.trim()) q.set("full_name", f.full_name.trim());
      if (ok) {
        link.href = `https://github.com/${REPO}/issues/new?${q.toString()}`;
        link.target = "_blank";
        link.rel = "noopener";
        link.removeAttribute("aria-disabled");
        hint.textContent = "Opens a pre-filled issue on GitHub.";
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
        hint.textContent = "Fill in the fields marked *.";
      }
    };
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("submit", (e) => e.preventDefault());
    update();
  }
  wireForm($('[data-form="specific"]'), "specific");
  wireForm($('[data-form="universal"]'), "universal");

  renderList();
})();
