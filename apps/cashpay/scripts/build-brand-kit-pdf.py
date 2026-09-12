"""Generate public/brand-kit.pdf from the official Cash Pay logo and palette."""

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

pdfmetrics.registerFont(TTFont("KitSans", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("KitSans-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

ROOT = Path(__file__).resolve().parents[1]
LOGO = ROOT / "public" / "logo.png"
OUT = ROOT / "public" / "brand-kit.pdf"

VIOLET = (0x3B / 255, 0x14 / 255, 0x5B / 255)
TEAL = (0x10 / 255, 0x88 / 255, 0xA2 / 255)
TEAL_INK = (0x0C / 255, 0x6F / 255, 0x85 / 255)
BRONZE = (0xAC / 255, 0x64 / 255, 0x1F / 255)
BRONZE_INK = (0x8A / 255, 0x4E / 255, 0x12 / 255)
MIST = (0xF3 / 255, 0xFA / 255, 0xFB / 255)
WHITE = (1, 1, 1)

SWATCHES = [
    ("Helix Violet", "#3B145B", VIOLET, "Wordmark / ink"),
    ("Helix Teal", "#1088A2", TEAL, "Strand / primary"),
    ("Teal Ink", "#0C6F85", TEAL_INK, "Links, captions"),
    ("Node Bronze", "#AC641F", BRONZE, "Highlight only"),
    ("Bronze Ink", "#8A4E12", BRONZE_INK, "Published cash"),
]


def fill(c, color, x, y, w, h):
    c.setFillColorRGB(*color)
    c.rect(x, y, w, h, fill=1, stroke=0)


def draw_page1(c, width, height):
    fill(c, MIST, 0, 0, width, height)
    fill(c, VIOLET, 0, height - 18, width, 18)
    fill(c, TEAL, 0, 0, width, 10)
    fill(c, BRONZE, 0, 10, width, 4)

    c.drawImage(
        str(LOGO),
        0.85 * inch,
        height - 2.55 * inch,
        width=3.35 * inch,
        height=1.36 * inch,
        mask="auto",
        preserveAspectRatio=True,
        anchor="sw",
    )

    c.setFillColorRGB(*TEAL_INK)
    c.setFont("KitSans", 10)
    c.drawString(0.85 * inch, height - 2.95 * inch, "CASH PAY ADVOCATE")

    c.setFillColorRGB(*VIOLET)
    c.setFont("KitSans-Bold", 42)
    c.drawString(0.85 * inch, height - 3.65 * inch, "Fair for All.")

    c.setFillColorRGB(*VIOLET)
    c.setFont("KitSans", 12)
    lede = (
        "Published hospital cash, named on the tick. This kit is sampled from the "
        "official Double Helix Hub mark — teal strand, violet wordmark, bronze nodes."
    )
    text = c.beginText(0.85 * inch, height - 4.15 * inch)
    text.setFont("KitSans", 11)
    text.setFillColorRGB(*VIOLET)
    text.setLeading(16)
    for line in wrap(lede, 86):
        text.textLine(line)
    c.drawText(text)

    y = height - 6.15 * inch
    box_w = 1.28 * inch
    gap = 0.12 * inch
    x = 0.7 * inch
    for name, hex_code, rgb, use in SWATCHES:
        fill(c, rgb, x, y, box_w, 1.15 * inch)
        c.setFillColorRGB(*WHITE)
        c.setFont("KitSans-Bold", 8)
        c.drawString(x + 8, y + 0.78 * inch, name.upper())
        c.setFont("KitSans", 10)
        c.drawString(x + 8, y + 0.52 * inch, hex_code)
        c.setFont("KitSans", 8)
        c.drawString(x + 8, y + 0.28 * inch, use)
        x += box_w + gap

    c.setFillColorRGB(*TEAL_INK)
    c.setFont("KitSans", 9)
    c.drawString(
        0.85 * inch,
        0.45 * inch,
        "cashpay.doublehelixhub.com  ·  Brand kit  ·  Colors from public/logo.png",
    )


def draw_page2(c, width, height):
    fill(c, MIST, 0, 0, width, height)
    fill(c, VIOLET, 0, height - 18, width, 18)
    fill(c, TEAL, 0, 0, width, 10)

    c.drawImage(
        str(LOGO),
        width - 2.9 * inch,
        height - 1.35 * inch,
        width=1.9 * inch,
        height=0.77 * inch,
        mask="auto",
        preserveAspectRatio=True,
        anchor="sw",
    )

    c.setFillColorRGB(*VIOLET)
    c.setFont("KitSans-Bold", 22)
    c.drawString(0.85 * inch, height - 1.05 * inch, "How to use it")

    sections = [
        (
            "Type",
            "Display: Bricolage Grotesque. Body: Plus Jakarta Sans. CPT and cash: "
            "IBM Plex Mono, tabular-nums. Tagline is always uppercase, tracked, Teal Ink, "
            "and keeps the period: Fair for All.",
        ),
        (
            "Rate color",
            "Bronze Ink is the published cash figure — never decoration. Teal Ink is the "
            "quiet Medicare needle. Do not bring back chargemaster amber #d97706.",
        ),
        (
            "Logo on paper",
            "Print and PDF sheets use the color wordmark on mist or white. Night surfaces "
            "use logo-white.png. Leave one node-diameter of clear space. Do not recolor "
            "the helix.",
        ),
        (
            "Don'ts",
            "Do not call a tick insurance, a bid, or a guaranteed quote. Do not use teal "
            "or raw bronze for body copy on white. Do not edit shared @crm-eco/ui tokens — "
            "this brand lives in apps/cashpay only.",
        ),
    ]

    y = height - 1.85 * inch
    for title, body in sections:
        c.setFillColorRGB(*TEAL)
        c.rect(0.85 * inch, y + 0.08 * inch, 0.18 * inch, 0.18 * inch, fill=1, stroke=0)
        c.setFillColorRGB(*VIOLET)
        c.setFont("KitSans-Bold", 13)
        c.drawString(1.15 * inch, y, title)
        text = c.beginText(1.15 * inch, y - 0.28 * inch)
        text.setFont("KitSans", 10)
        text.setFillColorRGB(*VIOLET)
        text.setLeading(14)
        for line in wrap(body, 82):
            text.textLine(line)
        c.drawText(text)
        y -= 1.35 * inch

    c.setFillColorRGB(*TEAL_INK)
    c.setFont("KitSans", 9)
    c.drawRightString(width - 0.85 * inch, 0.45 * inch, "Fair for All.")


def wrap(text, width):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        trial = f"{current} {word}".strip()
        if len(trial) > width:
            if current:
                lines.append(current)
            current = word
        else:
            current = trial
    if current:
        lines.append(current)
    return lines


def main():
    width, height = letter
    c = canvas.Canvas(str(OUT), pagesize=letter)
    c.setTitle("Cash Pay Advocate — Brand Kit")
    c.setAuthor("Double Helix Hub")
    c.setSubject("Fair for All.")
    draw_page1(c, width, height)
    c.showPage()
    draw_page2(c, width, height)
    c.save()
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
