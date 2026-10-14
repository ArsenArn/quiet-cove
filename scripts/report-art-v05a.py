"""Verify the protected baseline and produce a reviewable filesystem diff (no Git checkout here)."""
from pathlib import Path
import hashlib,json,difflib,html
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results/v05a'
BACKUP=ROOT.parent/'backups/fishing-v04b-before-v05a-20261013'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
baseline=json.loads((OUT/'baseline-hashes.json').read_text(encoding='utf-8-sig'))
changes=[];protected=[];diff=[]
for entry in baseline:
    current=Path(entry['Path']);relative=current.relative_to(ROOT);old=BACKUP/relative
    unchanged=current.exists() and sha(current).upper()==entry['Hash'].upper()
    record=dict(path=relative.as_posix(),unchanged=unchanged)
    if str(relative).replace('\\','/')=='src/game/scenes/BayScene.ts':
        changes.append(record)
        diff.extend(difflib.unified_diff(old.read_text(encoding='utf8').splitlines(True),current.read_text(encoding='utf8').splitlines(True),fromfile='v04b/'+relative.as_posix(),tofile='v05a/'+relative.as_posix()))
    else:protected.append(record)
assert all(r['unchanged'] for r in protected),[r for r in protected if not r['unchanged']]
assets=json.loads((OUT/'asset-preparation.json').read_text())
for asset in assets:
    source=ROOT.parent/'art_lab/fishing_art_pack_v2'/asset['source']
    assert sha(source)==asset['sourceSha256'],asset['source']
(OUT/'protected.json').write_text(json.dumps(dict(result='passed',protected=protected,modifiedBaselineSources=changes,approvedSourceFilesVerified=len(assets),backup=str(BACKUP)),indent=2)+'\n',encoding='utf8')
for folder in ['src','public','scripts','tests','docs']:
    for current in (ROOT/folder).rglob('*'):
        if current.is_file() and not (BACKUP/current.relative_to(ROOT)).exists():
            changes.append(dict(path=current.relative_to(ROOT).as_posix(),new=True,bytes=current.stat().st_size))
            if current.suffix in ['.ts','.mjs','.py','.md']:
                diff.extend(difflib.unified_diff([],current.read_text(encoding='utf8').splitlines(True),fromfile='/dev/null',tofile='v05a/'+current.relative_to(ROOT).as_posix()))
old=BACKUP/'docs/ARCHITECTURE.md';current=ROOT/'docs/ARCHITECTURE.md'
changes.append(dict(path='docs/ARCHITECTURE.md',unchanged=sha(old)==sha(current)))
diff.extend(difflib.unified_diff(old.read_text(encoding='utf8').splitlines(True),current.read_text(encoding='utf8').splitlines(True),fromfile='v04b/docs/ARCHITECTURE.md',tofile='v05a/docs/ARCHITECTURE.md'))
(OUT/'source.diff').write_text(''.join(diff),encoding='utf8')
(OUT/'changes.json').write_text(json.dumps(changes,indent=2)+'\n',encoding='utf8')
captions={'main-bay':'Основная бухта','directions-cargo':'8 направлений и грузовые палубы','full-cargo':'Полный трюм при обычном масштабе','cargo-detail':'Стопка ящиков: увеличенный просмотр','resources-full':'Ресурсы FULL','resources-medium':'Ресурсы MEDIUM','resources-low':'Ресурсы LOW','resources-last':'Ресурсы LAST','floating-crates':'Отдельные ящики в воде','payouts':'Отдельные выплаты','golden':'Золотой катер','golden-piles':'10 физических кучек Golden','port-workers':'Рабочие возле порта','stress':'Стресс-сценарий','mobile-port':'Порт 390 × 844','mobile-game':'Игра 390 × 844'}
cards=[]
for image in sorted((OUT/'browser').glob('*.png')):
    suffix=image.stem.removeprefix('fast-').removeprefix('reference-');caption=captions.get(suffix,image.stem)
    cards.append(f'<figure><a href="browser/{image.name}"><img loading="lazy" src="browser/{image.name}" alt="{html.escape(caption)}"></a><figcaption>{html.escape(caption)} · {html.escape(image.stem)}</figcaption></figure>')
(OUT/'screenshots.html').write_text('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Тихая бухта · v0.5a</title><style>body{margin:0;background:#123e48;color:#f6edda;font:16px system-ui;padding:24px}h1{font-size:28px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px}figure{margin:0;background:#245965;border-radius:12px;overflow:hidden}img{display:block;width:100%;height:270px;object-fit:contain;background:#102f37}figcaption{padding:14px}a{color:#ffe195}</style><h1>Тихая бухта · ART v0.5a</h1><p>Phaser WebGL, FAST / REFERENCE, desktop и mobile portrait. Нажмите на изображение для полного размера. Арт-сценарии используют тестовые состояния; gameplay и управление проверены отдельными browser smoke.</p><main>'+''.join(cards)+'</main></html>',encoding='utf8')
print(f'PASS: {len(protected)} baseline source/config files unchanged; {len(assets)} approved originals unchanged; {len(cards)} screenshots indexed')
