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
const zoneForDepth = (depth: number) => depth < 1000 ? 0 : depth < 2500 ? 1 : depth < 4000 ? 2 : depth < 5500 ? 3 : 4;
const zoneNames = ['Soft Earth', 'Copper Caverns', 'Crystal Caves', 'Mushroom Hollow', 'Stardust Depths'];
const digDuration = (points: number, reducedMotion: boolean) => reducedMotion ? 250 : Math.min(1900, 900 + points * 10);

const spritePalettes: Record<CatId, { fur: string; light: string; dark: string; detail: string }> = {
  pebble: { fur: '#b8b7bd', light: '#dddce0', dark: '#77747f', detail: '#5f5c68' },
  mochi: { fur: '#f5dfc8', light: '#fff3df', dark: '#c9938d', detail: '#e990a4' },
  midnight: { fur: '#302d3b', light: '#575164', dark: '#171522', detail: '#e48aa6' },
  nova: { fur: '#24212f', light: '#494353', dark: '#12101a', detail: '#efbd4f' },
  marmalade: { fur: '#df9250', light: '#f6bd72', dark: '#a95738', detail: '#8d4935' },
};

function drawPixelCat(ctx: CanvasRenderingContext2D, id: CatId, action: string, frame: number) {
  const p = spritePalettes[id];
  const px = (color: string, x: number, y: number, w = 1, h = 1) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const outline = '#362735';
  const bob = action === 'walk' || action === 'celebrate' ? frame % 2 : action === 'dig' ? frame % 2 : 0;
  const y = action === 'celebrate' && frame % 2 ? -2 : bob;
  ctx.clearRect(0, 0, 48, 48);

  // Tail sits behind the body and changes pose to make each two-frame animation readable.
  px(outline, 35, 29 + y, 7, 3); px(outline, 39, 25 + y - (frame % 2), 4, 7);
  px(p.fur, 35, 30 + y, 5, 1); px(p.fur, 40, 26 + y - (frame % 2), 1, 5);
  if (id === 'midnight') px(p.detail, 40, 26 + y - (frame % 2), 1, 2);

  // Body, feet and chest are deliberately chunky 1-3px clusters.
  px(outline, 13, 25 + y, 25, 17); px(p.fur, 15, 26 + y, 21, 14);
  px(p.light, 21, 30 + y, 9, 9);
  px(outline, 12, 39 + y, 11, 5); px(outline, 28, 39 + y, 11, 5);
  const step = action === 'walk' ? frame % 2 : 0;
  px(p.fur, 14 + step, 39 + y, 7, 3); px(p.fur, 30 - step, 39 + y, 7, 3);

  // Pointed ears and square head.
  px(outline, 10, 12 + y, 7, 9); px(outline, 33, 12 + y, 7, 9);
  px(p.fur, 12, 14 + y, 4, 6); px(p.fur, 34, 14 + y, 4, 6);
  px(p.detail, 13, 15 + y, 2, 3); px(p.detail, 35, 15 + y, 2, 3);
  px(outline, 9, 17 + y, 32, 18); px(p.fur, 11, 19 + y, 28, 14);
  px(p.light, 14, 20 + y, 7, 6); px(p.light, 29, 20 + y, 7, 6);

  // Helmet, headlamp and warm lamp glow made only from hard-edged pixels.
  px(outline, 9, 12 + y, 32, 5); px('#d57842', 11, 12 + y, 28, 4); px('#f1b94f', 14, 9 + y, 22, 5);
  px(outline, 21, 4 + y, 9, 7); px('#fff0a0', 23, 5 + y, 5, 4); px('#fff9cf', 24, 5 + y, 3, 2);

  // Faces and character-specific markings.
  const closed = action === 'sad';
  if (closed) { px(outline, 16, 25 + y, 5, 1); px(outline, 30, 25 + y, 5, 1); }
  else {
    px('#fff9df', 16, 23 + y, id === 'nova' ? 5 : 4, id === 'nova' ? 5 : 4);
    px('#fff9df', 30, 23 + y, id === 'nova' ? 5 : 4, id === 'nova' ? 5 : 4);
    px('#211925', 18, 24 + y, 2, 3); px('#211925', 30, 24 + y, 2, 3);
  }
  px(id === 'pebble' ? '#6c6572' : '#dc7f91', 24, 28 + y, 3, 2);
  px(outline, 23, 31 + y, 2, 1); px(outline, 27, 31 + y, 2, 1); px(outline, 25, 30 + y, 2, 2);
  if (id === 'pebble') { px(p.dark, 11, 22 + y, 3, 2); px(p.dark, 36, 22 + y, 3, 2); }
  if (id === 'mochi') { px(p.detail, 13, 28 + y, 3, 2); px(p.detail, 34, 28 + y, 3, 2); }
  if (id === 'midnight') { px('#e8d8e7', 11, 19 + y, 8, 3); px('#e8d8e7', 31, 30 + y, 7, 2); }
  if (id === 'nova') { px(p.detail, 12, 20 + y, 3, 2); px(p.detail, 35, 20 + y, 3, 2); }
  if (id === 'marmalade') { px(p.dark, 17, 19 + y, 3, 3); px(p.dark, 24, 19 + y, 3, 3); px(p.dark, 31, 19 + y, 3, 3); px(p.dark, 15, 32 + y, 3, 2); px(p.dark, 33, 32 + y, 3, 2); }

  // Pickaxe is part of the sprite frame, not a smooth rotated DOM shape.
  if (action === 'dig' && frame % 2) {
    px(outline, 4, 29, 5, 3); px('#b6adb3', 3, 27, 9, 3); px(outline, 8, 29, 3, 16); px('#80543d', 9, 30, 1, 13);
  } else {
    px(outline, 38, 8 + y, 3, 31); px('#80543d', 39, 10 + y, 1, 27);
    px(outline, 34, 7 + y, 11, 4); px('#b6adb3', 35, 8 + y, 9, 2);
  }
}

function PixelCat({ id, action = 'idle', label }: { id: CatId; action?: string; label?: string }) {
  const cat = cats.find(c => c.id === id)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, frame = 0, last = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = (time: number) => {
      if (!last || time - last > (action === 'dig' ? 180 : 420)) { last = time; drawPixelCat(ctx, id, action, frame++); }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(loop);
    };
    loop(0);
    const onVisibility = () => { if (!document.hidden && !reduce) { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisibility); };
  }, [id, action]);
  return <div className={`pixel-cat ${action}`} role="img" aria-label={label || `${cat.name} the mining cat`}>
    <canvas ref={canvas} width="48" height="48" aria-hidden="true" />
  </div>;
}

function MineScene({ cat, depth, action, lowPower }: { cat: CatId; depth: number; action: string; lowPower: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shownDepth = useRef(depth);
  const camera = useRef(depth * .42);
  const animation = useRef<{ from: number; to: number; cameraFrom: number; cameraTo: number; started: number; duration: number } | null>(null);
  const [hudDepth, setHudDepth] = useState(depth);
  const [gain, setGain] = useState(0);

  useEffect(() => {
    const from = shownDepth.current;
    if (depth <= from) { shownDepth.current = depth; setHudDepth(depth); return; }
    const delta = depth - from;
    setGain(delta);
    if (canvas.current) canvas.current.dataset.hadIntermediate = 'false';
    animation.current = {
      from, to: depth, cameraFrom: camera.current,
      cameraTo: camera.current + Math.max(220, Math.min(520, 175 + delta * .36)),
      started: performance.now(), duration: digDuration(delta / 10, false),
    };
  }, [depth]);

  useEffect(() => {
    if (action === 'dig' || !animation.current) return;
    shownDepth.current = animation.current.to; camera.current = animation.current.cameraTo;
    setHudDepth(animation.current.to); animation.current = null;
  }, [action]);

  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const ctx = el.getContext('2d'); if (!ctx) return;
    let raf = 0, visible = !document.hidden, last = 0, lastHud = 0;
    const resize = () => { const dpr = Math.min(devicePixelRatio, 2); el.width = el.clientWidth * dpr; el.height = el.clientHeight * dpr; ctx.setTransform(dpr,0,0,dpr,0,0); };
    const draw = (t: number) => {
      if (!visible) return;
      if (!lowPower || t - last > 65) {
        last = t; const w = el.clientWidth, h = el.clientHeight;
        const move = animation.current;
        if (move) {
          const progress = Math.min(1, (t - move.started) / move.duration);
          const eased = progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          shownDepth.current = move.from + (move.to - move.from) * eased;
          camera.current = move.cameraFrom + (move.cameraTo - move.cameraFrom) * eased;
          if (progress > 0 && progress < 1) el.dataset.hadIntermediate = 'true';
          if (t - lastHud > 60 || progress === 1) { lastHud = t; setHudDepth(Math.round(shownDepth.current / 10) * 10); }
          if (progress === 1) { shownDepth.current = move.to; camera.current = move.cameraTo; animation.current = null; }
        }
        el.dataset.camera = camera.current.toFixed(1);
        const zone = zoneForDepth(shownDepth.current);
        const bg = ['#8a5c50','#70453c','#49365f','#294f51','#211f43'][zone]; ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);
        const colors = [['#b77a5d','#6e453d'],['#c0764e','#e7a54d'],['#7c65a9','#74c3c6'],['#63a87c','#b9e27a'],['#7657ae','#efc9ff']][zone];
        const wrap = (value: number, size: number) => ((value % size) + size) % size;

        // Three independently moving layers make the cat feel fixed while the cave travels upward.
        for (let i = 0; i < 18; i++) {
          const x = (i * 83 + 29) % Math.max(w, 1), y = wrap(i * 61 - camera.current * .28, h + 80) - 40;
          ctx.fillStyle = `${colors[i % 2]}88`; ctx.fillRect(x, y, 3, 3);
        }
        for (let row = -1; row < Math.ceil(h / 56) + 2; row++) {
          const worldRow = Math.floor(camera.current / 56) + row;
          const y = row * 56 - wrap(camera.current, 56);
          for (let col = 0; col < Math.ceil(w / 82) + 1; col++) {
            const x = col * 82 + (worldRow % 2 ? 21 : 9);
            ctx.fillStyle = colors[Math.abs(worldRow + col) % 2];
            ctx.fillRect(x, y, 8, 8); ctx.fillRect(x + 8, y + 7, 5, 5);
          }
        }
        for (let i = 0; i < 9; i++) {
          const x = (i * 107 + 41) % Math.max(w, 1), y = wrap(i * 89 - camera.current * 1.08, h + 140) - 70;
          ctx.fillStyle = colors[(i + 1) % 2];
          if (zone === 0) { ctx.fillRect(x, y, 4, 34); ctx.fillRect(x - 7, y + 26, 11, 4); }
          if (zone === 1) { ctx.fillRect(x, y, 13, 13); ctx.fillStyle='#f2bd58'; ctx.fillRect(x+4,y+3,5,5); }
          if (zone === 2) { ctx.beginPath(); ctx.moveTo(x,y+22); ctx.lineTo(x+8,y); ctx.lineTo(x+16,y+22); ctx.fill(); }
          if (zone === 3) { ctx.fillRect(x+6,y+10,4,17); ctx.fillStyle='#d7ef91'; ctx.fillRect(x,y+5,16,8); }
          if (zone === 4) { ctx.fillRect(x,y,5,5); ctx.fillRect(x+10,y+10,3,3); }
        }
        ctx.fillStyle='rgba(255,242,182,.72)'; for(let i=0;i<7;i++){ const x=(i*83+t*.012)%Math.max(w,1); const y=wrap(i*67-camera.current*1.35,h+30)-15; ctx.fillRect(x,y,3,3); }
        ctx.fillStyle='rgba(35,25,44,.23)'; ctx.fillRect(0,0,18,h); ctx.fillRect(w-18,0,18,h);
      }
      raf=requestAnimationFrame(draw);
    };
    const onVis=()=>{ visible=!document.hidden; if(visible) raf=requestAnimationFrame(draw); else cancelAnimationFrame(raf); };
    resize(); addEventListener('resize',resize); document.addEventListener('visibilitychange',onVis); raf=requestAnimationFrame(draw);
    return()=>{ cancelAnimationFrame(raf); removeEventListener('resize',resize); document.removeEventListener('visibilitychange',onVis); };
  },[lowPower]);
  const zone = zoneNames[zoneForDepth(hudDepth)];
  return <section className={`mine-scene ${action === 'dig' ? 'traveling' : ''}`} aria-label={`Mining at ${hudDepth.toLocaleString()} metres in ${zone}`}>
    <canvas ref={canvas}/><div className="mine-hud"><span>{zone}</span><strong>{hudDepth.toLocaleString()} m</strong></div>
    <div className="descent-lines" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    {gain > 0 && <div className="depth-gain" key={depth}>+{gain.toLocaleString()} m</div>}
    <div className="cave-message">{cheers[Math.floor(hudDepth/250)%cheers.length]}</div><PixelCat id={cat} action={action}/>
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
    setTimeout(()=>{ if(game.round>=6){setPendingPoints(0);finishGame(results);return;} setSave(s=>({...s,active:s.active?{...s.active,round:s.active.round+1,results,deadline:Date.now()+30000}:null})); setAnswer('');setNotice('');setSuggestion(undefined);setLocked(false);setPendingPoints(0);setAction('idle');setTimeout(()=>inputRef.current?.focus(),50); }, digDuration(result.points, save.settings.reducedMotion));
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
