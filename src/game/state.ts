import type { Balance, Point, Profile } from '../config/types';
export type BoatKind = 'player' | 'worker' | 'speedboat' | 'salvage';
export type WorkerMode = 'SELECT' | 'TO_PICKUP' | 'GATHER' | 'RETURN' | 'UNLOAD' | 'WAIT';
export type Cargo = { id: number; resource: string; kind: 'fish' | 'metal'; value: number };
export type Boat = Point & { id: string; kind: BoatKind; cargo: Cargo[]; state: WorkerMode; target: string | number | null; gather: number; unload: number; angle: number; hp: number; attackAt: number; respawnAt: number; resume?: { target: string; gather: number }; patrolIndex?: number };
export type IncomeSource = 'fish_sale' | 'golden_reward' | 'quest_reward' | 'debug_grant';
export type CoinStack = Point & { id: number; value: number; availableAt: number; attracting: boolean; source: IncomeSource; crate?:number; boat?:string; transaction?:number };
export type NodeState = { unlocked: boolean; stock: number; hp: number; phase: 'ready' | 'regrow' | 'restock'; readyAt: number };
export type FloatingCrate = Cargo & Point & { reservedBy: string | null; expiresAt?:number };
export type Order = { id: string; paid: number; metalPaid: number; cost: number; metalCost: number; duration: number; readyAt: number | null; complete: boolean };
export type Enemy = Point & { id: string; hp: number; attackAt: number; angle: number; home: Point; state: 'PATROL' | 'CHASE' | 'RETURN'; target: string | null };
export type Projectile = Point & { id: number; target: string; faction: 'friendly' | 'pirate'; damage: number; expires: number };
export type GameEvent = { seq: number; realTime: string; gameTime: number; type: string; data: Record<string, unknown> };
export type GoldenTransaction={id:number;offerId:number;reward:number;status:'offered'|'watching'|'spawned'|'cancelled';pileIds:number[]};
export interface GameState {
  version: 3; portRules?:1; playerLastDamageAt?:number; profile: Profile; time: number; nextId: number; rng: number;
  coins: number; metal: number; cargoLevel: number; area: number; flags: Record<string, boolean>;
  stats: Record<string, number>; questIndex: number; questBaseline: number; rewarded: number[];
  questStatus: 'active' | 'completed_unclaimed'; coinStacks: CoinStack[]; revealedPurchases:Record<string,boolean>;
  purchaseGuards?:Record<string,{cooldownUntil:number;needsExit:boolean}>;
  boats: Boat[]; nodes: Record<string, NodeState>; crates: FloatingCrate[]; orders: Record<string, Order>;
  enemies: Enemy[]; projectiles: Projectile[]; nextPirateAt: number; defender: Boat | null;
  pirateSpawnBlocked?: boolean;
  golden: Point & { nextAt: number; expires: number | null; angle:number; origin:Point|null;offerId:number|null;transaction:GoldenTransaction|null }; events: GameEvent[]; eventSeq: number;
}
export function makeBoat(id: string, kind: BoatKind, point: Point, hp = 0): Boat { return { ...point, id, kind, cargo: [], state: 'SELECT', target: null, gather: 0, unload: 0, angle: 0, hp, attackAt: 0, respawnAt: 0 }; }
export function newState(c: Balance): GameState {
  return { version: 3, portRules:1, playerLastDamageAt:0, profile: c.profile, time: 0, nextId: 1, rng: c.simulation.rng_seed, coins: 0, metal: 0, cargoLevel: 0, area: 1, flags: {}, stats: {income_sources_v031:1}, questIndex: 0, questBaseline: 0, questStatus: 'active', coinStacks: [], revealedPurchases:{}, purchaseGuards:{}, rewarded: [], boats: [makeBoat('player', 'player', c.world.spawn, c.units.player.hp)], nodes: Object.fromEntries(Object.entries(c.resources).map(([id,r]) => [id,{ unlocked: id === 'sardine', stock: r.stock, hp: r.portion_hp, phase: 'ready', readyAt: 0 }])), crates: [], orders: {}, enemies: [], projectiles: [], nextPirateAt: c.combat.spawn_s, defender: null, golden: { nextAt: c.monetization.golden_first_s_assumption, expires: null, x:c.world.spawn.x,y:c.world.spawn.y,angle:0,origin:null,offerId:null,transaction:null }, events: [], eventSeq: 0 };
}
export function random(s: GameState) { let x = s.rng | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; s.rng = x >>> 0; return s.rng / 4294967296; }
