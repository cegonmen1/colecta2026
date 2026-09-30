#!/usr/bin/env python3
"""Genera imágenes responsivas (AVIF/WebP/JPG), fuentes subseteadas, OG image e iconos.

Entrada: assets/ y fonts/ (originales, no se modifican).
Salida:  src/static/{img,fonts}/ (se fingerprintean en build) y public/ (rutas estables).
Requiere: Pillow, fonttools+brotli, avifenc, cwebp, rsvg-convert.
"""
import io
import subprocess
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageEnhance, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC_IMG = ROOT / "assets"
SRC_FONT = ROOT / "fonts"
OUT_IMG = ROOT / "src/static/img"
OUT_FONT = ROOT / "src/static/fonts"
PUBLIC = ROOT / "public"
TMP = ROOT / "scripts/.tmp"

# Latin básico + Latin-1 + puntuación tipográfica usada en el sitio
UNICODES = "U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201E,U+2022,U+2026,U+2191,U+20AC"


def run(*cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def encode(im: Image.Image, stem: str, avif_q=55, webp_q=78, jpg=False, png=False, avif=True, webp=True):
    """Escribe stem.avif / stem.webp (+ jpg/png opcional) a partir de un PIL Image."""
    TMP.mkdir(parents=True, exist_ok=True)
    src = TMP / f"{stem}.png"
    im.save(src, optimize=False)
    if avif:
        run("avifenc", "-q", str(avif_q), "-s", "4", "-j", "all", "--yuv", "420" if im.mode == "RGB" else "444",
            str(src), str(OUT_IMG / f"{stem}.avif"))
    if webp:
        run("cwebp", "-q", str(webp_q), "-m", "6", "-mt", "-alpha_q", "90", str(src), "-o", str(OUT_IMG / f"{stem}.webp"))
    if jpg:
        im.convert("RGB").save(OUT_IMG / f"{stem}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
    if png:
        im.quantize(colors=128, method=Image.Quantize.FASTOCTREE if im.mode == "RGBA" else None).save(
            OUT_IMG / f"{stem}.png", optimize=True)
    src.unlink()


def resize_w(im: Image.Image, w: int) -> Image.Image:
    if w >= im.width:
        return im.copy()
    return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def photos():
    sets = {
        "hero-puerta": [640, 960, 1280, 1584],
        "colecta-regalo": [480, 800, 1200],
        "cierre-puerta": [640, 1024, 1440, 1920],
    }
    for name, widths in sets.items():
        im = Image.open(SRC_IMG / f"{name}.jpg").convert("RGB")
        for w in widths:
            encode(resize_w(im, w), f"{name}-{w}", jpg=(w == widths[-2]))

    rays = Image.open(SRC_IMG / "rayos-luz.png").convert("RGBA")
    # WebP con alfa pesa más que el PNG cuantizado: solo AVIF + PNG
    encode(rays, "rayos-luz", avif_q=60, png=True, webp=False)

    logo = Image.open(SRC_IMG / "logo-vida-maxima.png").convert("RGBA")
    # Logo plano: el PNG de 128 colores es más ligero que AVIF/WebP
    encode(resize_w(logo, 420), "logo-vida-maxima", png=True, avif=False, webp=False)


def subset_fonts():
    jobs = [
        (SRC_FONT / "Manison-400.woff2", OUT_FONT / "manison.woff2"),
        (SRC_FONT / "Montserrat-latin-var.woff2", OUT_FONT / "montserrat.woff2"),
    ]
    for src, dst in jobs:
        opts = Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        font = TTFont(src)
        sub = Subsetter(opts)
        sub.populate(unicodes=parse_unicodes(UNICODES))
        sub.subset(font)
        font.flavor = "woff2"
        font.save(dst)


def parse_unicodes(spec: str):
    out = []
    for part in spec.split(","):
        part = part.replace("U+", "")
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a, 16), int(b, 16) + 1))
        else:
            out.append(int(part, 16))
    return out


def ttf_from_woff2(path: Path) -> io.BytesIO:
    f = TTFont(path)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return buf


def tracked(draw, xy, text, font, fill, tracking):
    """Dibuja texto con letter-spacing (px) y devuelve el ancho total."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking
    return x - xy[0] - tracking


def tracked_width(draw, text, font, tracking):
    return sum(draw.textlength(c, font=font) for c in text) + tracking * (len(text) - 1)


def og_image():
    W, H = 1200, 630
    hero = Image.open(SRC_IMG / "hero-puerta.jpg").convert("RGB")
    scale = H / hero.height
    hero = hero.resize((round(hero.width * scale), H), Image.LANCZOS)
    # La puerta está al ~52 % horizontal; se centra el recorte en ella
    left = max(0, min(hero.width - W, round(hero.width * 0.52 - W / 2)))
    bg = ImageEnhance.Brightness(hero.crop((left, 0, left + W, H))).enhance(0.55)
    shade = Image.new("RGBA", (W, H), (10, 18, 14, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(H):
        a = int(150 * (1 - 2 * y / H) ** 2) if y < H * 0.5 else int(170 * ((y - H * 0.5) / (H * 0.5)) ** 1.5)
        sd.line([(0, y), (W, y)], fill=(10, 18, 14, a))
    img = Image.alpha_composite(bg.convert("RGBA"), shade)
    d = ImageDraw.Draw(img)

    manison = ttf_from_woff2(SRC_FONT / "Manison-400.woff2")
    mont_raw = ttf_from_woff2(OUT_FONT / "montserrat.woff2")
    title = ImageFont.truetype(manison, 118)
    manison.seek(0)
    sub = ImageFont.truetype(manison, 40)
    mont = ImageFont.truetype(mont_raw, 26)
    try:
        mont.set_variation_by_axes([600])
    except Exception:
        pass

    cream, gold = (255, 246, 229), (242, 201, 76)
    t = "LLAMANDO"
    tw = tracked_width(d, t, title, 36)
    tracked(d, ((W - tw) / 2, 70), t, title, cream, 36)
    s = "COLECTA NAVIDEÑA 2026"
    sw = tracked_width(d, s, sub, 6)
    tracked(d, ((W - sw) / 2, 212), s, sub, gold, 6)
    info = "DOMINGO 13 DE DICIEMBRE · 5:30 PM · C.C. SEDENA (SANTA LUCÍA)"
    iw = tracked_width(d, info, mont, 3)
    tracked(d, ((W - iw) / 2, H - 78), info, mont, cream, 3)
    img.convert("RGB").save(PUBLIC / "og-image.jpg", "JPEG", quality=84, optimize=True, progressive=True)


FAVICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#0a120e"/>
<path d="M19 53V21.5a13 13 0 0 1 26 0V53" fill="none" stroke="#F2C94C" stroke-width="4.5" stroke-linecap="round"/>
<path d="M27 53V27l12-3v29z" fill="#F2C94C"/>
<circle cx="35.5" cy="40" r="1.6" fill="#0a120e"/>
</svg>
"""


def icons():
    (PUBLIC / "favicon.svg").write_text(FAVICON_SVG, encoding="utf-8")
    TMP.mkdir(parents=True, exist_ok=True)
    for size, name in [(180, "apple-touch-icon.png"), (192, "icon-192.png"), (512, "icon-512.png"), (48, "fav48.png")]:
        run("rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(TMP / name), str(PUBLIC / "favicon.svg"))
    for name in ["apple-touch-icon.png", "icon-192.png", "icon-512.png"]:
        Image.open(TMP / name).save(PUBLIC / name, optimize=True)
    Image.open(TMP / "fav48.png").save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    for p in TMP.iterdir():
        p.unlink()
    TMP.rmdir()


if __name__ == "__main__":
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    OUT_FONT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    photos()
    subset_fonts()
    og_image()
    icons()
    print("ok")
