import type { Balance, Profile } from './types';
export const profiles: Profile[] = ['fast', 'reference'];
export const questTypes = ['catch_sardine','deliver_fish','catch_total','cargo_level','resource_ready','normal_workers','fish_sales_earned','earn_coins','speedboat_ordered','speedboat_ready','area_unlocked','defender_ready','pirates_killed','metal_storage_ready','metal_cutter_owned','wreck_ready','metal_deposited','salvage_workers','metal_storage_capacity','pirate_den_closed','expedition_route_ready'];
export function validateConfig(value: unknown): asserts value is Balance {
  if (!value || typeof value !== 'object') throw Error('Баланс должен быть JSON-объектом');
  const c = value as Balance;
  for (const key of ['world','units','workers','resources','quests','combat','salvage','monetization','ai','save','simulation','expansion','special','capacity_upgrades','interaction','navigation','presentation','docks','resource_burst']) if (!(key in c)) throw Error(`Баланс: отсутствует ${key}`);
  if (c.schema_version !== 1 || !profiles.includes(c.profile)) throw Error('Неизвестная версия или профиль баланса');
  const numericCheck = (o: unknown, path = '') => { if (typeof o === 'number' && (!Number.isFinite(o) || o < 0)) throw Error(`Некорректное число ${path}`); if (o && typeof o === 'object') for (const [k,v] of Object.entries(o)) numericCheck(v, `${path}.${k}`); };
  numericCheck(c);
  if(c.zone2_layout){
    if(c.profile!=='fast')throw Error('Zone 2 layout is FAST-only');
    for(const p of [c.zone2_layout.fish_unload,c.zone2_layout.entrance_dock])if(!p || !Number.isFinite(p.x+p.y) || p.x<0 || p.y<0 || p.x>c.world.width || p.y>c.world.height)throw Error('Invalid Zone 2 layout point');
    if(c.zone2_layout.fish_unload.x<=c.world.gate_x)throw Error('Zone 2 unload must be in open sea');
  }
  if(c.second_port){
    const p=c.second_port;
    if(!Number.isInteger(p.cost)||p.cost<=0||!Number.isInteger(p.metal_cost)||p.metal_cost!<0||!(p.build_s>0)||!c.interaction.purchase_points.secondPort)throw Error('Invalid second port');
    for(const point of [p.unload,p.hut,c.interaction.purchase_points.secondPort])if(!point||!Number.isFinite(point.x+point.y)||point.x<=c.world.gate_x||point.x>c.world.width||point.y<0||point.y>c.world.height)throw Error('Invalid second port point');
  }
  if(c.player_regen && (!(c.player_regen.delay_s>0)||!(c.player_regen.hp_per_s>0)))throw Error('Invalid player regeneration');
  const positive = (n: number, name: string) => { if (!(n > 0) || !Number.isFinite(n)) throw Error(`Баланс: ${name} должен быть > 0`); };
  for (const [id, u] of Object.entries(c.units)) { positive(u.speed, `${id}.speed`); positive(u.gather_s, `${id}.gather_s`); }
  for (const id of ['worker','speedboat','salvage'] as const) if (!Number.isInteger(c.units[id].capacity) || c.units[id].capacity<1) throw Error(`Неверный трюм ${id}`);
  for (const u of c.capacity_upgrades) if (!Number.isInteger(u.level) || u.level<1 || u.capacity!==c.units.player.capacity[u.level]) throw Error(`Не совпадают таблицы трюма Lv.${u.level}`);
  for (const key of ['pirate_hp','pirate_damage','pirate_speed','defender_hp','defender_damage','defender_speed','attack_s','attack_radius','detect_radius','chase_radius','projectile_speed','projectile_lifetime_s','spawn_s','respawn_s'] as const) positive(c.combat[key],`combat.${key}`);
  for(const n of [c.workers.max_count,c.salvage.worker.max_count,c.combat.max_enemies]) if(!Number.isInteger(n) || n<1) throw Error('Неверный лимит судов');
  positive(c.salvage.storage.capacity,'metal capacity');positive(c.salvage.upgrade.capacity,'metal upgraded capacity');
  positive(c.units.player.deposit_s_per_crate, 'deposit time');
  if (!Array.isArray(c.units.player.capacity) || !c.units.player.capacity.length || c.units.player.capacity.some(n => !Number.isInteger(n) || n < 1)) throw Error('Неверная вместимость');
  for (const [id,r] of Object.entries(c.resources)) { for (const key of ['stock','portion_hp','damage_per_catch','gather_s','regrow_s','restock_s'] as const) positive(r[key], `${id}.${key}`); if (!Number.isInteger(r.stock) || ![1,2].includes(r.zone) || !['fish','metal'].includes(r.kind) || r.x >= c.world.width || r.y >= c.world.height) throw Error(`Неверный ресурс ${id}`); }
  if(c.fast_zone2) {
    if(c.profile!=='fast')throw Error('Late-tier overrides are FAST-only');
    for(const [table,min,max] of [[c.fast_zone2.worker_costs,3,c.workers.max_count-1],[c.fast_zone2.cargo_costs,4,c.capacity_upgrades.length]] as const){
      if(!table || typeof table!=='object' || Array.isArray(table))throw Error('Invalid late-tier price table');
      for(const [key,price] of Object.entries(table))if(!Number.isInteger(Number(key)) || String(Number(key))!==key || Number(key)<min || Number(key)>max || !Number.isInteger(price) || price<=0)throw Error('Invalid FAST Zone 2 price');
    }
  }
  positive(c.world.width, 'world.width'); positive(c.world.height, 'world.height'); positive(c.simulation.dt_s, 'simulation.dt_s'); positive(c.save.autosave_s, 'autosave');
  for(const key of ['purchase_radius','coins_per_s','metal_per_s','coin_delay_s','coin_radius','coin_speed','max_coin_stacks'] as const) positive(c.interaction[key],`interaction.${key}`);
  for(const key of ['purchase_stationary_delay_s','purchase_max_stationary_speed','coin_scatter_radius'] as const)positive(c.interaction[key],`interaction.${key}`);
  if(!c.interaction.reveal_at_quest || Object.values(c.interaction.reveal_at_quest).some(n=>!Number.isInteger(n)||n<1||n>c.quests.length))throw Error('Неверные условия раскрытия покупок');
  for(const key of ['deposit_radius','resource_radius','arrival_radius'] as const)positive(c.world[key],`world.${key}`);
  if(c.world.arrival_radius>=Math.min(c.interaction.purchase_radius,c.world.deposit_radius))throw Error('Радиус прибытия не должен превышать радиусы взаимодействия');
  for(const key of ['purchase_cooldown_s','purchase_exit_hysteresis','purchase_pour_min_seconds','purchase_pour_max_seconds','purchase_pour_ease','purchase_pour_cost_scale','joystick_radius','joystick_thumb_radius','ui_tap_slop'] as const)positive(c.interaction[key],`interaction.${key}`);
  if(c.interaction.purchase_pour_max_seconds<c.interaction.purchase_pour_min_seconds || c.interaction.purchase_pour_ease<1 || !(c.interaction.joystick_deadzone>=0 && c.interaction.joystick_deadzone<1) || !(c.interaction.joystick_opacity>0 && c.interaction.joystick_opacity<=1) || c.interaction.joystick_thumb_radius>=c.interaction.joystick_radius)throw Error('Неверная оплата или джойстик');
  positive(c.world.floating_crate_lifetime_s,'crate lifetime');
  if(!Number.isInteger(c.world.max_world_resource_crates) || c.world.max_world_resource_crates<1 || Object.values(c.resources).some(r=>!Number.isInteger(r.drop_crates)||r.drop_crates<1))throw Error('Неверное число ящиков');
  positive(c.resource_burst.duration_s,'resource burst');
  if(!Array.isArray(c.docks) || c.docks.some(d=>!c.interaction.purchase_points[d.id] || !Number.isFinite(d.x+d.y+d.end?.x+d.end?.y) || !(d.width>0) || ![1,2].includes(d.zone) || !['cargo','worker','speedboat','defender'].includes(d.equipment)))throw Error('Неверные причалы');
  if(!Number.isInteger(c.interaction.max_coin_stacks)) throw Error('Лимит монет должен быть целым');
  for(const key of ['cargo','worker','speedboat','gate','defender','storage','cutter','salvage','storageUpgrade','den','route']) {const p=c.interaction.purchase_points[key];if(!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x<0 || p.y<0 || p.x>c.world.width || p.y>c.world.height) throw Error(`Нет зоны покупки ${key}`);}
  positive(c.navigation.boat_radius,'boat_radius');
  const traffic=c.navigation.traffic;
  if(traffic){
    for(const kind of ['player','worker','speedboat','salvage','defender','pirate'] as const)positive(traffic.radii?.[kind],`traffic.radii.${kind}`);
    for(const key of ['neighbor_radius','correction_speed','arrival_spacing','stuck_s','repath_s'] as const)positive(traffic[key],`traffic.${key}`);
    if(traffic.neighbor_radius<Math.max(...Object.values(traffic.radii))*2+12 || traffic.repath_s<traffic.stuck_s)throw Error('Неверный радиус поиска или cooldown navigation');
  }
  if(!Array.isArray(c.navigation.obstacles)) throw Error('Нет геометрии препятствий');
  for(const o of c.navigation.obstacles){positive(o.rx,'obstacle.rx');positive(o.ry,'obstacle.ry');if(!Number.isFinite(o.x)||!Number.isFinite(o.y)||!['island','rock'].includes(o.kind))throw Error('Неверное препятствие');}
  for(const key of ['golden_speed','golden_spawn_radius','golden_interaction_radius'] as const)positive(c.presentation[key],`presentation.${key}`);
  for(const key of ['max_coin_views','max_live_effects','camera_focus_duration_s','camera_move_duration_s','camera_return_duration_s','target_arrow_offset','target_ring_radius'] as const)positive(c.presentation[key],`presentation.${key}`);
  if(!Number.isInteger(c.presentation.max_coin_views))throw Error('Число визуальных монет должно быть целым');
  for(const key of ['golden_label_interval_s','golden_scatter_radius','golden_pile_count'] as const)positive(c.presentation[key],`presentation.${key}`);
  if(c.presentation.golden_pile_count!==10 || c.presentation.golden_scatter_radius<=c.interaction.coin_radius || c.monetization.golden_min_coins<10)throw Error('Золотая награда требует 10 кучек за пределами радиуса сбора');
  if(!Array.isArray(c.presentation.defender_patrol)||c.presentation.defender_patrol.length<3||c.presentation.defender_patrol.length>5||c.presentation.defender_patrol.some(p=>p.x<c.world.gate_x+c.world.edge_margin||p.x>c.world.width||p.y<0||p.y>c.world.height))throw Error('Неверный патруль');
  if (c.ai.choose_best_probability > 1 || c.quests.length !== 34) throw Error('Неверная вероятность AI или количество квестов');
  if (c.workers.timers_s.length < c.workers.max_count) throw Error('Не хватает таймеров рабочих');
  const salvageTimers=c.salvage.worker.timers_s;
  if(salvageTimers!==undefined && (!Array.isArray(salvageTimers)||!salvageTimers.length||salvageTimers.some(n=>!Number.isFinite(n)||n<0)))throw Error('Неверные таймеры судов-разборщиков');
  c.quests.forEach((q,i) => { if (q.id !== i+1 || !questTypes.includes(q.type) || !['lifetime','since_activation'].includes(q.progress_mode) || typeof q.label !== 'string') throw Error(`Неверный квест ${i+1}`); if (q.type === 'resource_ready' && !c.resources[q.target]) throw Error(`Неизвестный ресурс квеста ${q.id}`); if(q.type!=='resource_ready' && (typeof q.target!=='number' || q.target<=0 || !Number.isFinite(q.target))) throw Error(`Неверная цель ${q.id}`); });
}
export async function loadBalance(profile: Profile): Promise<Balance> {
  if (!profiles.includes(profile)) throw Error('Неизвестный профиль');
  const response = await fetch(`${import.meta.env.BASE_URL}balance/balance_${profile}.json`);
  if (!response.ok) throw Error(`Не удалось загрузить баланс (${response.status})`);
  const config: unknown = await response.json(); validateConfig(config);
  if (config.profile !== profile) throw Error('Имя профиля не совпадает с файлом');
  return config;
}
export async function loadSelection() {
  const res = await fetch(`${import.meta.env.BASE_URL}balance/balance_selection.json`);
  if (!res.ok) throw Error('Не удалось прочитать balance_selection.json');
  const selection = await res.json();
  if (!profiles.includes(selection.default_profile)) throw Error('Неизвестный стартовый профиль');
  return selection as { default_profile: Profile; allow_debug_profile_switch: boolean; query_override: boolean };
}
