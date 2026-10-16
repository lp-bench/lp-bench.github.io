// Problems page: overview, filters and the full list.
(() => {
  "use strict";
  const { CFG, reduceMotion, $, $$, esc, fold, highlightLean, showTip, hideTip, copy, PROBLEMS, BY_ID, CAT_LABEL, CAT_ORDER, challengeSource } = window.PB;
  const STATEMENTS_REPO = "https://github.com/proof-bench/proofbench-statements";
  const list = $("[data-list]");
  const state = { q: "", cat: "all", area: "all", active: null };

  /* waffle */
  const waffle = $(".waffle");
  const ordered = CAT_ORDER.flatMap((c) => PROBLEMS.filter((p) => p.cat === c));
  waffle.innerHTML = ordered
    .map((p) => `<button class="cell" data-id="${p.id}" data-cat="${p.cat}" aria-label="P${p.id}: ${esc(p.name)}, ${CAT_LABEL[p.cat]}"></button>`)
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
  waffle.addEventListener("click", (e) => { const c = e.target.closest(".cell"); if (c) { hideTip(); openProblem(c.dataset.id); } });
  $$("[data-legend]").forEach((li) => {
    li.addEventListener("pointerenter", () => {
      waffle.classList.add("dim");
      $$(".cell", waffle).forEach((c) => c.classList.toggle("match", c.dataset.cat === li.dataset.legend));
    });
    li.addEventListener("pointerleave", () => waffle.classList.remove("dim"));
  });

  /* area filter, built from the data: graph theory first, then by size */
  const areaCount = {};
  PROBLEMS.forEach((p) => { areaCount[p.area] = (areaCount[p.area] || 0) + 1; });
  const rank = (a) => (a === "Graph theory" ? 0 : a === "Other areas" ? 2 : 1);
  $("[data-area]").insertAdjacentHTML("beforeend", Object.keys(areaCount)
    .sort((a, b) => rank(a) - rank(b) || areaCount[b] - areaCount[a] || a.localeCompare(b))
    .map((a) => `<option value="${esc(a)}">${esc(a)} (${areaCount[a]})</option>`)
    .join(""));

  /* list */
  function matches(p) {
    if (state.cat !== "all" && p.cat !== state.cat) return false;
    if (state.area !== "all" && p.area !== state.area) return false;
    if (!state.q) return true;
    const hay = fold(`P${p.id} ${p.id} ${p.name} ${p.msc} ${p.area} ${p.sub || ""} ${p.summary}`);
    return fold(state.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
  }

  function detailHTML(p) {
    const file = `ProofBench/PROBLEMS/P${p.id}/P${p.id}.lean`;
    const fileRef = CFG.released ? `<a href="${STATEMENTS_REPO}/blob/main/${file}">${file}</a>` : `<span>${file}</span>`;
    const negation = p.cat === "open" ? `<li>The negated statement ships as <code>P${p.id}_DISPROVE.lean</code>; proving either one settles the problem.</li>` : "";
    return `
      <div class="detail-panel" id="detail-${p.id}">
        <p>${esc(p.summary)}</p>
        <div class="code-block">
          <button class="btn btn-small copy-btn" type="button" data-copy-lean="${p.id}">Copy</button>
          <pre><code>${highlightLean(challengeSource(p))}</code></pre>
        </div>
        <div class="info-box">
          <p class="info-box-label">Details</p>
          <ul style="list-style:none">
            <li>Category: ${CAT_LABEL[p.cat]}${p.note ? ` (${esc(p.note)})` : ""}</li>
            <li>Classification: MSC ${esc(p.msc)}</li>
            ${negation}
          </ul>
        </div>
        <div class="p-meta">${fileRef}<a href="#P${p.id}" data-permalink="${p.id}">copy permalink</a></div>
      </div>`;
  }

  function itemHTML(p) {
    const on = state.active === p.id;
    return `
      <div class="problem-item${on ? " active" : ""}" id="P${p.id}" data-toggle="${p.id}" role="button" tabindex="0" aria-expanded="${on}">
        <div class="problem-header">
          <span class="problem-title">${esc(p.name)}</span>
          <span class="problem-meta-inline">P${p.id} · ${esc(p.msc.slice(0, 5))}</span>
        </div>
        <p class="problem-desc"><span class="sw sw-${p.cat}"></span>${CAT_LABEL[p.cat]} · ${esc(p.sub || p.area)}</p>
      </div>
      ${on ? detailHTML(p) : ""}`;
  }

  function render() {
    const hits = PROBLEMS.filter(matches);
    list.innerHTML = hits.length
      ? hits.map(itemHTML).join("")
      : `<p class="muted" style="padding:20px 0">No problem matches “${esc(state.q)}”. Try a broader term such as <em>colouring</em>, <em>matroid</em> or <em>Ramsey</em>.</p>`;
    const filtered = state.q || state.cat !== "all" || state.area !== "all";
    $("[data-count]").textContent = filtered ? `${hits.length} of ${PROBLEMS.length} problems` : `${PROBLEMS.length} problems`;
  }

  function setCat(cat) {
    state.cat = cat;
    $$("[data-cat]").forEach((b) => {
      b.classList.toggle("active", b.dataset.cat === cat);
      b.setAttribute("aria-pressed", String(b.dataset.cat === cat));
    });
  }

  $("[data-search]").addEventListener("input", (e) => { state.q = e.target.value.trim(); render(); });
  $("[data-area]").addEventListener("change", (e) => { state.area = e.target.value; render(); });
  $$("[data-cat]").forEach((b) => b.addEventListener("click", () => { setCat(b.dataset.cat); render(); }));

  list.addEventListener("click", (e) => {
    const t = e.target.closest("[data-toggle]");
    if (t) {
      const id = t.dataset.toggle;
      state.active = state.active === id ? null : id;
      render();
      if (state.active) history.replaceState(null, "", `#P${id}`);
      $(`#P${id}`)?.focus({ preventScroll: true });
      return;
    }
    const c = e.target.closest("[data-copy-lean]");
    if (c) { copy(challengeSource(BY_ID[c.dataset.copyLean]), c); return; }
    const pl = e.target.closest("[data-permalink]");
    if (pl) { e.preventDefault(); history.replaceState(null, "", `#P${pl.dataset.permalink}`); copy(location.href, pl, "copied"); }
  });

  list.addEventListener("keydown", (e) => {
    const t = e.target.closest("[data-toggle]");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); t.click(); }
  });

  function openProblem(id) {
    if (!BY_ID[id]) return;
    if (!matches(BY_ID[id])) {
      state.q = ""; state.area = "all";
      $("[data-search]").value = "";
      $("[data-area]").value = "all";
      setCat("all");
    }
    state.active = id;
    render();
    history.replaceState(null, "", `#P${id}`);
    const el = $(`#P${id}`);
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  }

  render();
  const fromHash = () => { const m = location.hash.match(/^#P(\d{3})$/); if (m) openProblem(m[1]); };
  window.addEventListener("hashchange", fromHash);
  setTimeout(fromHash, 50);
})();
