from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import numpy as np
import json

root = Path(__file__).resolve().parent
font = ImageFont.truetype('C:/Windows/Fonts/msjh.ttc', 22)
files = list((root/'result-previews').glob('*.png'))
sheet = Image.new('RGB', (1500, 240*len(files)), '#eeeeee')
draw = ImageDraw.Draw(sheet)
metrics = []

def silhouette(path):
    image = Image.open(path).convert('RGBA')
    background = Image.new('RGBA', image.size, 'white')
    background.alpha_composite(image)
    gray = background.convert('L')
    ink = gray.point(lambda p: 255 if p < 128 else 0)
    return gray.crop(ink.getbbox())

for i, path in enumerate(files):
    original = silhouette(root/'normalized-originals'/path.name)
    result = silhouette(path)
    size = (2000, round(original.height/original.width*2000))
    a = np.array(original.resize(size, Image.Resampling.LANCZOS)) < 128
    b = np.array(result.resize(size, Image.Resampling.LANCZOS)) < 128
    metrics.append({'file':path.stem, 'ink_iou':float((a&b).sum()/(a|b).sum()), 'different_pixels':int((a!=b).sum()), 'compared_pixels':int(a.size)})
    thumb=ImageOps.contain(result.convert('RGB'), (1450, 175))
    draw.text((20, 240*i+8),path.stem, font=font, fill='black')
    sheet.paste(thumb, (20,240*i+48))
sheet.save(root/'comparison-sheet.png')
(root/'visual-comparison.json').write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(metrics, ensure_ascii=False, indent=2))
