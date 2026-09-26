"""Read, check and write team liveries in packages/data/src/teams.json.

  find <name> [--year Y]          team ids whose name matches (ids are lineage names)
  show <team> [--plan P]          identity + livery eras, with near-duplicate warnings
  grid <year>                     every team on that season's grid, with its livery
  export <team> [--out P]         write the team's current eras as an editable plan
  check <team> [--plan P] [--years A-B] [--threshold 16]
                                  same-season clashes + near-duplicate neighbouring eras
  probe <team> <A-B> <hex>...     nearest same-season primaries for candidate colours
  de <hex> <hex>...               pairwise delta E
  palette [--near HEX] [-n 8]     hexes already used in teams.json (reuse them)
  sheet <team> [--plan P] [--years A-B] --out PNG
                                  badge sheet: the team's eras and every grid it races on
  apply <plan>                    validate the plan and write it into teams.json

A plan is {"team": id, "liveries": [{from, primaryColor, secondaryColor1,
secondaryColor2, badgeStripes, ...}]} — the team's COMPLETE era list. Extra keys on
an era (e.g. "source") are notes for the proposal and are dropped by `apply`.
"""
import argparse
import io
import json
import sys

from _lib import (
    CLASH_DE,
    HEX_RE,
    LIVERY_KEYS,
    TEAMS_PATH,
    de,
    era_span,
    lab,
    livery_in,
    load_seasons,
    load_teams,
    name_in,
    nearest_palette,
    norm_hex,
    palette,
    parse_years,
    sashes_alike,
    teams_by_id,
)

NEAR_DUPLICATE_DE = 10.0  # every colour of two neighbouring eras within this = one era
PALETTE_REUSE_DE = 6.0  # a new hex this close to an existing one is the same paint: reuse it
STRIPE_ECHO_DE = 3.0  # a drawn stripe this close to another team's primary is worth a note


def is_neutral_extreme(h):
    """White or black: every grid has them as both stripes and primaries, so an echo means nothing."""
    L, A, B = lab(h)
    return (A * A + B * B) ** 0.5 < 6 and (L > 92 or L < 10)


def fmt(l):
    s = l["badgeStripes"]
    return f'{l["primaryColor"]} / {l["secondaryColor1"]} / {l["secondaryColor2"]}  stripes={s}'


def team_or_die(tid, teams):
    if tid not in teams:
        close = [t for t in teams if tid.lower() in t.lower()]
        raise SystemExit(f"no team '{tid}'" + (f"; did you mean {', '.join(close)}?" if close else "; try `find`"))
    return teams[tid]


def read_plan(path):
    with io.open(path, encoding="utf-8") as f:
        plan = json.load(f)
    if "team" not in plan or "liveries" not in plan:
        raise SystemExit("plan needs 'team' and 'liveries'")
    return plan


def validate_eras(eras):
    errs = []
    if not eras:
        errs.append("liveries is empty")
    prev = None
    for i, e in enumerate(eras):
        for k in ("from",) + LIVERY_KEYS:
            if k not in e:
                errs.append(f"era {i}: missing {k}")
        if errs:
            continue
        if not isinstance(e["from"], int):
            errs.append(f"era {i}: from must be a whole year")
        if prev is not None and e["from"] <= prev:
            errs.append(f"era {i}: from {e['from']} is not after {prev} (must be strictly ascending)")
        prev = e["from"]
        for k in LIVERY_KEYS[:3]:
            if not HEX_RE.match(str(e[k]).upper()):
                errs.append(f"era {e['from']}: {k} {e[k]} is not #RRGGBB")
        if e["badgeStripes"] not in (0, 1, 2):
            errs.append(f"era {e['from']}: badgeStripes must be 0, 1 or 2")
    return errs


def clean_eras(eras):
    out = []
    for e in eras:
        c = {"from": e["from"]}
        for k in LIVERY_KEYS[:3]:
            c[k] = norm_hex(e[k])
        c["badgeStripes"] = e["badgeStripes"]
        out.append(c)
    return out


def with_plan(teams, plan):
    if plan:
        team_or_die(plan["team"], teams)
        errs = validate_eras(plan["liveries"])
        if errs:
            raise SystemExit("plan invalid:\n  " + "\n  ".join(errs))
        teams[plan["team"]] = dict(teams[plan["team"]], liveries=clean_eras(plan["liveries"]))
    return teams


def years_on_grid(tid, span=None):
    seasons = load_seasons()
    ys = [y for y in sorted(seasons) if tid in seasons[y]]
    if span:
        ys = [y for y in ys if span[0] <= y <= span[1]]
    return ys


# ---- commands ---------------------------------------------------------------


def cmd_find(a):
    teams = load_teams()
    q = a.name.lower()
    hits = 0
    for t in teams:
        names = [i["name"] for i in t["identity"]] if a.year is None else [name_in(t, a.year)]
        if any(q in n.lower() for n in names):
            hits += 1
            eras = ", ".join(f'{i["name"]} {era_span(t["identity"], k)}' for k, i in enumerate(t["identity"]))
            yrs = years_on_grid(t["id"])
            on = f"{yrs[0]}-{yrs[-1]} ({len(yrs)} seasons)" if yrs else "never on a grid"
            print(f'{t["id"]:16s} {eras}   | raced {on}')
    if not hits:
        print("no match")


def near_duplicates(eras):
    out = []
    for i in range(1, len(eras)):
        a, b = eras[i - 1], eras[i]
        if a["badgeStripes"] != b["badgeStripes"]:
            continue
        drawn = 1 + a["badgeStripes"]  # only compare the colours the badge actually shows
        worst = max(de(a[k], b[k]) for k in LIVERY_KEYS[:drawn])
        if worst < NEAR_DUPLICATE_DE:
            out.append((b["from"], worst))
    return out


def cmd_show(a):
    teams = with_plan(teams_by_id(), read_plan(a.plan) if a.plan else None)
    t = team_or_die(a.team, teams)
    print(f'{t["id"]} (founded {t["foundedYear"]})')
    for k, i in enumerate(t["identity"]):
        print(f'  name  {era_span(t["identity"], k):10s} {i["name"]} [{i["base"]}]')
    for k, e in enumerate(t["liveries"]):
        print(f'  livery {era_span(t["liveries"], k):9s} {fmt(e)}   ({name_in(t, e["from"])})')
    for y, d in near_duplicates(t["liveries"]):
        print(f"  ! era {y} is within dE {d:.1f} of the era before it on every drawn colour — merge unless deliberate")


def cmd_grid(a):
    teams = teams_by_id()
    seasons = load_seasons()
    if a.year not in seasons:
        raise SystemExit(f"no season file for {a.year}")
    rows = []
    for tid, entry in seasons[a.year].items():
        t = teams[tid]
        rows.append((name_in(t, a.year), tid, livery_in(t, a.year, entry)))
    for n, tid, l in sorted(rows):
        print(f"  {n:22s} {tid:16s} {fmt(l)}")


def cmd_export(a):
    t = team_or_die(a.team, teams_by_id())
    lines = ",\n".join("    " + json.dumps(e, ensure_ascii=False) for e in t["liveries"])
    text = f'{{\n  "team": "{t["id"]}",\n  "liveries": [\n{lines}\n  ]\n}}\n'
    if a.out:
        with io.open(a.out, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"wrote {a.out}")
    else:
        sys.stdout.write(text)


def clashes(tid, teams, span=None, threshold=CLASH_DE):
    """[(kind, dE, other, own_hex, other_hex, [years])], grouped over years."""
    seasons = load_seasons()
    me_t = teams[tid]
    found = {}
    for y in years_on_grid(tid, span):
        me = livery_in(me_t, y, seasons[y][tid])
        mine_drawn = [me[k] for k in LIVERY_KEYS[1 : 1 + me["badgeStripes"]] if not is_neutral_extreme(me[k])]
        for oid, entry in seasons[y].items():
            if oid == tid:
                continue
            o = livery_in(teams[oid], y, entry)
            d = de(me["primaryColor"], o["primaryColor"])
            if d < threshold:
                kind = "twin" if sashes_alike(me, o) else "primary"
                found.setdefault((kind, oid, me["primaryColor"], o["primaryColor"]), []).append(y)
            for s in mine_drawn:
                if de(s, o["primaryColor"]) < STRIPE_ECHO_DE:
                    found.setdefault(("stripe", oid, s, o["primaryColor"]), []).append(y)
    return [(k[0], de(k[2], k[3]), k[1], k[2], k[3], ys) for k, ys in found.items()]


def span_text(ys):
    return f"{ys[0]}-{ys[-1]}" if ys[0] != ys[-1] else str(ys[0])


def cmd_check(a):
    plan = read_plan(a.plan) if a.plan else None
    teams = with_plan(teams_by_id(), plan)
    t = team_or_die(a.team if a.team else plan["team"], teams)
    span = parse_years(a.years)
    rows = clashes(t["id"], teams, span, a.threshold)
    twins = sorted([r for r in rows if r[0] == "twin"], key=lambda r: (r[5][0], r[1]))
    prim = sorted([r for r in rows if r[0] == "primary"], key=lambda r: (r[5][0], r[1]))
    stripe = sorted([r for r in rows if r[0] == "stripe"], key=lambda r: r[5][0])
    if twins:
        print("TWIN BADGES (primary AND stripes alike: the two teams are indistinguishable; fix these):")
        for _, d, oid, mine, other, ys in twins:
            print(f"  {d:5.1f}  {mine} vs {oid:16s}{other}  {span_text(ys):9s} ({len(ys)}y)")
    print(f'primary clashes for {t["id"]} (dE < {a.threshold:g}; told apart only by the stripes):')
    for _, d, oid, mine, other, ys in prim:
        tag = "IDENTICAL" if d < 1 else ""
        print(f"  {d:5.1f}  {mine} vs {oid:16s}{other}  {span_text(ys):9s} ({len(ys)}y) {tag}")
    if not prim:
        print("  none")
    prim = prim + twins
    if stripe:
        print(f"stripe echoes (a drawn stripe within dE {STRIPE_ECHO_DE:g} of another team's primary):")
        for _, d, oid, mine, other, ys in stripe:
            print(f"  {d:5.1f}  stripe {mine} ~ {oid} primary {other}  {span_text(ys)}")
    dups = near_duplicates(t["liveries"])
    for y, d in dups:
        print(f"! era {y} is within dE {d:.1f} of the era before it on every drawn colour — merge unless deliberate")
    nudges = palette_nudges(t["liveries"], plan)
    for y, key, h, p, d in nudges:
        print(f"! era {y} {key} {h} is new but within dE {d:.1f} of {p} already in teams.json — use {p}")
    if not prim and not stripe and not dups and not nudges:
        print("clean")


def palette_nudges(eras, plan):
    """New hexes in the plan that sit so close to an existing one they mean the same paint."""
    if not plan:
        return []
    others = [t for t in load_teams() if t["id"] != plan["team"]]
    pal = palette(others)
    out = []
    for e in eras:
        for key in LIVERY_KEYS[:3]:
            h = e[key].upper()
            if h in pal:
                continue
            d, p = nearest_palette(h, pal)[0]
            if d < PALETTE_REUSE_DE:
                out.append((e["from"], key, h, p, d))
    return out


def cmd_probe(a):
    teams = teams_by_id()
    seasons = load_seasons()
    span = parse_years(a.years)
    ys = years_on_grid(a.team, span)
    if not ys:
        raise SystemExit(f"{a.team} is not on any grid in {a.years}")
    for c in a.colors:
        c = norm_hex(c)
        best = {}
        for y in ys:
            for oid, entry in seasons[y].items():
                if oid == a.team:
                    continue
                oc = livery_in(teams[oid], y, entry)["primaryColor"]
                d = de(c, oc)
                if oid not in best or d < best[oid][0]:
                    best[oid] = (d, oc, y)
        near = sorted(best.items(), key=lambda kv: kv[1][0])[: a.n]
        print(f"{c}  L={lab(c)[0]:.0f}  " + "  ".join(f"{oid}:{d:.1f}" for oid, (d, oc, y) in near))


def cmd_de(a):
    cs = [norm_hex(c) for c in a.colors]
    for i, x in enumerate(cs):
        for y in cs[i + 1 :]:
            print(f"{x} {y}  {de(x, y):6.1f}")


def cmd_palette(a):
    pal = palette()
    if a.near:
        for d, p in nearest_palette(norm_hex(a.near), pal, a.n):
            print(f"  {p}  dE {d:5.1f}  used {pal[p]}x")
    else:
        for p, n in sorted(pal.items(), key=lambda kv: -kv[1]):
            print(f"  {p}  {n}x")


def cmd_apply(a):
    plan = read_plan(a.plan)
    tid = plan["team"]
    team_or_die(tid, teams_by_id())
    errs = validate_eras(plan["liveries"])
    if errs:
        raise SystemExit("plan invalid, nothing written:\n  " + "\n  ".join(errs))
    eras = clean_eras(plan["liveries"])
    with io.open(TEAMS_PATH, encoding="utf-8") as f:
        text = f.read()
    anchor = f'"id": "{tid}"'
    if text.count(anchor) != 1:
        raise SystemExit(f"expected exactly one {anchor} in teams.json")
    i = text.index(anchor)
    j = text.index('"liveries": [', i)
    nxt = text.find('"id": "', i + len(anchor))
    if nxt != -1 and j > nxt:
        raise SystemExit(f"could not find {tid}'s liveries block")
    close = text.index("\n    ]", j)
    body = ",\n".join(
        "      { "
        + f'"from": {e["from"]}, "primaryColor": "{e["primaryColor"]}", '
        + f'"secondaryColor1": "{e["secondaryColor1"]}", "secondaryColor2": "{e["secondaryColor2"]}", '
        + f'"badgeStripes": {e["badgeStripes"]}'
        + " }"
        for e in eras
    )
    new_text = text[: j + len('"liveries": [')] + "\n" + body + text[close:]
    parsed = {t["id"]: t for t in json.loads(new_text)}
    if parsed[tid]["liveries"] != eras:
        raise SystemExit("round-trip mismatch, nothing written")
    before = teams_by_id()[tid]["liveries"]
    with io.open(TEAMS_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_text)
    print(f"wrote {len(eras)} eras for {tid} (was {len(before)})")
    for k, e in enumerate(eras):
        print(f"  {era_span(eras, k):10s} {fmt(e)}")


def cmd_sheet(a):
    from sheet import render

    plan = read_plan(a.plan) if a.plan else None
    current = teams_by_id()
    teams = with_plan(teams_by_id(), plan)
    tid = a.team if a.team else plan["team"]
    team_or_die(tid, teams)
    render(tid, teams, current[tid]["liveries"] if plan else None, parse_years(a.years), a.out)
    print(f"wrote {a.out}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("find")
    s.add_argument("name")
    s.add_argument("--year", type=int)
    s.set_defaults(fn=cmd_find)
    s = sub.add_parser("show")
    s.add_argument("team")
    s.add_argument("--plan")
    s.set_defaults(fn=cmd_show)
    s = sub.add_parser("grid")
    s.add_argument("year", type=int)
    s.set_defaults(fn=cmd_grid)
    s = sub.add_parser("export")
    s.add_argument("team")
    s.add_argument("--out")
    s.set_defaults(fn=cmd_export)
    s = sub.add_parser("check")
    s.add_argument("team", nargs="?")
    s.add_argument("--plan")
    s.add_argument("--years")
    s.add_argument("--threshold", type=float, default=CLASH_DE)
    s.set_defaults(fn=cmd_check)
    s = sub.add_parser("probe")
    s.add_argument("team")
    s.add_argument("years")
    s.add_argument("colors", nargs="+")
    s.add_argument("-n", type=int, default=5)
    s.set_defaults(fn=cmd_probe)
    s = sub.add_parser("de")
    s.add_argument("colors", nargs="+")
    s.set_defaults(fn=cmd_de)
    s = sub.add_parser("palette")
    s.add_argument("--near")
    s.add_argument("-n", type=int, default=8)
    s.set_defaults(fn=cmd_palette)
    s = sub.add_parser("sheet")
    s.add_argument("team", nargs="?")
    s.add_argument("--plan")
    s.add_argument("--years")
    s.add_argument("--out", required=True)
    s.set_defaults(fn=cmd_sheet)
    s = sub.add_parser("apply")
    s.add_argument("plan")
    s.set_defaults(fn=cmd_apply)
    a = p.parse_args()
    if a.cmd in ("check", "sheet") and not a.team and not a.plan:
        p.error("give a team or --plan")
    a.fn(a)


if __name__ == "__main__":
    main()
