from pathlib import Path
from PIL import Image
import hashlib,json,difflib,html
ROOT=Path(__file__).resolve().parents[1];BACKUP=ROOT.parent/'backups/fishing-v05a-before-v05b-pass2-20261013';OUT=ROOT/'test-results/v05b'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
allowed={'src/game/scenes/BayScene.ts','src/game/art/registry.ts','tests/art-v05a.test.ts','docs/ARCHITECTURE.md'}
changes=[];protected=[];diff=[]
for folder in ['src','public','scripts','tests','docs']:
    oldfiles={p.relative_to(BACKUP).as_posix():p for p in (BACKUP/folder).rglob('*') if p.is_file()}
    newfiles={p.relative_to(ROOT).as_posix():p for p in (ROOT/folder).rglob('*') if p.is_file()}
    for name in sorted(oldfiles.keys()|newfiles.keys()):
        old=oldfiles.get(name);new=newfiles.get(name)
        changed=not(old and new and sha(old)==sha(new))
        if changed:changes.append(dict(path=name,status='new' if not old else 'deleted' if not new else 'modified'))
        if old and not name.startswith('public/assets/') and name not in allowed:
            assert not changed,name
            protected.append(dict(path=name,unchanged=True))
        if changed and not name.startswith('public/assets/'):
            diff.extend(difflib.unified_diff(old.read_text(encoding='utf-8-sig').splitlines(True) if old else [],new.read_text(encoding='utf-8-sig').splitlines(True) if new else [],fromfile='v05a/'+name if old else '/dev/null',tofile='v05b/'+name if new else '/dev/null'))
for name in ['package.json','package-lock.json','index.html','tsconfig.json','vite.config.ts']:
    if (BACKUP/name).exists():assert sha(BACKUP/name)==sha(ROOT/name),name
assets=json.loads((OUT/'asset-preparation.json').read_text(encoding='utf8'))
for asset in assets:assert sha(ROOT.parent/'art_lab/fishing_art_pack_v2'/asset['source'])==asset['sourceSha256'],asset['source']
boats=[a for a in assets if 'metrics' in a]
for boat in boats:
    area=[m['alphaArea'] for m in boat['metrics']];assert max(area)/min(area)<1.025
water=Image.open(ROOT/'public/assets/water/water_approved_mirrored_tile.png')
assert water.crop((0,0,1,2048)).tobytes()==water.crop((2047,0,2048,2048)).tobytes()
assert water.crop((0,0,2048,1)).tobytes()==water.crop((0,2047,2048,2048)).tobytes()
assert water.crop((1023,0,1024,2048)).tobytes()==water.crop((1024,0,1025,2048)).tobytes()
assert water.crop((0,1023,2048,1024)).tobytes()==water.crop((0,1024,2048,1025)).tobytes()
source_config=sum(1 for p in protected if p['path'].startswith(('src/','public/')))
(OUT/'protected.json').write_text(json.dumps(dict(result='passed',sourceConfigFiles=source_config,protected=protected,approvedSourceFilesVerified=len(assets),boatAlphaRatio={b['source']:max(m['alphaArea'] for m in b['metrics'])/min(m['alphaArea'] for m in b['metrics']) for b in boats},waterEdges='pixel-identical',runtimeBytes=sum(a['bytes'] for a in assets),decodedRgbaMiB=sum(a['size'][0]*a['size'][1]*4 for a in assets)/1024**2),indent=2)+'\n',encoding='utf8')
(OUT/'changes.json').write_text(json.dumps(changes,indent=2)+'\n',encoding='utf8');(OUT/'source.diff').write_text(''.join(diff),encoding='utf8')
cards=[]
for image in sorted((OUT/'browser').glob('*.png')):
    cards.append(f'<figure><a href="browser/{image.name}"><img loading="lazy" src="browser/{image.name}" alt="{html.escape(image.stem)}"></a><figcaption>{html.escape(image.stem)}</figcaption></figure>')
(OUT/'screenshots.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Тихая бухта · v0.5b Pass 2</title><style>body{background:#143f49;color:#f6edda;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}figure{margin:0;background:#285963;border-radius:12px;overflow:hidden}img{display:block;width:100%;height:270px;object-fit:contain;background:#102f37}figcaption{padding:14px}</style><h1>Тихая бухта · v0.5b Pass 2</h1><p>7 типов лодок × 8 направлений, обе зоны, читаемый груз, tiled water и mobile portrait. Нажмите для полного размера.</p><main>'+''.join(cards)+'</main></html>',encoding='utf8')
print(f'PASS: {len(protected)} protected files ({source_config} source/config); {len(assets)} approved originals; {len(cards)} screenshots; max boat area ratio {max(max(m["alphaArea"] for m in b["metrics"])/min(m["alphaArea"] for m in b["metrics"]) for b in boats):.4f}')
