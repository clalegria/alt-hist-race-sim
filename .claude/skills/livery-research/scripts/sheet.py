"""Render a PNG review sheet of badges, drawn the way the app draws them.

Top: the team's livery eras (current and, when a plan is given, proposed).
Below: one row per season the team races in, every team on that grid as a badge,
the team under review ringed in blue, a twin badge (primary and stripes alike) in red,
and a primary clash the stripes still tell apart in amber.
"""
from PIL import Image, ImageDraw, ImageFont

from _lib import CLASH_DE, LIVERY_KEYS, de, era_span, lab, livery_in, load_seasons, name_in, sashes_alike

BADGE = 34
SS = 3  # supersampling for smooth edges
CELL = 64
ROW_H = 62
LABEL_W = 70
BG = (206, 206, 206)
INK = (20, 20, 20)
# Matches TeamBadge.tsx: a 135deg sash from 41% to 59% of the gradient line,
# split at 50% when both accents are drawn.
CENTRE, HALF = 50, 9


def _rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def badge(l, size=BADGE):
    n = size * SS
    img = Image.new("RGB", (n, n))
    px = img.load()
    p, s1, s2 = _rgb(l["primaryColor"]), _rgb(l["secondaryColor1"]), _rgb(l["secondaryColor2"])
    stripes = l["badgeStripes"]
    lo, hi = CENTRE - HALF, CENTRE + HALF
    for y in range(n):
        for x in range(n):
            # Position along a 135deg CSS gradient line on a square, as a percent.
            t = ((x + 0.5) + (y + 0.5)) / (2 * n) * 100
            c = p
            if stripes == 1 and lo <= t < hi:
                c = s1
            elif stripes >= 2 and lo <= t < CENTRE:
                c = s1
            elif stripes >= 2 and CENTRE <= t < hi:
                c = s2
            px[x, y] = c
    mask = Image.new("L", (n, n), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, n - 1, n - 1), fill=255)
    out = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def _font(size):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def render(tid, teams, before, span, out_path):
    seasons = load_seasons()
    team = teams[tid]
    years = [y for y in sorted(seasons) if tid in seasons[y] and (not span or span[0] <= y <= span[1])]
    width_cells = max([len(seasons[y]) for y in years] + [len(team["liveries"]), len(before or [])])
    timelines = [("proposed" if before else "eras", team["liveries"])] + ([("current", before)] if before else [])
    H = 40 + len(timelines) * (ROW_H + 10) + 30 + len(years) * ROW_H + 10
    W = LABEL_W + width_cells * CELL + 20
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    f, fb = _font(11), _font(15)
    d.text((10, 10), f"{tid}: livery review", fill=INK, font=fb)
    cache = {}

    def put(l, x, y, ring=None):
        key = tuple(l[k] for k in LIVERY_KEYS)
        if key not in cache:
            cache[key] = badge(l)
        img.paste(cache[key], (x, y), cache[key])
        d.ellipse((x - 1, y - 1, x + BADGE, y + BADGE), outline=(90, 90, 90))
        if ring:
            d.ellipse((x - 4, y - 4, x + BADGE + 3, y + BADGE + 3), outline=ring, width=3)

    y0 = 40
    for label, eras in timelines:
        d.text((10, y0 + 12), label, fill=INK, font=f)
        for k, e in enumerate(eras):
            x = LABEL_W + k * CELL + (CELL - BADGE) // 2
            put(e, x, y0)
            d.text((LABEL_W + k * CELL + 4, y0 + BADGE + 4), era_span(eras, k), fill=INK, font=f)
        y0 += ROW_H + 10
    d.line((10, y0 + 5, W - 10, y0 + 5), fill=(120, 120, 120))
    y0 += 25
    for y in years:
        me = livery_in(team, y, seasons[y][tid])
        row = []
        for oid, entry in seasons[y].items():
            l = livery_in(teams[oid], y, entry)
            row.append((lab(l["primaryColor"])[0], oid, l))
        row.sort(key=lambda r: -r[0])  # light to dark, so near-colours sit together
        d.text((10, y0 + 12), str(y), fill=INK, font=fb)
        for k, (_, oid, l) in enumerate(row):
            x = LABEL_W + k * CELL + (CELL - BADGE) // 2
            ring = None
            if oid == tid:
                ring = (30, 90, 230)
            elif de(l["primaryColor"], me["primaryColor"]) < CLASH_DE:
                # red: a twin badge, indistinguishable; amber: same primary, stripes differ
                ring = (220, 30, 30) if sashes_alike(l, me) else (235, 160, 20)
            put(l, x, y0, ring)
            label = (name_in(teams[oid], y) if oid != tid else name_in(team, y))[:10]
            d.text((LABEL_W + k * CELL + 2, y0 + BADGE + 5), label, fill=INK, font=f)
        y0 += ROW_H
    img.save(out_path)
