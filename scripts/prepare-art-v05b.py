"""Pass 2 runtime-only transforms. Never writes to the approved art pack."""
from pathlib import Path
from PIL import Image
import hashlib,json,math
GAME=Path(__file__).resolve().parents[1];PACK=GAME.parent/'art_lab/fishing_art_pack_v2';OUT=GAME/'public/assets'
REPORT=GAME/'test-results/v05b';REPORT.mkdir(parents=True,exist_ok=True)
records=[]
def save(image,source,target,**info):
    path=OUT/target;path.parent.mkdir(parents=True,exist_ok=True);image.save(path,optimize=True)
    records.append(dict(source=source,target='assets/'+target,sourceSha256=hashlib.sha256((PACK/source).read_bytes()).hexdigest(),size=image.size,bytes=path.stat().st_size,**info))
def bounds(image):return image.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox()
def alpha_area(image):return sum(value*count for value,count in enumerate(image.getchannel('A').histogram()))/255
def boat(kind):
    source=f'boats/atlases/boat_{kind}_8dir.png';original=Image.open(PACK/source).convert('RGBA')
    # Visually verified bow/stern ordering; manifest compass labels are incorrect for these frames.
    order=[0,7,6,5,4,3,2,1] if kind in ['golden','salvage'] else [0,7,2,3,4,5,6,1] if kind=='guard' else list(range(8))
    frames=[original.crop(((i%4)*512,(i//4)*512,(i%4+1)*512,(i//4+1)*512)) for i in order]
    cropped=[frame.crop(bounds(frame)) for frame in frames]
    target=alpha_area(cropped[0])*(144/max(cropped[0].size))**2
    factors=[math.sqrt(target/alpha_area(frame)) for frame in cropped]
    safety=min(1,176/max(max(f.size)*factor for f,factor in zip(cropped,factors)))
    sheet=Image.new('RGBA',(768,384));metrics=[]
    for i,(frame,factor) in enumerate(zip(cropped,factors)):
        scaled=frame.resize(tuple(round(d*factor*safety) for d in frame.size),Image.Resampling.LANCZOS)
        sheet.alpha_composite(scaled,((i%4)*192+(192-scaled.width)//2,(i//4)*192+(192-scaled.height)//2))
        metrics.append(dict(direction=['N','NE','E','SE','S','SW','W','NW'][i],sourceFrame=order[i],size=scaled.size,alphaArea=alpha_area(scaled)))
    areas=[m['alphaArea'] for m in metrics]
    assert max(areas)/min(areas)<1.025,(kind,areas)
    save(sheet,source,f'boats/boat_{kind}_8dir.png',cell=192,frameOrder=order,metrics=metrics)
def resource(kind):
    source=f'resources/atlases/{kind}_4states.png';original=Image.open(PACK/source).convert('RGBA')
    frames=[original.crop(((i%2)*512,(i//2)*512,(i%2+1)*512,(i//2+1)*512)) for i in range(4)]
    cropped=[f.crop(bounds(f)) for f in frames];factor=170/max(max(f.size) for f in cropped)
    sheet=Image.new('RGBA',(384,384))
    for i,f in enumerate(cropped):
        scaled=f.resize(tuple(round(d*factor) for d in f.size),Image.Resampling.LANCZOS)
        sheet.alpha_composite(scaled,((i%2)*192+(192-scaled.width)//2,(i//2)*192+(192-scaled.height)//2))
    save(sheet,source,f'resources/{kind}_4states.png',cell=192)
def image(source,target,limit,canvas=None):
    original=Image.open(PACK/source).convert('RGBA');cropped=original.crop(original.getchannel('A').getbbox());cropped.thumbnail(limit,Image.Resampling.LANCZOS)
    if canvas:
        result=Image.new('RGBA',canvas);result.alpha_composite(cropped,((canvas[0]-cropped.width)//2,(canvas[1]-cropped.height)//2))
    else:result=cropped
    save(result,source,target)
for kind in ['player','worker','speed','guard','pirate','golden','salvage']:boat(kind)
for kind in ['sardines','crabs','mussels','red_snapper','tuna','lobster','swordfish','squid','shipwreck']:resource(kind)
for kind in ['sardines','crabs','mussels','red_snapper','tuna','lobster','swordfish','squid','scrap']:image(f'cargo/sprites/crate_{kind}.png',f'cargo/crate_{kind}.png',(112,112),(128,128))
for kind in ['single','small_stack','large_pile']:image(f'coins/sprites/coin_{kind}.png',f'coins/coin_{kind}.png',(84,84),(96,96))
for kind in ['harbor_main','pirate_lair','defender_dock','zone2_purchase','scrap_storage']:
    source=f'buildings/{kind}.png';save(Image.open(PACK/source).resize((640,640),Image.Resampling.LANCZOS),source,source)
# The pack's matched-edge alternative has baked straight grid lines. Mirror-repeat the approved original,
# preserving its artwork and matching every boundary without synthesizing a different water image.
source='water/water_approved_original.png';base=Image.open(PACK/source).convert('RGB').resize((1024,1024),Image.Resampling.LANCZOS)
tile=Image.new('RGB',(2048,2048));tile.paste(base,(0,0));tile.paste(base.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(1024,0))
tile.paste(base.transpose(Image.Transpose.FLIP_TOP_BOTTOM),(0,1024));tile.paste(base.transpose(Image.Transpose.ROTATE_180),(1024,1024))
assert tile.crop((0,0,1,2048)).tobytes()==tile.crop((2047,0,2048,2048)).tobytes()
assert tile.crop((0,0,2048,1)).tobytes()==tile.crop((0,2047,2048,2048)).tobytes()
save(tile,source,'water/water_approved_mirrored_tile.png',repeat='mirror 2x2 of approved original; exact matching opposite edges')
for number in [3,6,7,9,12,14,15,17,18,30,33,36,37,38,39,49,51,55]:
    source=f'environment/props/env_{number:02}.png';image(source,f'environment/env_{number:02}.png',(512,384))
(REPORT/'asset-preparation.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf8')
print(f'{len(records)} shared runtime textures; {sum(r["bytes"] for r in records):,} bytes; approved pack unchanged')
