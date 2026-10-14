// One vector icon vocabulary shared by DOM chrome and Phaser map labels.
export const iconPaths = {
  waves: '<path d="M2 8q4-6 10 0t10 0M2 15q4-6 10 0t10 0" stroke="#ffdc77" stroke-width="3"/><path d="M2 20q4-6 10 0t10 0" stroke="#6ee2eb" stroke-width="3"/>',
  crew: '<circle cx="9" cy="7" r="4" fill="#a9e2fb" stroke="#f5fbff"/><path d="M2 21v-4a7 7 0 0 1 14 0v4Z" fill="#62b8e6" stroke="#ecf8ff"/><path d="M17 4a4 4 0 0 1 0 8M19 15q3 1 3 6h-4" stroke="#a9e2fb"/>',
  settings: '<path d="m10 2 4 0 1 3 3 1 3-1 2 4-2 2v3l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-3L1 9l2-4 3 1 3-1Z" fill="#e8f4fc" stroke="#8acde7"/><circle cx="12" cy="12" r="4" fill="#10546b"/>',
  map: '<path d="m2 13 5-2 5 2 5-2 5 2v9l-5-2-5 2-5-2-5 2Z" stroke="#eefaff"/><path d="M18 6c0 4-6 9-6 9S6 10 6 6a6 6 0 1 1 12 0Z" fill="#fff3cd" stroke="#80c8df"/><circle cx="12" cy="6" r="2" fill="#10546b"/>',
  coin: '<circle cx="12" cy="12" r="9" fill="#ffd46a" stroke="#b47a20"/><circle cx="12" cy="12" r="6" stroke="#fff1ae"/><path d="M13.5 8.5h-2a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-2M12 7v10" stroke="#9b6317"/>',
  cargo: '<path d="m3 7 9-4 9 4v11l-9 4-9-4Z" fill="#dcac67" stroke="#765235"/><path d="m3 7 9 4 9-4M12 11v11M7 5l10 4v5" stroke="#fff0c6"/>',
  boat: '<path d="M3 14h18l-3 6H7Z" fill="#62ced1" stroke="#226278"/><path d="M7 14V8h9v6M10 8V4h4v4" fill="#fff3cd" stroke="#226278"/><path d="M2 22q3-3 6 0 3-3 6 0 3-3 8 0" stroke="#62ced1"/>',
  metal: '<path d="m3 10 4-6h11l3 6-4 9H6Z" fill="#b7cedb" stroke="#526e83"/><path d="M3 10h18M7 4l4 6-5 9M18 4l-4 6 3 9" stroke="#eef8ff"/>',
  anchor: '<path d="M12 7v13M7 11h10M3 14v3q9 9 18 0v-3M3 14l4 2M21 14l-4 2" stroke="#66d9da"/><circle cx="12" cy="4" r="3" stroke="#66d9da"/>',
  fish: '<path d="M18 12q-7-11-15 0 8 11 15 0l4 5V7Z" fill="#8bded6" stroke="#2a7785"/><circle cx="7" cy="11" r="1" fill="#194d64"/>',
  crab: '<ellipse cx="12" cy="14" rx="6" ry="4" fill="#ffad79" stroke="#934d31"/><path d="m7 12-4-4-2 2M17 12l4-4 2 2M6 15l-4 2M18 15l4 2M8 18l-3 3M16 18l3 3" stroke="#ffbd8f"/><path d="M9 10V8M15 10V8" stroke="#ffbd8f"/>',
  shell: '<path d="M12 21 3 13Q0 3 12 3t9 10Z" fill="#d8b8ea" stroke="#745486"/><path d="M12 20V6M12 20 6 7M12 20l6-13" stroke="#fff2db"/>',
  squid: '<path d="M6 14Q5 4 12 2q7 2 6 12Z" fill="#c6a7e7" stroke="#735888"/><path d="M7 14q-4 8-5 4M10 14v7M14 14v7M17 14q4 8 5 4" stroke="#ddc4f4"/><circle cx="10" cy="12" r="1" fill="#254961"/><circle cx="14" cy="12" r="1" fill="#254961"/>',
  compass: '<circle cx="12" cy="12" r="9" stroke="#9bdeda"/><path d="m16 7-3 7-6 3 3-7Z" fill="#ffd46a" stroke="#b47a20"/>',
  shield: '<path d="M12 2 3 6v6q0 6 9 10 9-4 9-10V6Z" fill="#6abcb6" stroke="#b5f2dd"/><path d="m7 12 3 3 7-7" stroke="#fff7d6"/>',
  pirate: '<path d="m5 19 14-7M5 12l14 7" stroke="#f4a49a"/><path d="M6 8a6 6 0 0 1 12 0v5l-3 1v3H9v-3l-3-1Z" fill="#ffe4d6" stroke="#9b5255"/><circle cx="9" cy="9" r="1.5" fill="#9b5255"/><circle cx="15" cy="9" r="1.5" fill="#9b5255"/>',
  check: '<circle cx="12" cy="12" r="10" fill="#48ac83"/><path d="m6 12 4 4 8-8" stroke="#fffbe7"/>',
  clock: '<circle cx="12" cy="12" r="9" stroke="#ffe2a1"/><path d="M12 6v6l4 2" stroke="#ffe2a1"/>',
} as const;
export type IconName = keyof typeof iconPaths;
export const iconAssets = {
  coin:'assets/coins/coin_single.png',cargo:'assets/cargo/crate_sardines.png',
  boat:'assets/boats/boat_worker_8dir.png',
} as const;
export function iconSVG(name:IconName) {return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;}
export function icon(name:IconName) {
  if(name==='boat')return `<span class="ui-icon ui-art-boat" aria-hidden="true"></span>`;
  if(name==='coin'||name==='cargo')return `<span class="ui-icon" aria-hidden="true"><img src="${iconAssets[name]}" alt="" draggable="false"></span>`;
  return `<span class="ui-icon" aria-hidden="true">${iconSVG(name)}</span>`;
}
