"""Deterministic runtime resizing only. Approved local art pack is read-only."""
from pathlib import Path
from PIL import Image
import hashlib, json

GAME = Path(__file__).resolve().parents[1]
PACK = GAME.parent / 'art_lab/fishing_art_pack_v2'
OUT = GAME / 'public/assets'
records = []

def save(image, source, target, **info):
    path = OUT / target
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)
    records.append(dict(source=source, target='assets/'+target, sourceSha256=hashlib.sha256((PACK/source).read_bytes()).hexdigest(), size=image.size, bytes=path.stat().st_size, **info))

def atlas(source, target, count, columns, cell, visual, normalize_each=False):
    original = Image.open(PACK/source).convert('RGBA')
    frames = [original.crop(((i%columns)*512,(i//columns)*512,(i%columns+1)*512,(i//columns+1)*512)) for i in range(count)]
    # Common scale for resource stages: fewer fish stay physically smaller.
    bounds = [f.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox() for f in frames]
    longest = max(max(b[2]-b[0],b[3]-b[1]) for b in bounds)
    sheet = Image.new('RGBA',(columns*cell,((count+columns-1)//columns)*cell))
    for i,(frame,b) in enumerate(zip(frames,bounds)):
        cropped=frame.crop(b)
        factor=visual/(max(cropped.size) if normalize_each else longest)
        resized=cropped.resize(tuple(max(1,round(d*factor)) for d in cropped.size),Image.Resampling.LANCZOS)
        sheet.alpha_composite(resized,((i%columns)*cell+(cell-resized.width)//2,(i//columns)*cell+(cell-resized.height)//2))
    save(sheet,source,target,cell=cell,bounds=bounds,normalization='per direction' if normalize_each else 'common stage scale')

for boat in ['player','worker','speed','golden']:
    atlas(f'boats/atlases/boat_{boat}_8dir.png',f'boats/boat_{boat}_8dir.png',8,4,128,112,True)
for resource in ['sardines','crabs','mussels','red_snapper','tuna']:
    atlas(f'resources/atlases/{resource}_4states.png',f'resources/{resource}_4states.png',4,2,192,170)
    source=f'cargo/sprites/crate_{resource}.png'
    original=Image.open(PACK/source).convert('RGBA')
    cropped=original.crop(original.getchannel('A').getbbox())
    cropped.thumbnail((112,112),Image.Resampling.LANCZOS)
    image=Image.new('RGBA',(128,128));image.alpha_composite(cropped,((128-cropped.width)//2,(128-cropped.height)//2))
    save(image,source,f'cargo/crate_{resource}.png')
for coin in ['single','small_stack','large_pile']:
    source=f'coins/sprites/coin_{coin}.png'
    original=Image.open(PACK/source).convert('RGBA')
    cropped=original.crop(original.getchannel('A').getbbox());cropped.thumbnail((84,84),Image.Resampling.LANCZOS)
    image=Image.new('RGBA',(96,96));image.alpha_composite(cropped,((96-cropped.width)//2,(96-cropped.height)//2))
    save(image,source,f'coins/coin_{coin}.png')
source='buildings/harbor_main.png'
save(Image.open(PACK/source).resize((640,640),Image.Resampling.LANCZOS),source,source)
source='water/water_approved_original.png'
save(Image.open(PACK/source).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS),source,source)
(GAME/'test-results/v05a').mkdir(parents=True,exist_ok=True)
(GAME/'test-results/v05a/asset-preparation.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf8')
print(f'{len(records)} runtime textures, {sum(r["bytes"] for r in records):,} bytes; no source modifications')
