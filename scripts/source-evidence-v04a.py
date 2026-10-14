"""Read-only 1.0.2 ELF verification. Writes evidence only inside fishing-game."""
import json, pathlib, io, bisect, struct
from elftools.elf.elffile import ELFFile
from capstone import Cs, CS_ARCH_ARM64, CS_MODE_ARM
root=pathlib.Path(__file__).resolve().parents[2]
data=json.loads((root/'research_102/il2cpp_map.json').read_text(encoding='utf-8'))
lib=(root/'research_102/extracted/split_config.arm64_v8a/lib/arm64-v8a/libil2cpp.so').read_bytes()
elf=ELFFile(io.BytesIO(lib)); segments=[s for s in elf.iter_segments() if s['p_type']=='PT_LOAD']
methods=[m for t in data['types'] for m in t['methods'] if m.get('va')]
names={m['va']:m['class']+'.'+m['name'] for m in methods}; addresses=sorted(names)
plt=elf.get_section_by_name('.plt');relplt=elf.get_section_by_name('.rela.plt')
if plt and relplt:
    dynsym=elf.get_section(relplt['sh_link'])
    for index,rel in enumerate(relplt.iter_relocations()):
        names[plt['sh_addr']+32+16*index]=dynsym.get_symbol(rel['r_info_sym']).name
def read(a,n):
    for s in segments:
        if s['p_vaddr']<=a<s['p_vaddr']+s['p_filesz']:
            offset=s['p_offset']+a-s['p_vaddr']; return lib[offset:offset+n]
    raise ValueError(hex(a))
lines=[]; cs=Cs(CS_ARCH_ARM64,CS_MODE_ARM);cs.detail=True
for m in methods:
    if m['name'] not in ('WorkerCost','GoldenReward','EarnRate'):continue
    if not any(x in m['class'] for x in ('EconomySystem','GameConfig')):continue
    a=m['va'];end=addresses[bisect.bisect_right(addresses,a)];lines.append(f"\n## {m['class']}.{m['name']} VA={a:#x}")
    pages={}
    for ins in cs.disasm(read(a,end-a),a):
        note='';ops=ins.operands
        if ins.mnemonic in ('bl','b') and ops[0].type==2:note=names.get(ops[0].imm,'')
        if ins.mnemonic=='adrp':pages[ins.reg_name(ops[0].reg)]=ops[1].imm
        if ins.mnemonic.startswith('ldr') and len(ops)>1 and ops[1].type==3:
            base=ins.reg_name(ops[1].mem.base)
            if base in pages:
                addr=pages[base]+ops[1].mem.disp
                if ins.reg_name(ops[0].reg).startswith('s'):note=f'literal {addr:#x} float32={struct.unpack("<f",read(addr,4))[0]}'
        lines.append(f'{ins.address:#x}: {ins.mnemonic} {ins.op_str}'+(' ; '+note if note else ''))
out=root/'fishing-game/test-results/v04a/source-formulas-102.asm'
out.write_text('\n'.join(lines),encoding='utf-8');print(out, len(lines),'lines')
