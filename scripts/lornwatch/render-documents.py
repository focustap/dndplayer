"""Render authored in-world documents, not generated NPC dialogue or image edits."""
import json
import sys
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
rows = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
out = root / "outputs/lornwatch/discoverables"
out.mkdir(parents=True, exist_ok=True)
font_root = Path("C:/Windows/Fonts")
heading = ImageFont.truetype(str(font_root / "georgiab.ttf"), 46)
body = ImageFont.truetype(str(font_root / "georgia.ttf"), 34)
small = ImageFont.truetype(str(font_root / "georgia.ttf"), 23)
for doc in rows:
    if not doc.get("text"):
        continue
    im = Image.new("RGB", (1200, 1400), "#f6ecd3")
    draw = ImageDraw.Draw(im)
    draw.rectangle((45, 45, 1155, 1355), outline="#426d60", width=5)
    draw.rectangle((62, 62, 1138, 1338), outline="#b89b5c", width=2)
    draw.text((110, 110), doc.get("imprint", "LORNWATCH"), font=small, fill="#426d60")
    y = 185
    for index, paragraph in enumerate(doc["text"].split("\n")):
        font = heading if index == 0 else body
        for line in textwrap.wrap(paragraph, width=35 if index == 0 else 48):
            draw.text((110, y), line, font=font, fill="#292b28")
            y += 62 if index == 0 else 52
        y += 25
    if y > 1280:
        raise RuntimeError(f"Document overflow: {doc['key']}")
    draw.text((110, 1265), doc.get("footer", "Civic copy • retained for public inspection"), font=small, fill="#69664f")
    im.save(out / f"{doc['key']}.png")
print(f"Rendered {sum(bool(d.get('text')) for d in rows)} evidence images")
