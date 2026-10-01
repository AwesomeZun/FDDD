import {resolveLanguage} from './language';
import {createContext,useContext,useEffect,useState} from 'react';
export type Lang='ko'|'en';
export const LANG_STORAGE_KEY='fddd.lang';
/** Only the strings that are Korean on the main page live here; English mono labels are shared by both languages. */
export const T={
 langKo:{ko:'KO',en:'KO'},langEn:{ko:'EN',en:'EN'},
 principleAria:{ko:'작동 원리',en:'How it works'},
 principleTagComputed:{ko:'실제 계산',en:'computed'},
 principleTagAuthored:{ko:'설정',en:'authored'},
 principleCollapse:{ko:'접기',en:'Collapse'},principleExpand:{ko:'펼치기',en:'Expand'},
 tagComputed:{ko:'실제 계산',en:'computed'},tagAuthored:{ko:'설정 · 연출',en:'authored'},tagMixed:{ko:'계산 + 설정',en:'computed + authored'},
 s1Title:{ko:'실제 도킹',en:'Real docking'},s1Sub:{ko:'3 단백질 × 화합물 → 8 점수',en:'3 proteins × compounds → 8 executed Vina scores'},
 s2Title:{ko:'점수 → 보상',en:'Score → reward'},s2Sub:{ko:'최고 1.0 · 최저 0.05',en:'linear rescale · best 1.0 · worst 0.05'},
 s3Title:{ko:'뇌 전체 계산',en:'Whole-brain compute'},s3Sub:{ko:'167,122 뉴런 / 매 스텝',en:'167,122 neurons / every step'},
 s4Title:{ko:'머물까 · 떠날까',en:'Stay or leave'},s4Sub:{ko:'운동 뉴런 출력이 결정',en:'decided by motor-neuron output'},
 s5Title:{ko:'선호 → 분포',en:'Preference → spread'},s5Sub:{ko:'보상에 비례해 퍼짐',en:'spread in proportion to reward'},
 actionsNote:{ko:'학습 시 실제 도킹 점수를 외부 보상으로 제공합니다. 보상을 끄면 배운 선호만 사용합니다. ',en:'While learning, the executed docking score is supplied as an external reward. With reward off, only the learned preference is used. '},
 actionsWarn:{ko:'표적 간 Vina 점수는 보정된 결합력 비교가 아닙니다.',en:'Vina scores across different targets are not a calibrated comparison of binding affinity.'},
} as const;
export type TKey=keyof typeof T;
function initialLang():Lang{let stored:string|null=null;try{stored=localStorage.getItem(LANG_STORAGE_KEY);}catch{/* storage optional */}return resolveLanguage(typeof location==='undefined'?'/':location.pathname,stored);}
export const LangContext=createContext<{lang:Lang;setLang:(l:Lang)=>void}>({lang:'en',setLang:()=>{}});
export function useLangState(){const [lang,setLangState]=useState<Lang>(initialLang);useEffect(()=>{document.documentElement.lang=lang;},[lang]);const setLang=(l:Lang)=>{setLangState(l);try{localStorage.setItem(LANG_STORAGE_KEY,l);}catch{/* storage optional */}try{const target=l==='en'?'/en':'/ko';if(location.pathname!==target)history.replaceState(null,'',target+location.search+location.hash);}catch{/* history optional */}};return {lang,setLang};}
export function useLang(){const {lang,setLang}=useContext(LangContext);const t=(k:TKey)=>T[k][lang];return {lang,t,setLang};}
