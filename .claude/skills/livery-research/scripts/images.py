"""Find car photos and pull colours out of them.

  search "<query>" --out DIR [--limit 8] [--source openverse|commons]
                                           image search; downloads the hits and writes
                                           DIR/contact.png, every hit numbered on one sheet
  fetch <url> --out DIR                    download one image from a direct URL
  grid <image> [--n 10] [--out PNG]        copy of the image with a labelled NxN grid,
                                           to view and pick a box on the bodywork
                                           (--n 20 for a small car in a wide shot)
  colors <image> [--box C0,R0,C1,R1] [--neutral C0,R0,C1,R1] [--n 10] [-k 6]
                                           dominant colours in the box (grid cells,
                                           inclusive, same --n as the grid), with share and nearest hex
                                           already used in teams.json. --neutral names
                                           a box that should be white or grey (a white
                                           panel, white lettering) and removes the cast

Sources, both free and keyless: Openverse (default) searches openly licensed images
across Flickr, Wikimedia Commons and others; Flickr holds many scanned period photos
Commons lacks. `--source commons` searches Commons alone, whose file titles carry year
and chassis more reliably. Openverse rate-limits anonymous use, so search in moderation.
"""
import argparse
import io
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from _lib import nearest_palette, palette, rgb_hex

UA = "alt-hist-race-sim-livery-skill/1.0 (hobby project; python-urllib)"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
OPENVERSE_API = "https://api.openverse.org/v1/images/"
# Seconds between requests to one host: Commons answers bursts with HTTP 429 and
# Openverse limits anonymous clients. Other image hosts get no pause.
PAUSE = {"commons.wikimedia.org": 1.5, "upload.wikimedia.org": 1.0, "api.openverse.org": 1.0}
_last = {}


MAX_BACKOFF = 8  # seconds; a source still throttling after that is better skipped than waited on


def _get(url, headers=None, tries=3):
    host = urllib.parse.urlparse(url).netloc
    for attempt in range(tries):
        wait = _last.get(host, 0.0) + PAUSE.get(host, 0.0) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last[host] = time.monotonic()
        req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == tries - 1:
                raise
            asked = int(e.headers.get("Retry-After") or 0)
            if asked > MAX_BACKOFF:
                raise
            print(f"  {host} throttling, retrying in {asked or 3 * (attempt + 1)}s", flush=True)
            time.sleep(asked or 3 * (attempt + 1))


def _slug(s):
    return re.sub(r"[^A-Za-z0-9]+", "_", s).strip("_")[:60]


def _commons_thumb(url):
    """Commons throttles full-size originals and asks for its standard thumbnail sizes."""
    m = url and re.match(r"(https://upload\.wikimedia\.org/wikipedia/commons)/(\w/\w\w)/([^/]+)$", url)
    return f"{m.group(1)}/thumb/{m.group(2)}/{m.group(3)}/1280px-{m.group(3)}" if m else url


def search_openverse(query, limit):
    """[(title, page_url, [image urls, best first])]"""
    q = urllib.parse.urlencode({"q": query, "page_size": min(max(limit * 2, 10), 20)})
    data = json.loads(_get(f"{OPENVERSE_API}?{q}"))
    hits = []
    for r in data.get("results", []):
        urls = [u for u in (_commons_thumb(r.get("url")), r.get("thumbnail")) if u]
        if urls:
            title = f"[{r.get('source', '?')}] {r.get('title') or ''}"
            hits.append((title, r.get("foreign_landing_url") or "", urls))
    return hits


def search_commons(query, limit, width):
    q = urllib.parse.urlencode(
        {
            "action": "query",
            "generator": "search",
            "gsrsearch": query,
            "gsrnamespace": 6,
            "gsrlimit": limit,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": width,
            "format": "json",
        }
    )
    data = json.loads(_get(f"{COMMONS_API}?{q}"))
    pages = sorted(data.get("query", {}).get("pages", {}).values(), key=lambda p: p.get("index", 0))
    hits = []
    for p in pages:
        ii = p["imageinfo"][0]
        if ii.get("mime") in ("image/jpeg", "image/png", "image/webp"):
            hits.append((p["title"][len("File:") :], ii["descriptionurl"], [ii.get("thumburl") or ii["url"]]))
    return hits


def _download(urls, page, stem):
    """First candidate that downloads and decodes as a usable image, saved as JPEG."""
    from PIL import Image

    for u in urls:
        try:
            raw = _get(u, {"Referer": page} if page else None)
            img = Image.open(io.BytesIO(raw))
            img.load()
        except Exception as e:  # a dead link or a hotlink block: try the next candidate
            print(f"  skip {urllib.parse.urlparse(u).netloc}: {str(e)[:70]}", flush=True)
            continue
        if min(img.size) < 150:
            continue
        img = img.convert("RGB")
        img.thumbnail((1280, 1280))
        path = stem + ".jpg"
        img.save(path, quality=90)
        return path
    return None


def contact_sheet(saved, out):
    from PIL import Image, ImageDraw, ImageFont

    tw, th, cols = 360, 240, 4
    rows = (len(saved) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (30, 30, 30))
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=28)
    except TypeError:
        font = ImageFont.load_default()
    for i, (n, p) in enumerate(saved):
        img = Image.open(p)
        img.thumbnail((tw - 6, th - 6))
        x, y = (i % cols) * tw, (i // cols) * th
        sheet.paste(img, (x + (tw - img.width) // 2, y + (th - img.height) // 2))
        d.text((x + 6, y + 4), str(n), fill=(255, 255, 0), font=font, stroke_width=3, stroke_fill=(0, 0, 0))
    sheet.save(out)
    return out


def cmd_search(a):
    os.makedirs(a.out, exist_ok=True)
    source = a.source
    hits = search_openverse(a.query, a.limit) if source == "openverse" else search_commons(a.query, a.limit, a.width)
    if not hits:
        print(f"[{source}] no results; try fewer words or another spelling")
        return
    saved = []
    for title, page, urls in hits:
        if len(saved) >= a.limit:
            break
        n = len(saved)
        path = _download(urls, page, os.path.join(a.out, f"{n:02d}_{_slug(title) or 'image'}"))
        if path:
            saved.append((n, path))
            print(f"{n:2d}  {path}\n    {title}  {page}", flush=True)
    if saved:
        print(f"[{source}] contact sheet: {contact_sheet(saved, os.path.join(a.out, 'contact.png'))}")
    else:
        print(f"[{source}] {len(hits)} hits but none downloaded (see skips above)")


def cmd_fetch(a):
    os.makedirs(a.out, exist_ok=True)
    name = _slug(os.path.splitext(os.path.basename(urllib.parse.urlparse(a.url).path))[0]) or "image"
    print(_download([a.url], None, os.path.join(a.out, name)) or "could not download or decode that URL")


def _open(path):
    from PIL import Image

    img = Image.open(path)
    img.thumbnail((1024, 1024))
    return img.convert("RGB")


def cmd_grid(a):
    from PIL import ImageDraw, ImageFont

    img = _open(a.image)
    w, h = img.size
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.load_default(size=max(10, min(w // 60, w // (3 * a.n))))
    except TypeError:
        font = ImageFont.load_default()
    n = a.n
    for i in range(n + 1):
        x, y = round(i * (w - 1) / n), round(i * (h - 1) / n)
        for line in (((x, 0), (x, h)), ((0, y), (w, y))):
            d.line(line, fill=(0, 0, 0), width=3)
            d.line(line, fill=(255, 255, 0), width=1)
    for i in range(n):
        cx, cy = round((i + 0.5) * w / n), round((i + 0.5) * h / n)
        for pos in ((cx - 4, 2), (2, cy - 6)):
            d.text(pos, str(i), fill=(255, 255, 0), font=font, stroke_width=2, stroke_fill=(0, 0, 0))
    out = a.out or os.path.splitext(a.image)[0] + ".grid.png"
    img.save(out)
    print(out)


def _crop(img, box, n=10):
    w, h = img.size
    c0, r0, c1, r1 = [int(v) for v in box.split(",")]
    return img.crop((c0 * w // n, r0 * h // n, (c1 + 1) * w // n, (r1 + 1) * h // n))


def _white_balance(img, ref):
    """Scale channels so the reference box averages to grey (von Kries, grey-world)."""
    from PIL import Image, ImageStat

    mean = ImageStat.Stat(ref).mean
    grey = sum(mean) / 3
    gains = [grey / max(m, 1) for m in mean]
    print(f"cast removed: reference averaged {rgb_hex(mean)}, gains " + " ".join(f"{g:.2f}" for g in gains))
    bands = [b.point(lambda v, g=g: min(255, round(v * g))) for b, g in zip(img.split(), gains)]
    return Image.merge("RGB", bands)


def cmd_colors(a):
    full = _open(a.image)
    img = _crop(full, a.box, a.n) if a.box else full
    if a.neutral:
        img = _white_balance(img, _crop(full, a.neutral, a.n))
    img.thumbnail((300, 300))
    q = img.quantize(colors=a.k, kmeans=4)
    pal = q.getpalette()
    counts = sorted(q.getcolors(), reverse=True)
    total = sum(c for c, _ in counts)
    used = palette()
    print(f"{'share':>6}  colour   nearest in teams.json")
    for c, idx in counts:
        h_ = rgb_hex(pal[idx * 3 : idx * 3 + 3])
        d, p = nearest_palette(h_, used)[0]
        print(f"{100 * c / total:5.1f}%  {h_}  {p} (dE {d:.1f})")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--out", required=True)
    s.add_argument("--limit", type=int, default=8)
    s.add_argument("--width", type=int, default=1024)
    s.add_argument("--source", choices=("openverse", "commons"), default="openverse")
    s.set_defaults(fn=cmd_search)
    s = sub.add_parser("fetch")
    s.add_argument("url")
    s.add_argument("--out", required=True)
    s.set_defaults(fn=cmd_fetch)
    s = sub.add_parser("grid")
    s.add_argument("image")
    s.add_argument("--out")
    s.add_argument("--n", type=int, default=10)
    s.set_defaults(fn=cmd_grid)
    s = sub.add_parser("colors")
    s.add_argument("image")
    s.add_argument("--box")
    s.add_argument("--neutral")
    s.add_argument("--n", type=int, default=10)
    s.add_argument("-k", type=int, default=6)
    s.set_defaults(fn=cmd_colors)
    a = p.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
