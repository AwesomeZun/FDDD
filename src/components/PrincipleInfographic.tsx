import {useState} from 'react';
import {useLang,type TKey} from '../lib/i18n';
/** Small "how it works" strip. Every number here is the real project figure; tags separate computed evidence from authored rules. */
const steps=[
 {n:'01',title:'s1Title',sub:'s1Sub',tag:'computed',icon:<svg viewBox="0 0 40 40"><path d="M8 24c0-7 5-12 12-12s12 5 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="20" cy="26" r="3.2" fill="currentColor"/><circle cx="12" cy="18" r="1.6" fill="currentColor" opacity=".6"/><circle cx="28" cy="18" r="1.6" fill="currentColor" opacity=".6"/></svg>},
 {n:'02',title:'s2Title',sub:'s2Sub',tag:'authored',icon:<svg viewBox="0 0 40 40"><path d="M8 30L32 10" stroke="currentColor" strokeWidth="1.6"/><path d="M8 30h24M8 30V6" stroke="currentColor" strokeWidth="1" opacity=".5"/><circle cx="14" cy="25" r="1.8" fill="currentColor"/><circle cx="26" cy="15" r="1.8" fill="currentColor"/></svg>},
 {n:'03',title:'s3Title',sub:'s3Sub',tag:'computed',icon:<svg viewBox="0 0 40 40"><ellipse cx="14" cy="18" rx="7" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5"/><ellipse cx="26" cy="18" rx="7" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M20 24v8" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="17" r="1.2" fill="currentColor"/><circle cx="27" cy="19" r="1.2" fill="currentColor"/><circle cx="17" cy="20" r="1.2" fill="currentColor"/></svg>},
 {n:'04',title:'s4Title',sub:'s4Sub',tag:'mixed',icon:<svg viewBox="0 0 40 40"><path d="M6 28c6-10 12-14 28-18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3"/><ellipse cx="20" cy="22" rx="4" ry="2.4" fill="currentColor"/><path d="M17 20l-5-4M23 20l5-4" stroke="currentColor" strokeWidth="1.2" opacity=".7"/></svg>},
 {n:'05',title:'s5Title',sub:'s5Sub',tag:'computed',icon:<svg viewBox="0 0 40 40"><rect x="7" y="22" width="5" height="10" fill="currentColor"/><rect x="15" y="14" width="5" height="18" fill="currentColor" opacity=".8"/><rect x="23" y="18" width="5" height="14" fill="currentColor" opacity=".6"/><rect x="31" y="26" width="4" height="6" fill="currentColor" opacity=".4"/></svg>},
];
const tagKey={computed:'tagComputed',authored:'tagAuthored',mixed:'tagMixed'} as const;
export function PrincipleInfographic(){
 const [open,setOpen]=useState(true),{t}=useLang();
 return <section className="principle" aria-label={t('principleAria')}>
  <div className="principle-head"><span>HOW IT WORKS</span><small><i className="principle-tag computed"/>{t('principleTagComputed')} <i className="principle-tag authored"/>{t('principleTagAuthored')}</small><button onClick={()=>setOpen(v=>!v)} aria-expanded={open}>{open?t('principleCollapse'):t('principleExpand')}</button></div>
  {open&&<ol className="principle-flow">{steps.map((s,i)=><li key={s.n} className={'principle-step '+s.tag}>
   <div className="principle-icon">{s.icon}</div>
   <div className="principle-body"><div className="principle-title"><em>{s.n}</em><strong>{t(s.title as TKey)}</strong><i className={'principle-tag '+s.tag}>{t(tagKey[s.tag as keyof typeof tagKey])}</i></div><small>{t(s.sub as TKey)}</small></div>
   {i<steps.length-1&&<span className="principle-arrow" aria-hidden="true">→</span>}
  </li>)}</ol>}
  
 </section>;
}
