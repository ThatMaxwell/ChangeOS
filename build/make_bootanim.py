"""Render ChangeOS bootanimation.zip from the Logo.svg geometry.

Usage: python build/make_bootanim.py [theme] [accent]
  theme:  fog | graphite | pumpkin   (default fog; pumpkin writes out/bootanimation-pumpkin.zip)
  accent: hex color             (default #2F6BFF)
Output: out/bootanimation.zip and out/bootanimation-preview.gif

Parts:
  part0  intro    ring sweeps in while spinning, dots pop in        (plays once, always completes)
  part1  loading  accent comet orbits the ring, dots ripple          (loops until Android has booted)
  part2  finale   bullseye drops in with a shockwave, wordmark rises (plays once, always completes)
"""
import io
import math
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"

THEMES = {
    "fog": {"bg": "#d9d9de", "fg": "#111111", "mute": "#b4b4ba"},
    "graphite": {"bg": "#111113", "fg": "#f2f2f2", "mute": "#3a3a3e"},
    # Pumpkin Caramel: the ring is a pumpkin (orange, with a stem), caramel dots and wordmark
    "pumpkin": {"bg": "#1c1009", "fg": "#ffe6c2", "mute": "#3a2414", "ring": "#ff7a1a", "stem": "#6b8e23",
                "accent": "#ffe6c2"},
}

W, H, FPS = 720, 900, 30
SS = 3  # supersampling factor
UNIT = 4.4  # px per Logo.svg unit (logo is 100 units -> 440 px)
OX, OY = (W - 100 * UNIT) / 2, 150  # logo top-left inside the frame
WORD_Y = 650

# Logo.svg geometry (viewBox 0 0 100 100)
CX, CY, R, STROKE = 50, 50, 36, 7
GAP_AT, GAP_HALF = -45, 37
A0, A1 = GAP_AT + GAP_HALF, GAP_AT + 360 - GAP_HALF
DOTS = [36.5, 45.5, 54.5, 63.5]
DOT_R = 3.6
BULL = (CX + R * math.cos(math.radians(GAP_AT)), CY + R * math.sin(math.radians(GAP_AT)))
BULL_R, HOLE_R = 14, 6.5


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    return 1 - (1 - clamp(x)) ** 3


def ease_in_out(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def ease_out_back(x, s=1.70158):
    x = clamp(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def rgb(hexcolor):
    h = hexcolor.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def ring(theme):
    return theme.get("ring", theme["fg"])


def load_font(size, bold):
    names = ("seguisb.ttf", "segoeuib.ttf", "arialbd.ttf") if bold else ("segoeui.ttf", "arial.ttf")
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


class Canvas:
    def __init__(self, theme):
        self.t = theme
        self.img = Image.new("RGBA", (W * SS, H * SS), rgb(theme["bg"]) + (255,))
        self.d = ImageDraw.Draw(self.img)

    def p(self, x, y):
        return ((OX + x * UNIT) * SS, (OY + y * UNIT) * SS)

    def circle(self, x, y, r, color):
        if r <= 0:
            return
        px, py = self.p(x, y)
        rr = r * UNIT * SS
        self.d.ellipse((px - rr, py - rr, px + rr, py + rr), fill=color)

    def ring_outline(self, x, y, r, width, color, alpha):
        """Semi-transparent circle outline (for the shockwave)."""
        if alpha <= 0 or r <= 0:
            return
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        px, py = self.p(x, y)
        rr = r * UNIT * SS
        ImageDraw.Draw(layer).ellipse((px - rr, py - rr, px + rr, py + rr), outline=rgb(color) + (int(255 * alpha),),
                                      width=max(1, round(width * UNIT * SS)))
        self.img.alpha_composite(layer)

    def arc(self, a0, a1, color, rot=0.0):
        if a1 - a0 < 0.5:
            return
        a0, a1 = a0 + rot, a1 + rot
        px, py = self.p(CX, CY)
        rr = (R + STROKE / 2) * UNIT * SS
        self.d.arc((px - rr, py - rr, px + rr, py + rr), a0, a1, fill=color, width=round(STROKE * UNIT * SS))
        for a in (a0, a1):  # round caps
            self.circle(CX + R * math.cos(math.radians(a)), CY + R * math.sin(math.radians(a)), STROKE / 2, color)

    def stem(self, k=1.0):
        """Pumpkin theme only: a curled stem sitting on top of the ring, grown by k (0..1+)."""
        if "stem" not in self.t or k <= 0:
            return
        x0, y0 = self.p(CX, CY - R - STROKE / 2 + 1)
        w, h = 6 * UNIT * SS, 11 * UNIT * SS * k
        layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle((x0 - w / 2, y0 - h, x0 + w / 2, y0 + 2 * UNIT * SS),
                                                radius=w / 2, fill=rgb(self.t["stem"]) + (255,))
        self.img.alpha_composite(layer.rotate(-14, center=(x0, y0), resample=Image.BICUBIC))

    def wordmark(self, accent, t):
        """'Change' bold + 'OS' in accent, rising letter by letter. t is seconds since the reveal started."""
        bold, light = load_font(64 * SS, True), load_font(64 * SS, True)
        pieces = [(ch, self.t["fg"], bold) for ch in "Change"] + [(ch, self.t.get("ring", accent), light) for ch in "OS"]
        total = sum(self.d.textlength(ch, font=f) for ch, _, f in pieces)
        x = (W * SS - total) / 2
        for i, (ch, color, font) in enumerate(pieces):
            k = ease_out_back((t - i * 0.045) / 0.45, 1.2)
            a = clamp((t - i * 0.045) / 0.25)
            if a > 0:
                layer = Image.new("RGBA", self.img.size, (0, 0, 0, 0))
                ImageDraw.Draw(layer).text((x, (WORD_Y + 26 * (1 - k)) * SS), ch, font=font,
                                           fill=rgb(color) + (int(255 * a),))
                self.img.alpha_composite(layer)
            x += self.d.textlength(ch, font=font)

    def done(self):
        return self.img.convert("RGB").resize((W, H), Image.LANCZOS)


def intro(theme, accent, n=40):
    """Ring sweeps in while spinning one full turn, settles with overshoot; dots pop in."""
    frames = []
    for i in range(n):
        t = i / FPS
        c = Canvas(theme)
        k = ease_in_out(t / 0.9)
        spin = -360 * (1 - ease_out_back(t / 1.0, 1.1))
        c.arc(A0, A0 + (A1 - A0) * k, ring(theme), rot=spin)
        c.stem(ease_out_back((t - 0.8) / 0.35, 2.0))
        for j, x in enumerate(DOTS):
            c.circle(x, CY, DOT_R * ease_out_back((t - 0.55 - j * 0.07) / 0.3, 2.2), theme["fg"])
        frames.append(c.done())
    return frames


def loading(theme, accent, n=45):
    """Seamless loop: accent comet orbits the ring, dots ripple in a wave."""
    frames = []
    span = A1 - A0
    for i in range(n):
        ph = i / n
        c = Canvas(theme)
        c.arc(A0, A1, ring(theme))
        c.stem()
        # comet: a 70-degree accent segment travelling along the visible arc and wrapping around
        head = A0 + (span + 70) * ph
        s, e = max(A0, head - 70), min(A1, head)
        if e - s > 1:
            c.arc(s, e, accent)
        for j, x in enumerate(DOTS):
            wave = max(0.0, math.sin(2 * math.pi * (ph - j * 0.12)))
            c.circle(x, CY - 2.2 * wave, DOT_R * (1 + 0.3 * wave), accent if wave > 0.65 else theme["fg"])
        frames.append(c.done())
    return frames


def finale(theme, accent, n=54):
    """Bullseye drops into the gap with a bounce + shockwave, then the wordmark rises."""
    frames = []
    bx, by = BULL
    for i in range(n):
        t = i / FPS
        c = Canvas(theme)
        pulse = 1 + 0.04 * math.sin(math.pi * clamp((t - 0.3) / 0.35))
        c.arc(A0, A1, ring(theme))
        c.stem()
        for x in DOTS:
            c.circle(x, CY, DOT_R, theme["fg"])
        drop = ease_out_back(t / 0.45, 2.0)
        y = by - 40 * (1 - clamp(t / 0.3))
        c.circle(bx, y, BULL_R * drop * pulse, ring(theme))
        c.circle(bx, y, HOLE_R * drop * pulse, accent if t > 0.3 else theme["bg"])
        w = clamp((t - 0.3) / 0.6)
        c.ring_outline(bx, by, BULL_R + 30 * ease_out(w), 1.4, accent, (1 - w) * 0.9)
        c.wordmark(accent, t - 0.55)
        frames.append(c.done())
    return frames


def png_bytes(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "fog"
    theme = THEMES[name]
    accent = sys.argv[2] if len(sys.argv) > 2 else theme.get("accent", "#2F6BFF")
    parts = [("part0", "c 1 0", intro(theme, accent)),
             ("part1", "p 0 0", loading(theme, accent)),
             ("part2", "c 1 0", finale(theme, accent))]
    OUT.mkdir(exist_ok=True)
    suffix = "-pumpkin" if name == "pumpkin" else ""
    zpath = OUT / f"bootanimation{suffix}.zip"
    desc = f"{W} {H} {FPS}\n" + "".join(f"{kind} {p} {theme['bg']}\n" for p, kind, _ in parts)
    # Android requires an uncompressed (stored) zip
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:
        z.writestr("desc.txt", desc)
        for p, _, frames in parts:
            for i, f in enumerate(frames):
                z.writestr(f"{p}/{i:03d}.png", png_bytes(f))
    hold = [parts[2][2][-1]] * 40
    preview = parts[0][2] + parts[1][2] * 2 + parts[2][2] + hold
    small = [f.resize((W // 2, H // 2), Image.LANCZOS) for f in preview]
    small[0].save(OUT / f"bootanimation{suffix}-preview.gif", save_all=True, append_images=small[1:],
                  duration=1000 // FPS, loop=0, optimize=False, disposal=1)
    print(f"wrote {zpath} ({zpath.stat().st_size // 1024} KB), theme={name}, accent={accent}")
    print(desc)


if __name__ == "__main__":
    main()
