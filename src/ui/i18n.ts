import {en,ru,type TranslationKey} from './locales/catalog';
import type {Balance,Quest} from '../config/types';
import type {Offer} from '../game/systems/construction';
export type Language='en'|'ru';
export type Params=Record<string,string|number>;
export const languageStorageKey='quiet_cove_language';
let language:Language='en';
const listeners=new Set<()=>void>();
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function getLanguage(){return language;}
export function t(key:TranslationKey,params:Params={}){
  return (language==='ru'?ru[key]:en[key]).replace(/\{(\w+)\}/g,(_match,name)=>String(params[name]??`{${name}}`));
}
export function number(value:number){return Math.round(value).toLocaleString(language==='ru'?'ru-RU':'en-US');}
export function setLanguage(next:Language,persist=true){
  language=next;
  if(persist)try{localStorage.setItem(languageStorageKey,next);}catch{/* Language still changes in storage-restricted browsers. */}
  if(typeof document!=='undefined'){document.documentElement.lang=next;document.title=`${t('brand.title')} · Fishing Incremental`;}
  for(const listener of listeners)listener();
}
export function initializeLanguage(){let stored:string|null=null;try{stored=localStorage.getItem(languageStorageKey);}catch{}setLanguage(stored==='ru'?'ru':'en',false);}
export function onLanguageChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener);}
// Static DOM translations update in place, retaining callbacks, focus and pointer ownership.
export function label(key:TranslationKey,params:Params={}){return `<span data-i18n="${key}" data-i18n-params="${escape(JSON.stringify(params))}">${escape(t(key,params))}</span>`;}
export function applyTranslations(root:HTMLElement){
  for(const el of root.querySelectorAll<HTMLElement>('[data-i18n]'))el.textContent=t(el.dataset.i18n as TranslationKey,JSON.parse(el.dataset.i18nParams??'{}'));
  for(const attr of ['title','aria-label'] as const)for(const el of root.querySelectorAll<HTMLElement>(`[data-i18n-${attr}]`))el.setAttribute(attr,t(el.getAttribute(`data-i18n-${attr}`) as TranslationKey));
}
export function questText(quest:Quest){return t(`quest.${quest.id}` as TranslationKey);}
export function resourceName(id:string){return t(`resource.${id}` as TranslationKey);}
export function offerName(c:Balance,o:Pick<Offer,'id'>,badge=false):string{
  const [category,index]=o.id.split(':');
  if(category==='resource')return index==='wreck'?t(badge?'badge.wreck':'offer.wreck'):resourceName(index);
  if(category==='cargo'){const upgrade=c.capacity_upgrades.find(u=>u.level===Number(index));return t(badge?'badge.cargo':'offer.cargo',{level:index,capacity:upgrade?.capacity??0});}
  if(category==='worker'||category==='salvage')return t(`${badge?'badge':'offer'}.${category}` as TranslationKey,{count:Number(index)+1});
  if(category==='storageUpgrade')return t('offer.storageUpgrade',{capacity:c.salvage.upgrade.capacity});
  const key=`${badge&&['gate','storage','cutter','den','route'].includes(category)?'badge':'offer'}.${category}` as TranslationKey;
  return t(key);
}
const blockedKeys:Record<string,TranslationKey>={
  'Сначала откройте море':'blocked.sea','Сначала постройте склад':'blocked.storage',
  'Сначала купите резак':'blocked.cutter','Сначала доставьте корабль':'blocked.wreck',
  'Нужен склад металла':'blocked.metal','Сначала закройте логово':'blocked.den',
};
export function blockedText(text:string){return blockedKeys[text]?t(blockedKeys[text]):text;}
export type {TranslationKey};
