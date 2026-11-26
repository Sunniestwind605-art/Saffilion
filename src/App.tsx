import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categories, questions } from './data/questions';
import { findAnswer, freshSave, loadSave, persist, pickQuestions, rankFor, suggestAnswer } from './game/engine';
import type { ActiveGame, CatId, Expedition, RoundResult, SaveData, Tier } from './game/types';

const cats: { id: CatId; name: string; mood: string; color: string; accent: string }[] = [
  { id: 'pebble', name: 'Pebble', mood: 'calm & determined', color: '#c9c8c9', accent: '#8f8d95' },
  { id: 'mochi', name: 'Mochi', mood: 'sweet & playful', color: '#fff1df', accent: '#ed9fac' },
  { id: 'midnight', name: 'Midnight', mood: 'curious & adventurous', color: '#34303e', accent: '#d68aa5' },
  { id: 'nova', name: 'Nova', mood: 'energetic & mischievous', color: '#272432', accent: '#f2bd4f' },
  { id: 'marmalade', name: 'Marmalade', mood: 'sleepy & hardworking', color: '#e9a15b', accent: '#bd6b42' },
];
const cheers = ['You’ve got this!', 'Keep digging!', 'Little steps count.', 'Every gem starts somewhere.', 'A little deeper, a little brighter.', 'Look how far you’ve come!'];
type Screen = 'intro'|'select'|'ready'|'game'|'results'|'journal'|'shop'|'help';

function PixelCat({ id, action = 'idle', label }: { id: CatId; action?: string; label?: string }) {
  const cat = cats.find(c => c.id === id)!;
  return <div className={`pixel-cat ${action}`} style={{ '--fur': cat.color, '--accent': cat.accent } as React.CSSProperties} role="img" aria-label={label || `${cat.name} the mining cat`}>
    <div className="lamp"/><div className="helmet"/><div className="ear left"/><div className="ear right"/>
    <div className="head"><i className="eye left"/><i className="eye right"/><i className="nose"/><i className="mouth"/></div>
    <div className="body"/><div className="paw left"/><div className="paw right"/><div className="tail"/><div className="shovel"><i/></div>
  </div>;
}

function MineScene({ cat, depth, action, lowPower }: { cat: CatId; depth: number; action: string; lowPower: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const ctx = el.getContext('2d'); if (!ctx) return;
    let raf = 0, visible = !document.hidden, last = 0;
    const resize = () => { const dpr = Math.min(devicePixelRatio, 2); el.width = el.clientWidth * dpr; el.height = el.clientHeight * dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    const draw = (t: number) => {
      if (!visible) return;
      if (!lowPower || t - last > 65) {
        last = t; const w = el.clientWidth, h = el.clientHeight;
        const zone = depth < 1000 ? 0 : depth < 2500 ? 1 : depth < 4000 ? 2 : depth < 5500 ? 3 : 4;
        const bg = ['#8a5c50','#70453c','#49365f','#294f51','#211f43'][zone]; ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
        const colors = [['#b77a5d','#6e453d'],['#c0764e','#e7a54d'],['#7c65a9','#74c3c6'],['#63a87c','#b9e27a'],['#7657ae','#efc9ff']][zone];
        const offset = Math.round((depth / 6) % 48);
        for(let y=-48+offset;y<h+48;y+=48) for(let x=12+(y%96);x<w;x+=92){ ctx.fillStyle=colors[(x+y)%2?0:1]; ctx.fillRect(x,y,6,6); ctx.fillRect(x+6,y+6,4,4); }
        ctx.fillStyle='rgba(255,242,182,.65)'; for(let i=0;i<5;i++){ const x=(i*83+depth*.07)%w; const y=(i*67+t*.006)%h; ctx.fillRect(x,y,3,3); }
      }
      raf=requestAnimationFrame(draw);
    };
    const onVis=()=>{ visible=!document.hidden; if(visible) raf=requestAnimationFrame(draw); else cancelAnimationFrame(raf); };
    resize(); addEventListener('resize',resize); document.addEventListener('visibilitychange',onVis); raf=requestAnimationFrame(draw);
    return()=>{ cancelAnimationFrame(raf); removeEventListener('resize',resize); document.removeEventListener('visibilitychange',onVis); };
  },[depth,lowPower]);
  const zone = depth < 1000 ? 'Soft Earth' : depth < 2500 ? 'Copper Caverns' : depth < 4000 ? 'Crystal Caves' : depth < 5500 ? 'Mushroom Hollow' : 'Stardust Depths';
  return <section className="mine-scene" aria-label={`Mining at ${depth.toLocaleString()} metres in ${zone}`}>
    <canvas ref={canvas}/><div className="mine-hud"><span>{zone}</span><strong>{depth.toLocaleString()} m</strong></div>
    <div className="cave-message">{cheers[Math.floor(depth/250)%cheers.length]}</div><PixelCat id={cat} action={action}/>
    <div className="ground"><i/><i/><i/><i/></div>
  </section>;
}

function Timer({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const fired = useRef(false);
  useEffect(() => { fired.current = false; const tick=()=>{ const n=Math.max(0,deadline-Date.now()); setLeft(n); if(n===0&&!fired.current){fired.current=true;onExpire();} }; tick(); const id=setInterval(tick,100); return()=>clearInterval(id); },[deadline,onExpire]);
  const sec = Math.ceil(left/1000); return <div className={`timer ${sec<=5?'urgent':''}`} aria-label={`${sec} seconds remaining`}><span>{sec}</span><i style={{ '--p': `${left/30000*100}%` } as React.CSSProperties}/></div>;
}

function App() {
  const [save,setSave] = useState<SaveData>(()=>loadSave());
  const [screen,setScreen] = useState<Screen>(()=>loadSave().active?'game':'intro');
  const [category,setCategory] = useState('All');
  const [answer,setAnswer] = useState('');
  const [notice,setNotice] = useState('');
  const [suggestion,setSuggestion] = useState<string>();
  const [locked,setLocked] = useState(false);
  const [action,setAction] = useState('idle');
  const [pendingPoints,setPendingPoints] = useState(0);
  const [lastExpedition,setLastExpedition] = useState<Expedition|null>(null);
  const [journalOpen,setJournalOpen] = useState<string|null>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>persist(save),[save]);
  useEffect(()=>{ const update=()=>document.documentElement.style.setProperty('--vvh',`${visualViewport?.height||innerHeight}px`); update(); visualViewport?.addEventListener('resize',update); return()=>visualViewport?.removeEventListener('resize',update); },[]);
  const cat = save.selectedCat;
  const game = save.active;
  const question = game ? questions.find(q=>q.id===game.questionIds[game.round]) : undefined;
  const score = game?.results.reduce((n,r)=>n+r.points,0)||0;
  const depth = (score+pendingPoints)*10;

  const beep=useCallback((kind:'good'|'bad'|'dig')=>{ if(!save.settings.sound) return; const A=window.AudioContext; if(!A)return; const c=new A(),o=c.createOscillator(),g=c.createGain(); o.connect(g).connect(c.destination); o.frequency.value=kind==='good'?660:kind==='dig'?150:220; g.gain.setValueAtTime(.035,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.18); o.start();o.stop(c.currentTime+.2); },[save.settings.sound]);

  const chooseCat=(id:CatId)=>setSave(s=>({...s,selectedCat:id}));
  const begin=()=>{ const picked=pickQuestions(questions,save,category); const active:ActiveGame={questionIds:picked.chosen,round:0,results:[],deadline:Date.now()+30000,category}; setSave(s=>({...s,active,questionBag:picked.bag,recentQuestions:picked.recent})); setScreen('game'); setAnswer(''); setNotice(''); setTimeout(()=>inputRef.current?.focus(),100); };

  const finishGame=useCallback((resultList:RoundResult[])=>{
    const total=resultList.reduce((n,r)=>n+r.points,0); const expedition:Expedition={id:crypto.randomUUID(),date:new Date().toISOString(),cat,score:total,depth:total*10,rounds:resultList};
    setLastExpedition(expedition); setSave(s=>({...s,active:null,expeditions:[expedition,...s.expeditions].slice(0,100),crystals:s.crystals+Math.max(5,Math.round(total/25))})); setScreen('results'); setAction('celebrate');
  },[cat]);

  const nextRound=useCallback((result:RoundResult)=>{
    if(!game)return; const results=[...game.results,result];
    setLocked(true); setPendingPoints(result.points); setAction(result.points?'dig':'sad'); beep(result.points?'dig':'bad');
    setTimeout(()=>{ if(game.round>=6){setPendingPoints(0);finishGame(results);return;} setSave(s=>({...s,active:s.active?{...s.active,round:s.active.round+1,results,deadline:Date.now()+30000}:null})); setAnswer('');setNotice('');setSuggestion(undefined);setLocked(false);setPendingPoints(0);setAction('idle');setTimeout(()=>inputRef.current?.focus(),50); }, save.settings.reducedMotion?250:1250);
  },[game,beep,finishGame,save.settings.reducedMotion]);

  const expire=useCallback(()=>{ if(!question||locked)return; nextRound({questionId:question.id,prompt:question.prompt,answer:answer.trim(),points:0,timedOut:true});setNotice('Time’s up — let’s see what waits below.'); },[question,locked,nextRound,answer]);

  const submit=(e?:React.FormEvent)=>{ e?.preventDefault(); if(!question||locked||Date.now()>=game!.deadline)return; const raw=answer.trim(); if(!raw){setNotice('Type an answer first, little miner!');return;} const match=findAnswer(question,raw); if(match){beep('good');setNotice(`${match.tier}! +${match.points} points`);nextRound({questionId:question.id,prompt:question.prompt,answer:raw,canonical:match.canonical,points:match.points,tier:match.tier,timedOut:false});return;} const maybe=suggestAnswer(question,raw);setSuggestion(maybe?.canonical);setNotice(maybe?`That isn’t an exact match. Did you mean ${maybe.canonical}?`:'That answer isn’t in our answer book yet. Try another!');beep('bad'); };

  const recordMissing=()=>{ if(!question||!answer.trim())return; setSave(s=>({...s,missingAnswers:[...s.missingAnswers,{questionId:question.id,answer:answer.trim()}]}));setNotice('Saved locally for future review. You can keep trying!'); };
  const updateSettings=(patch:Partial<SaveData['settings']>)=>setSave(s=>({...s,settings:{...s.settings,...patch}}));
  const exportSave=()=>{ const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='saffilion-save.json';a.click();URL.revokeObjectURL(a.href); };
  const importSave=async(e:React.ChangeEvent<HTMLInputElement>)=>{ const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data?.version!==1||!Array.isArray(data.expeditions))throw Error();setSave({...freshSave(),...data,active:null});setNotice('Save imported safely.');}catch{setNotice('That file is not a valid Saffilion save.');}e.target.value=''; };
  const reset=()=>{ if(confirm('Reset all Saffilion progress? This cannot be undone unless you exported a save.')){setSave(freshSave());setScreen('intro');} };

  const stats=useMemo(()=>({ best:Math.max(0,...save.expeditions.map(e=>e.score)),deepest:Math.max(0,...save.expeditions.map(e=>e.depth)),lifetime:save.expeditions.reduce((n,e)=>n+e.depth,0),correct:save.expeditions.flatMap(e=>e.rounds).filter(r=>r.points>0).length }),[save.expeditions]);
  const menu=<nav className="top-actions"><button onClick={()=>setScreen('journal')} aria-label="Open My Digging Journal">Journal</button><button onClick={()=>setScreen('shop')}>Burrow</button><button onClick={()=>setScreen('help')}>Help</button><button onClick={()=>updateSettings({sound:!save.settings.sound})} aria-label={save.settings.sound?'Mute sound':'Enable sound'}>{save.settings.sound?'♪':'×'}</button></nav>;

  if(screen==='intro') return <main className="intro screen"><div className="sky"><i/><i/><i/></div><div className="intro-land"><div className="flowers">✦ · ✿ · ✦</div><PixelCat id={cat} action="walk"/><div className="mine-door"/></div><section className="title-card"><p>Made with love for Safia</p><h1>SAFFILION</h1><span>A cozy rarity-mining adventure</span><button className="primary" onClick={()=>setScreen('select')}>Let’s Dig!</button></section></main>;

  if(screen==='select') return <main className="screen paper"><header><button className="back" onClick={()=>setScreen('intro')}>← Back</button><div><small>Choose your digging buddy</small><h1>Meet the miners</h1></div></header><div className="cat-grid">{cats.map(c=><button key={c.id} className={`cat-card ${cat===c.id?'selected':''}`} onClick={()=>chooseCat(c.id)} aria-pressed={cat===c.id}><PixelCat id={c.id}/><strong>{c.name}</strong><span>{c.mood}</span><i>{cat===c.id?'Ready to dig!':'Choose'}</i></button>)}</div><button className="primary sticky-cta" onClick={()=>setScreen('ready')}>Adventure with {cats.find(c=>c.id===cat)!.name}</button></main>;

  if(screen==='ready') return <main className="screen ready">{menu}<section><span className="eyebrow">Expedition board</span><h1>Where shall we dig?</h1><PixelCat id={cat}/><label>Question mix<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><div className="rules"><span>7 questions</span><span>30 seconds each</span><span>rarer = deeper</span></div><button className="primary" onClick={begin}>Start Digging</button><button className="text-button" onClick={()=>setScreen('select')}>Change cat</button></section></main>;

  if(screen==='game'&&game&&question) return <main className={`game-shell ${locked?'is-locked':''}`}>{menu}<MineScene cat={cat} depth={depth} action={action} lowPower={save.settings.batterySaver}/><section className="question-panel"><div className="round-row"><span>Question {game.round+1} / 7</span><span>{question.category}</span><strong>{score} pts</strong></div><div className="progress"><i style={{width:`${(game.round/7)*100}%`}}/></div><div className="prompt-row"><h1>{question.prompt}</h1><Timer deadline={game.deadline} onExpire={expire}/></div><form onSubmit={submit}><label htmlFor="answer">Your answer</label><div className="answer-row"><input ref={inputRef} id="answer" value={answer} onChange={e=>{setAnswer(e.target.value);setSuggestion(undefined);setNotice('');}} autoComplete="off" autoCorrect="off" enterKeyHint="go" placeholder="Type something clever…" disabled={locked}/><button className="primary" disabled={locked}>Dig!</button></div></form><div className="feedback" aria-live="polite">{notice}{suggestion&&<button onClick={()=>{setAnswer(suggestion);setSuggestion(undefined);setNotice('Correction filled in — submit it to score.');inputRef.current?.focus();}}>Use “{suggestion}”</button>}{notice.includes('answer book')&&<button className="text-button" onClick={recordMissing}>Save suggestion</button>}</div></section></main>;

  if(screen==='results'&&lastExpedition) { const exp=lastExpedition,best=[...exp.rounds].sort((a,b)=>b.points-a.points)[0]; return <main className="screen results"><div className="confetti">✦ · ✧ · ✦ · ✧ · ✦</div><PixelCat id={cat} action="celebrate"/><span className="eyebrow">Expedition complete</span><h1>{rankFor(exp.score)}</h1><p className="big-score">{exp.score}<small> / 700 points</small></p><p>{exp.depth.toLocaleString()} metres deep · {exp.rounds.filter(r=>r.points).length}/7 correct</p><p>Best find: <strong>{best?.canonical||'A brave try'} {best?.tier?`· ${best.tier}`:''}</strong></p><div className="round-summary">{exp.rounds.map((r,i)=><div key={i}><span>{i+1}</span><p>{r.answer||'No answer'}<small>{r.canonical&&r.canonical!==r.answer?` → ${r.canonical}`:''}</small></p><strong>{r.points}</strong></div>)}</div><div className="result-actions"><button className="primary" onClick={()=>setScreen('ready')}>Dig Again!</button><button onClick={()=>setScreen('journal')}>My Digging Journal</button><button onClick={()=>setScreen('select')}>Change Cat</button><button onClick={()=>navigator.clipboard?.writeText(`Saffilion ✦ ${rankFor(exp.score)}\n${exp.score}/700 points · ${exp.depth.toLocaleString()}m deep\n${exp.rounds.map(r=>r.points?['🟫','🟠','◇','💎','🔮','✦'][[10,25,45,65,85,100].indexOf(r.points)]:'·').join(' ')}`)}>Copy Results</button></div></main>; }

  if(screen==='journal') return <main className="screen paper journal"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Personal records, stored on this device</small><h1>My Digging Journal</h1></div></header><div className="stats"><div><strong>{stats.best}</strong><span>Best score</span></div><div><strong>{stats.deepest.toLocaleString()}m</strong><span>Deepest dig</span></div><div><strong>{save.expeditions.length}</strong><span>Expeditions</span></div><div><strong>{stats.lifetime.toLocaleString()}m</strong><span>Lifetime depth</span></div></div><h2>Recent expeditions</h2><div className="expeditions">{save.expeditions.length===0?<p>Your first adventure will appear here.</p>:save.expeditions.map(e=><article key={e.id}><button onClick={()=>setJournalOpen(journalOpen===e.id?null:e.id)}><PixelCat id={e.cat}/><span><strong>{rankFor(e.score)}</strong><small>{new Date(e.date).toLocaleDateString()}</small></span><b>{e.score} pts</b></button>{journalOpen===e.id&&<div className="expedition-detail">{e.rounds.map((r,i)=><p key={i}>{i+1}. {r.answer||'No answer'} <b>+{r.points}</b></p>)}</div>}</article>)}</div><div className="data-actions"><button onClick={exportSave}>Export save</button><button onClick={()=>fileInput.current?.click()}>Import save</button><button className="danger" onClick={reset}>Reset progress</button><input ref={fileInput} hidden type="file" accept="application/json" onChange={importSave}/></div><p className="feedback">{notice}</p></main>;

  if(screen==='shop') return <main className="screen paper shop"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Spend only crystals earned by playing</small><h1>The Treasure Burrow</h1></div></header><div className="crystal-balance">◇ {save.crystals} crystals</div><p>Cosmetics are coming from the deepest tunnels. Every current cat and core game feature is already free.</p><div className="shopkeeper"><PixelCat id="marmalade"/><blockquote>“No loot boxes here. I nap on those.”</blockquote></div></main>;

  return <main className="screen paper help"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Field guide</small><h1>How to Saffilion</h1></div></header><section><h2>Rarer answers dig deeper</h2><p>Every accepted answer has a locally curated rarity. It is an estimate of familiarity, not live data from other players.</p><div className="tiers">{(['Pebble','Copper','Quartz','Sapphire','Amethyst','Stardust'] as Tier[]).map((t,i)=><div key={t}><i className={`gem g${i}`}/><strong>{t}</strong><span>{[10,25,45,65,85,100][i]} pts</span></div>)}</div><h2>Spelling help, after submission</h2><p>Saffilion never reveals answers while you type. After an incorrect submission, a close spelling suggestion may appear. You still choose and submit it yourself.</p><h2>Comfort settings</h2><label className="toggle"><input type="checkbox" checked={save.settings.reducedMotion} onChange={e=>updateSettings({reducedMotion:e.target.checked})}/> Reduce motion</label><label className="toggle"><input type="checkbox" checked={save.settings.batterySaver} onChange={e=>updateSettings({batterySaver:e.target.checked})}/> Battery-conscious animation</label><label className="toggle"><input type="checkbox" checked={save.settings.sound} onChange={e=>updateSettings({sound:e.target.checked})}/> Gentle sounds</label><h2>Offline play</h2><p>After the first successful load, the installed game keeps its questions and logic on your device. iPhone installation uses Safari’s Share → Add to Home Screen; supported Android browsers can offer Install app.</p></section></main>;
}

export default App;
