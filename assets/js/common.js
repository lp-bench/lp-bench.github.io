// Shared helpers for every ProofBench page.
(() => {
  "use strict";
  document.documentElement.classList.add("js");

  const CFG = window.PB_CONFIG || {};
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  /* Lean highlighting */
  const LEAN_TOKENS = new RegExp(
    [
      "(--[^\\n]*)",
      "\\b(sorry)\\b",
      "\\b(theorem|lemma|def|by|fun|refine|exact|intro|have|show|let|in|where|with|match|Type|Prop)\\b",
      "([∀∃¬→↔∧∨≤≥≠⟨⟩↦≃∩∪⊆∈⊢∘↪<|]+|:=)",
      "\\b(\\d+)\\b",
      "([ℕℤℝ]|\\b[A-Z][a-z][A-Za-z0-9_']*(?:\\.[A-Za-z0-9_']+)*)",
    ].join("|"),
    "gu"
  );
  const TOKEN_CLASS = [null, "tok-com", "tok-sorry", "tok-kw", "tok-sym", "tok-num", "tok-ty"];
  function highlightLean(src) {
    let out = "";
    let last = 0;
    src.replace(LEAN_TOKENS, (m, ...groups) => {
      const offset = groups[groups.length - 2];
      out += esc(src.slice(last, offset));
      const idx = groups.slice(0, 6).findIndex((g) => g !== undefined);
      out += `<span class="${TOKEN_CLASS[idx + 1]}">${esc(m)}</span>`;
      last = offset + m.length;
      return m;
    });
    return out + esc(src.slice(last));
  }

  /* tooltip */
  let tip = $(".tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  function showTip(html, x, y) {
    tip.innerHTML = html;
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8)}px`;
    tip.style.top = `${y - r.height - 10 < 8 ? y + 18 : y - r.height - 10}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  /* clipboard */
  function copy(text, btn, done = "Copied") {
    const original = btn.textContent;
    const finish = () => { btn.textContent = done; setTimeout(() => (btn.textContent = original), 1500); };
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); finish(); } catch (e) { /* ignore */ }
      ta.remove();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(finish, fallback);
    else fallback();
  }

  /* paper links (header and hero) */
  const P = CFG.paper || {};
  const paperUrl = P.arxivId ? `https://arxiv.org/abs/${P.arxivId}` : "";
  $$("[data-paper-link]").forEach((el) => {
    if (paperUrl) {
      const a = document.createElement("a");
      a.className = el.className;
      a.href = paperUrl;
      a.textContent = el.dataset.labelLive || "Paper";
      el.replaceWith(a);
    } else {
      el.setAttribute("aria-disabled", "true");
      el.title = "The paper will be available on arXiv in October 2026.";
    }
  });

  /* GitHub menus (header and hero): one open at a time, close on outside click or Escape */
  const ghMenus = $$(".gh-menu");
  ghMenus.forEach((m) => m.addEventListener("toggle", () => {
    if (m.open) ghMenus.forEach((o) => { if (o !== m) o.open = false; });
  }));
  document.addEventListener("click", (e) => {
    ghMenus.forEach((m) => { if (m.open && !m.contains(e.target)) m.open = false; });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    ghMenus.forEach((m) => { if (m.open) { m.open = false; $("summary", m).focus(); } });
  });

  /* contact */
  $$("[data-contact]").forEach((a) => {
    const to = [].concat(CFG.contact || []);
    if (!to.length) return;
    a.href = `mailto:${to.join(",")}${a.dataset.subject ? `?subject=${encodeURIComponent(a.dataset.subject)}` : ""}`;
    if (!a.textContent.trim()) a.textContent = to.join(", ");
  });

  /* Lean snippets written into the page */
  $$("[data-lean]").forEach((el) => { el.innerHTML = highlightLean(el.textContent); });

  /* gentle reveal on scroll */
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      reveal.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  $$(".reveal").forEach((el) => (reduceMotion ? el.classList.add("in") : reveal.observe(el)));

  const PROBLEMS = (window.PB_PROBLEMS || []).slice().sort((a, b) => a.id.localeCompare(b.id));

  window.PB = {
    CFG, reduceMotion, $, $$, esc, fold, highlightLean, showTip, hideTip, copy,
    PROBLEMS,
    BY_ID: Object.fromEntries(PROBLEMS.map((p) => [p.id, p])),
    CAT_LABEL: { open: "Open", research: "Research", calibration: "Calibration" },
    CAT_ORDER: ["open", "research", "calibration"],
    challengeSource: (p) => `${p.lean} := by\n  sorry`,
  };
})();
