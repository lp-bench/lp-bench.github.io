"""Generate assets/js/problem-data.js from the ProofBench problem database.

Usage:
    python scripts/build_problems.py path/to/proofbench/ProofBench/DATABASE/Database.json

Only test-taker fields are exported (id, name, difficulty, MSC, area, plain-language
summary, formal statement). The counts in the pages are filled in from the same data: an element
with `data-pb="key"` gets the number as its text (and as `data-count`, for the animated counters),
`data-pb-text="... {key} ..."` sets the element's text from a template, and `data-pb-<attribute>`
sets that attribute from a template (for `<meta>` descriptions and `aria-label`s). Keys: total, open,
research, calibration, graph, matroids, extremal, other. The workflow
`.github/workflows/site.yml` runs this script whenever the proofbench repo is pushed.
"""

import json
import re
import sys
from collections import Counter
from pathlib import Path

AREAS = {
    "05C": "Graph theory",
    "05B": "Matroids",
    "05D": "Extremal set theory",
}

# Hand-checked areas. ProofBench is anchored in graph theory, so problems with a graph-theoretic
# reading are listed under "Graph theory" with one of six subareas, whatever their primary MSC class:
# topological, algebraic & spectral, geometric & planar, extremal, random, enumerative.
# The remaining problems name their own field. The headline counts on the front page follow the
# primary MSC class, as in the paper, not this table.
T, A, G, E, R, N = ("Topological graph theory", "Algebraic & spectral graph theory",
                    "Geometric & planar graph theory", "Extremal graph theory",
                    "Random graphs", "Enumerative graph theory")
AREA_OVERRIDES = {
    # graph theory
    "003": ("Graph theory", E),   # diagonal Ramsey numbers
    "009": ("Graph theory", E),   # union-closed sets; graph form via maximal stable sets
    "012": ("Graph theory", E),   # partial transversals = rainbow matchings in edge-coloured K_{n,n}
    "013": ("Graph theory", E),   # Beck-Fiala discrepancy of bounded-degree hypergraphs
    "016": ("Graph theory", A),   # Shao tensor product, the algebra of spectral hypergraph theory
    "041": ("Graph theory", G),   # 3-SAT step in the hardness of planarity for temporal graph sequences
    "042": ("Graph theory", A),   # Riemann hypothesis; graph analogue via Ihara zeta and Ramanujan graphs
    "053": ("Graph theory", E),   # hypergraph joints (Chao-Yu)
    "065": ("Graph theory", G),   # Kahn-Kalai: chromatic number of a diameter graph
    "067": ("Graph theory", T),   # embedding 2-complexes in 3-space, planarity one dimension up
    "070": ("Graph theory", E),   # continuum hypothesis; infinite Ramsey theory and partition calculus
    "073": ("Graph theory", N),   # Alon-Tarsi: even vs odd Latin squares (edge colourings of K_{n,n})
    "076": ("Graph theory", A),   # Conway's 99-graph
    "077": ("Graph theory", A),   # 57-regular Moore graph
    "085": ("Graph theory", T),   # lonely runner; circular chromatic number of distance graphs
    "089": ("Graph theory", E),   # Erdos-Szekeres; cliques and stable sets in permutation graphs
    "091": ("Graph theory", E),   # Bollobas set-pairs inequality
    "102": ("Graph theory", R),   # sparse random matrices on random Tanner graphs
    "103": ("Graph theory", R),   # orders of the random bipartite graph B(n, n, p)
    "110": ("Graph theory", E),   # zero-sum blocks; zero-sum Ramsey theory
    # other fields
    "007": ("Discrete geometry", ""),
    "037": ("Group theory", ""),
    "072": ("Combinatorics on words", ""),
    "075": ("Combinatorics on words", ""),
    "074": ("Number theory", ""),
    "111": ("Number theory", ""),
    "115": ("Number theory", ""),   # van der Waerden numbers: Ramsey theory on the integers
}

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "js" / "problem-data.js"


def counts(problems: list[dict]) -> dict[str, int]:
    """The numbers shown on the pages: categories and the split by primary MSC class."""
    cat = Counter(p["cat"] for p in problems)
    msc = Counter(p["msc"][:3] for p in problems)
    total = len(problems)
    graph, matroids, extremal = msc["05C"], msc["05B"], msc["05D"]
    return {"total": total, "open": cat["open"], "research": cat["research"],
            "calibration": cat["calibration"], "graph": graph, "matroids": matroids,
            "extremal": extremal, "other": total - graph - matroids - extremal}


TEXT_ELEMENT = re.compile(
    r'<(?P<tag>[a-zA-Z][\w-]*)(?P<attrs>[^<>]*?\bdata-pb(?P<kind>|-text)="(?P<value>[^"]*)"[^<>]*)>'
    r'(?P<text>[^<]*)(?=</(?P=tag)>)')
ATTR_ELEMENT = re.compile(r'<[a-zA-Z][^<>]*\bdata-pb-(?!text=)[a-z-]+="[^"]*"[^<>]*>')
ATTR_TEMPLATE = re.compile(r'\bdata-pb-(?!text=)(?P<attr>[a-z-]+)="(?P<template>[^"]*)"')


def fill_counts(html: str, n: dict[str, int]) -> tuple[str, int]:
    """Fill the `data-pb*` markers of a page; returns the new page and the number of markers."""
    filled = 0

    def text(m: re.Match) -> str:
        nonlocal filled
        filled += 1
        attrs, value = m["attrs"], m["value"]
        if m["kind"]:
            return f"<{m['tag']}{attrs}>{value.format(**n)}"
        attrs = re.sub(r'\bdata-count="\d+"', f'data-count="{n[value]}"', attrs)
        return f"<{m['tag']}{attrs}>{n[value]}"

    def attributes(m: re.Match) -> str:
        nonlocal filled
        tag = m[0]
        for t in ATTR_TEMPLATE.finditer(m[0]):
            filled += 1
            value = t["template"].format(**n)
            tag = re.sub(rf'(?<![\w-]){re.escape(t["attr"])}="[^"]*"', f'{t["attr"]}="{value}"', tag)
        return tag

    html = TEXT_ELEMENT.sub(text, html)
    html = ATTR_ELEMENT.sub(attributes, html)
    return html, filled


def category(difficulty: str) -> str:
    head = difficulty.split(" ")[0].lower()
    if head == "open":
        return "open"
    if head == "research":
        return "research"
    return "calibration"  # "Calibration ..." and "Undergraduate"


def note(difficulty: str) -> str:
    m = re.search(r"\((.*)\)\s*$", difficulty)
    return m.group(1) if m else ""


def resolved(difficulty: str) -> str:
    if "disproved in" in difficulty:
        return "disproved"
    if re.search(r"\bproved in OpenAI", difficulty):
        return "proved"
    return ""


def classify(pid: str, msc: str) -> tuple[str, str]:
    """Return (area, subarea); subarea is empty unless the problem has a graph theory subarea."""
    if pid in AREA_OVERRIDES:
        return AREA_OVERRIDES[pid]
    return AREAS.get(msc[:3], "Other areas"), ""


def tex_dashes(text: str) -> str:
    return text.replace("--", "–")


def main(db_path: str) -> None:
    db = json.loads(Path(db_path).read_text(encoding="utf-8"))
    problems = []
    for p in db:
        area, sub = classify(p["id"], p["msc"])
        problems.append({
            "id": p["id"],
            "name": tex_dashes(p["name"]),
            "cat": category(p["difficulty"]),
            "note": note(p["difficulty"]),
            "resolved": resolved(p["difficulty"]),
            "msc": p["msc"],
            "area": area,
            "sub": sub,
            "summary": tex_dashes(p["informal_statement_summary"].strip()),
            "lean": p["formal_statement"][0].strip(),
        })
    body = json.dumps(problems, ensure_ascii=False, indent=0)
    OUT.write_text(
        "// Generated by scripts/build_problems.py from the proofbench repo. Do not edit by hand.\n"
        f"window.PB_PROBLEMS = {body};\n",
        encoding="utf-8",
    )
    print(f"wrote {len(problems)} problems to {OUT}")
    n = counts(problems)
    for page in sorted(ROOT.glob("*.html")):
        html, filled = fill_counts(page.read_text(encoding="utf-8"), n)
        page.write_text(html, encoding="utf-8")
        print(f"{page.name}: {filled} counts filled")
    print("counts:", n)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
