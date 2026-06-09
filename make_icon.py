from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

S = 1024
out = Path(__file__).parent / "build"
out.mkdir(exist_ok=True)

def vgrad(size, top, bot):
    g = Image.new("RGB", (1, size), 0)
    for y in range(size):
        t = y / (size - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return g.resize((size, size))

r = int(S * 0.225)
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=r, fill=255)

body = vgrad(S, (32, 32, 42), (8, 8, 13)).convert("RGBA")
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
gd.ellipse([-S * 0.3, -S * 0.55, S * 1.3, S * 0.5], fill=(120, 140, 200, 60))
glow = glow.filter(ImageFilter.GaussianBlur(120))
body = Image.alpha_composite(body, glow)

bars = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(bars)
bw = int(S * 0.105)
gap = int(S * 0.075)
total = bw * 3 + gap * 2
x0 = (S - total) // 2
base = int(S * 0.74)
heights = [int(S * 0.34), int(S * 0.52), int(S * 0.43)]
tops = [(255, 255, 255), (245, 247, 255), (225, 230, 245)]
for i, h in enumerate(heights):
    x = x0 + i * (bw + gap)
    bar = vgrad(S, tops[i], (150, 156, 170)).convert("RGBA")
    bm = Image.new("L", (S, S), 0)
    ImageDraw.Draw(bm).rounded_rectangle([x, base - h, x + bw, base], radius=bw // 2, fill=255)
    bars = Image.composite(bar, bars, bm)

glowbars = bars.filter(ImageFilter.GaussianBlur(26))
icon = body.copy()
icon = Image.alpha_composite(icon, glowbars)
icon = Image.alpha_composite(icon, bars)

hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(hl).rounded_rectangle([6, 6, S - 6, S - 6], radius=r - 4, outline=(255, 255, 255, 40), width=4)
icon = Image.alpha_composite(icon, hl)

final = Image.new("RGBA", (S, S), (0, 0, 0, 0))
final.paste(icon, (0, 0), mask)

png = final.resize((512, 512), Image.LANCZOS)
png.save(out / "icon.png")
final.resize((256, 256), Image.LANCZOS).save(
    out / "icon.ico", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print("wrote", out / "icon.png", "and", out / "icon.ico")
