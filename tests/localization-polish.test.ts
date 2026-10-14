import {afterEach,expect,it} from 'vitest';
import {loadConfig} from './helpers-art-v05a';
import {en,ru} from '../src/ui/locales/catalog';
import {getLanguage,initializeLanguage,setLanguage,t,questText,offerName,resourceName} from '../src/ui/i18n';
import {openDebugZones} from '../src/debug/openZones';
import {newState} from '../src/game/state';
import {offers,allOffers,purchasePoint,updatePurchases} from '../src/game/systems/construction';
import {saveGame,loadGame} from '../src/game/systems/save';
afterEach(()=>setLanguage('en',false));
it('defaults to English without a preference and has complete English/Russian catalogs',()=>{
  initializeLanguage();expect(getLanguage()).toBe('en');expect(t('settings.title')).toBe('Settings');
  expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  for(const value of Object.values(en))expect(value).not.toMatch(/[А-Яа-яЁё]/);
  setLanguage('ru',false);expect(t('settings.title')).toBe('Настройки');expect(t('hud.workers',{count:3})).toBe('Рыбаки 3');
});
it.each(['fast','reference'] as const)('%s: all quests, resources and offers localize without modifying balance',profile=>{
  const c=loadConfig(profile),before=structuredClone(c),s=newState(c);openDebugZones(c,s);
  for(const lang of ['en','ru'] as const){setLanguage(lang,false);
    for(const q of c.quests){expect(questText(q)).toBeTruthy();expect(questText(q)).not.toMatch(/\{\w+\}/);}
    for(const id of Object.keys(c.resources))expect(resourceName(id)).toBeTruthy();
    for(const o of allOffers(c,s)){expect(offerName(c,o)).not.toMatch(/\{\w+\}/);expect(offerName(c,o,true)).toBeTruthy();}
  }
  expect(c).toEqual(before);
});
it.each(['fast','reference'] as const)('%s: debug reveal opens early worker/speedboat/hold offers, survives save, and supports stationary payment',profile=>{
  const c=loadConfig(profile),s=newState(c),before=structuredClone(s);
  expect(offers(c,s)).toEqual([]);openDebugZones(c,s);
  const ids=offers(c,s).map(o=>o.id);for(const id of ['worker:0','speedboat','cargo:1'])expect(ids).toContain(id);
  expect(s.boats).toEqual(before.boats);expect(s.questIndex).toBe(before.questIndex);expect(s.coins).toBe(before.coins);expect(s.orders).toEqual(before.orders);
  let raw='';const store={getItem:()=>raw||null,setItem:(_key:string,value:string)=>{raw=value;},removeItem:()=>{}};
  saveGame(store,s,1000);const restored=loadGame(store,c,1000)!.state;
  for(const id of ['worker:0','speedboat','cargo:1']){
    expect(offers(c,restored).map(o=>o.id)).toContain(id);
    const state=structuredClone(restored);state.coins=100000;Object.assign(state.boats[0],purchasePoint(c,id));updatePurchases(c,state,.5,0);
    expect(state.orders[id]?.paid).toBeGreaterThan(0);
  }
});
