"""Shared helpers: repo data loading, era resolution and colour distance.

Mirrors the resolution rule in packages/data/src/eras.ts: the era in force is the
last one whose `from` has arrived; a year before the first era falls back to it.
"""
import glob
import io
import json
import math
import os
import re
import sys

# Windows consoles default to a legacy code page and mangle the dashes and deltas printed here.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

LIVERY_KEYS = ("primaryColor", "secondaryColor1", "secondaryColor2", "badgeStripes")
HEX_RE = re.compile(r"^#[0-9A-F]{6}$")
# The bar used when the liveries were first reviewed by hand: two same-season
# primaries closer than this (CIE76 delta E) read as the same team at badge size.
CLASH_DE = 16.0
# Stripes are thin, and thin areas are much harder to tell apart than a whole disc
# (CIE76 also overstates gaps between saturated reds), so two sashes read alike at a
# looser bar: #E4002B and #E10600 are 16.6 apart and look the same on a badge.
SASH_DE = 25.0


def repo_root():
    d = os.path.dirname(os.path.abspath(__file__))
    while True:
        if os.path.exists(os.path.join(d, "packages", "data", "src", "teams.json")):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            raise SystemExit("could not find packages/data/src/teams.json above " + __file__)
        d = parent


ROOT = repo_root()
TEAMS_PATH = os.path.join(ROOT, "packages", "data", "src", "teams.json")
SEASONS_GLOB = os.path.join(ROOT, "packages", "data", "src", "seasons", "*.json")


def load_teams():
    with io.open(TEAMS_PATH, encoding="utf-8") as f:
        return json.load(f)


def teams_by_id(teams=None):
    return {t["id"]: t for t in (teams if teams is not None else load_teams())}


_seasons = None


def load_seasons():
    """{year: {teamId: entry}} — one entry per team is enough for liveries."""
    global _seasons
    if _seasons is None:
        _seasons = {}
        for path in sorted(glob.glob(SEASONS_GLOB)):
            with io.open(path, encoding="utf-8") as f:
                s = json.load(f)
            _seasons[s["year"]] = {e["teamId"]: e for e in s["entries"]}
    return _seasons


def era_at(eras, year):
    cur = eras[0]
    for e in eras:
        if e["from"] <= year:
            cur = e
    return cur


def era_span(eras, i, last_year=2026):
    """Human span of era i, e.g. '1997-2002' or '2021+'."""
    start = eras[i]["from"]
    if i + 1 < len(eras):
        end = eras[i + 1]["from"] - 1
        return str(start) if end == start else f"{start}-{end}"
    return f"{start}+"


def name_in(team, year):
    return era_at(team["identity"], year)["name"]


def livery_in(team, year, entry=None):
    """The livery on screen: a season override (all four fields) wins over the era."""
    if entry and all(k in entry for k in LIVERY_KEYS):
        return {k: entry[k] for k in LIVERY_KEYS}
    return era_at(team["liveries"], year)


def parse_years(spec, default=None):
    """'1985' -> (1985, 1985); '1985-1990' -> (1985, 1990); None -> default."""
    if spec is None:
        return default
    if "-" in spec:
        a, b = spec.split("-", 1)
        return int(a), int(b)
    return int(spec), int(spec)


# ---- colour ---------------------------------------------------------------


def norm_hex(h):
    h = h.strip().upper()
    if not h.startswith("#"):
        h = "#" + h
    if not HEX_RE.match(h):
        raise SystemExit(f"not a #RRGGBB colour: {h}")
    return h


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_hex(rgb):
    return "#{:02X}{:02X}{:02X}".format(*[max(0, min(255, round(v))) for v in rgb])


def lab(h):
    r, g, b = [v / 255 for v in hex_rgb(h)]

    def lin(u):
        return u / 12.92 if u <= 0.04045 else ((u + 0.055) / 1.055) ** 2.4

    r, g, b = lin(r), lin(g), lin(b)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047
    y = r * 0.2126 + g * 0.7152 + b * 0.0722
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116

    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def de(a, b):
    """CIE76 delta E between two hex colours."""
    return math.dist(lab(a), lab(b))


def palette(teams=None):
    """Every hex already used anywhere in teams.json, with how often."""
    counts = {}
    for t in teams if teams is not None else load_teams():
        for e in t["liveries"]:
            for k in LIVERY_KEYS[:3]:
                counts[e[k].upper()] = counts.get(e[k].upper(), 0) + 1
    return counts


def nearest_palette(h, pal, n=1):
    return sorted(((de(h, p), p) for p in pal), key=lambda x: x[0])[:n]


def sashes_alike(a, b, threshold=SASH_DE):
    """Whether two badges' drawn stripes read the same, in either order."""
    sa = [a[k] for k in LIVERY_KEYS[1 : 1 + a["badgeStripes"]]]
    sb = [b[k] for k in LIVERY_KEYS[1 : 1 + b["badgeStripes"]]]
    if len(sa) != len(sb):
        return False
    return all(de(x, y) < threshold for x, y in zip(sa, sb)) or all(
        de(x, y) < threshold for x, y in zip(sa, reversed(sb))
    )
