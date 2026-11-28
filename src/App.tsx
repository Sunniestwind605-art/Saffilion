import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoryCounts, categories, questions } from './data/knowledge';
import { DAILY_SCHEDULE_VERSION, DATASET_VERSION, QUESTION_VERSION } from './data/knowledge';
import { clearHistory, dailyQuestionIds, depthForPoints, digDurationForPoints, findAnswer, freshSave, hydrateExpeditions, isKnownOutsideQuestion, loadSave, persist, pickQuestions, rankFor, replaceHistory, suggestAnswer, summarizeExpeditions, utcDateKey } from './game/engine';
import { SCORING_VERSION, TIERS, type ActiveGame, type Answer, type CatId, type Expedition, type GameMode, type MissingAnswerReport, type RoundResult, type SaveData, type Tier } from './game/types';
import { BIOMES, FINAL_DEPTH, biomeForDepth, biomeIndexForDepth, biomesThroughDepth, drawMineWorld, worldYForDepth } from './game/world';

const cats: { id: CatId; name: string; mood: string; color: string; accent: string }[] = [
  { id: 'pebble', name: 'Safia', mood: 'calm & determined', color: '#c9c8c9', accent: '#8f8d95' },
  { id: 'mochi', name: 'Kairo', mood: 'sweet & playful', color: '#fff1df', accent: '#ed9fac' },
  { id: 'midnight', name: 'Joseph', mood: 'curious & adventurous', color: '#34303e', accent: '#d68aa5' },
  { id: 'nova', name: 'Warona', mood: 'energetic & mischievous', color: '#272432', accent: '#f2bd4f' },
  { id: 'marmalade', name: 'Sharon', mood: 'sleepy & hardworking', color: '#e9a15b', accent: '#bd6b42' },
];
const cheers = ['You’ve got this!', 'Keep digging!', 'Little steps count.', 'Every gem starts somewhere.', 'A little deeper, a little brighter.', 'Look how far you’ve come!'];
type Screen = 'intro'|'select'|'ready'|'game'|'results'|'journal'|'archive'|'shop'|'help';
const zoneForDepth = biomeIndexForDepth;
const zoneNames = BIOMES.map(item=>item.name);
const tierOrder: Tier[] = ['Pebble','Copper','Quartz','Sapphire','Amethyst','Stardust'];
const maxScore = TIERS.Stardust * 7;
const cosmetics = [
  { id:'pink-shovel', name:'Pink Shovel', price:12, icon:'⚒' },
  { id:'flower-helmet', name:'Flower Helmet', price:18, icon:'✿' },
  { id:'star-lamp', name:'Star Lamp', price:25, icon:'✦' },
  { id:'crystal-pack', name:'Crystal Pack', price:35, icon:'◇' },
];

const spritePalettes: Record<CatId, { fur: string; light: string; dark: string; detail: string }> = {
  pebble: { fur: '#b8b7bd', light: '#dddce0', dark: '#77747f', detail: '#5f5c68' },
  mochi: { fur: '#f5dfc8', light: '#fff3df', dark: '#c9938d', detail: '#e990a4' },
  midnight: { fur: '#302d3b', light: '#575164', dark: '#171522', detail: '#e48aa6' },
  nova: { fur: '#24212f', light: '#494353', dark: '#12101a', detail: '#efbd4f' },
  marmalade: { fur: '#df9250', light: '#f6bd72', dark: '#a95738', detail: '#8d4935' },
};

function drawPixelCat(ctx: CanvasRenderingContext2D, id: CatId, action: string, frame: number, cosmetic?: string | null) {
  const p = spritePalettes[id];
  const px = (color: string, x: number, y: number, w = 1, h = 1) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  const outline = '#362735';
  const isDig = action.startsWith('dig');
  const idleBob = action === 'idle' ? (id === 'nova' ? frame % 2 : id === 'mochi' && frame % 4 === 0 ? -1 : id === 'marmalade' && frame % 6 === 0 ? 1 : 0) : 0;
  const bob = action === 'walk' || action === 'celebrate' || action === 'happy' ? frame % 2 : isDig ? frame % 2 : idleBob;
  const y = (action === 'celebrate' || action === 'happy') && frame % 2 ? -2 : bob;
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
  const closed = action === 'sad' || (action === 'idle' && ((id === 'midnight' && frame % 7 === 0) || (id === 'marmalade' && frame % 4 < 2)));
  if (closed) { px(outline, 16, 25 + y, 5, 1); px(outline, 30, 25 + y, 5, 1); }
  else {
    px('#fff9df', 16, 23 + y, id === 'nova' ? 5 : 4, id === 'nova' ? 5 : 4);
    px('#fff9df', 30, 23 + y, id === 'nova' ? 5 : 4, id === 'nova' ? 5 : 4);
    px('#211925', 18, 24 + y, 2, 3); px('#211925', 30, 24 + y, 2, 3);
  }
  px(id === 'pebble' ? '#6c6572' : '#dc7f91', 24, 28 + y, 3, 2);
  px(outline, 23, 31 + y, 2, 1); px(outline, 27, 31 + y, 2, 1); px(outline, 25, 30 + y, 2, 2);
  if (action === 'happy' || action === 'celebrate') { px(p.detail, 22, 32 + y, 2, 1); px(p.detail, 28, 32 + y, 2, 1); }
  if (id === 'pebble') { px(p.dark, 11, 22 + y, 3, 2); px(p.dark, 36, 22 + y, 3, 2); }
  if (id === 'mochi') { px(p.detail, 13, 28 + y, 3, 2); px(p.detail, 34, 28 + y, 3, 2); }
  if (id === 'midnight') { px('#e8d8e7', 11, 19 + y, 8, 3); px('#e8d8e7', 31, 30 + y, 7, 2); }
  if (id === 'nova') { px(p.detail, 12, 20 + y, 3, 2); px(p.detail, 35, 20 + y, 3, 2); }
  if (id === 'marmalade') { px(p.dark, 17, 19 + y, 3, 3); px(p.dark, 24, 19 + y, 3, 3); px(p.dark, 31, 19 + y, 3, 3); px(p.dark, 15, 32 + y, 3, 2); px(p.dark, 33, 32 + y, 3, 2); }

  // Pickaxe is part of the sprite frame, not a smooth rotated DOM shape.
  const shovel = cosmetic === 'pink-shovel' ? '#ef8cac' : '#b6adb3';
  if (isDig && frame % 2) {
    px(outline, 4, 29, 5, 3); px(shovel, 3, 27, 9, 3); px(outline, 8, 29, 3, 16); px(cosmetic === 'pink-shovel' ? '#c35d84' : '#80543d', 9, 30, 1, 13);
  } else {
    px(outline, 38, 8 + y, 3, 31); px('#80543d', 39, 10 + y, 1, 27);
    px(outline, 34, 7 + y, 11, 4); px(shovel, 35, 8 + y, 9, 2);
  }
  if (cosmetic === 'flower-helmet') { px('#fff2a1', 11, 7+y, 3,3); px('#ee86a0', 9,8+y,2,2); px('#ee86a0', 13,8+y,2,2); px('#ee86a0', 11,5+y,2,2); }
  if (cosmetic === 'star-lamp') { px('#fff6a6', 20,6+y,11,2); px('#fff6a6', 24,2+y,3,10); }
  if (cosmetic === 'crystal-pack') { px(outline, 8,29+y,5,10); px('#75c6d1',9,28+y,3,8); px('#b7eff0',10,26+y,2,4); }
}

function PixelCat({ id, action = 'idle', label, cosmetic }: { id: CatId; action?: string; label?: string; cosmetic?: string | null }) {
  const cat = cats.find(c => c.id === id)!;
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current; const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.imageSmoothingEnabled = false;
    let raf = 0, frame = 0, last = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const loop = (time: number) => {
      const pace = action.startsWith('dig') ? action.includes('stardust') ? 105 : action.includes('amethyst') ? 125 : action.includes('sapphire') ? 145 : action.includes('quartz') ? 170 : action.includes('copper') ? 220 : 285 : id === 'nova' ? 280 : id === 'marmalade' ? 560 : 420;
      if (!last || time - last > pace) { last = time; drawPixelCat(ctx, id, action, frame++, cosmetic); }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(loop);
    };
    loop(0);
    const onVisibility = () => { if (!document.hidden && !reduce) { last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisibility); };
  }, [id, action, cosmetic]);
  return <div className={`pixel-cat cat-${id} ${action}`} role="img" aria-label={label || `${cat.name} the mining cat`}>
    <canvas ref={canvas} width="48" height="48" aria-hidden="true" />
  </div>;
}

function MineScene({ cat, depth, action, lowPower, tier, cosmetic, seed='saffilion' }: { cat: CatId; depth: number; action: string; lowPower: boolean; tier?: Tier; cosmetic?: string | null; seed?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shownDepth = useRef(depth);
  const camera = useRef(worldYForDepth(depth));
  const animation = useRef<{ from: number; to: number; cameraFrom: number; cameraTo: number; started: number; duration: number } | null>(null);
  const discoveryTimers = useRef<number[]>([]);
  const [hudDepth, setHudDepth] = useState(depth);
  const [gain, setGain] = useState(0);
  const [discovery, setDiscovery] = useState<(typeof BIOMES)[number] | null>(null);

  useEffect(() => {
    const from = shownDepth.current;
    discoveryTimers.current.forEach(clearTimeout); discoveryTimers.current=[];
    const crossed=BIOMES.slice(1).filter(item=>item.start>from&&item.start<=depth);
    crossed.forEach((item,index)=>discoveryTimers.current.push(window.setTimeout(()=>setDiscovery(item),420+index*820)));
    if(crossed.length)discoveryTimers.current.push(window.setTimeout(()=>setDiscovery(null),520+crossed.length*820));
    if (depth <= from) { shownDepth.current = depth; camera.current=worldYForDepth(depth); setHudDepth(depth); return; }
    const delta = depth - from;
    setGain(delta);
    if (canvas.current) canvas.current.dataset.hadIntermediate = 'false';
    animation.current = { from, to:depth, cameraFrom:worldYForDepth(from), cameraTo:worldYForDepth(depth), started:performance.now(), duration:digDurationForPoints(delta/10,false) };
    return()=>{discoveryTimers.current.forEach(clearTimeout);};
  }, [depth]);

  useEffect(() => {
    if (action.startsWith('dig') || !animation.current) return;
    shownDepth.current=animation.current.to;camera.current=worldYForDepth(animation.current.to);setHudDepth(animation.current.to);animation.current=null;
  }, [action]);

  useEffect(() => {
    const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;
    let raf=0,visible=!document.hidden,last=0,lastHud=0,dpr=1;
    const resize=()=>{const rect=el.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);el.width=Math.max(1,Math.round(rect.width*dpr));el.height=Math.max(1,Math.round(rect.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);};
    const observer=new ResizeObserver(resize);observer.observe(el);resize();
    const draw=(time:number)=>{
      if(!visible)return;
      if(!lowPower||time-last>65){
        last=time;const move=animation.current;
        if(move){
          const progress=Math.min(1,(time-move.started)/move.duration),eased=progress<.5?4*progress**3:1-Math.pow(-2*progress+2,3)/2;
          shownDepth.current=move.from+(move.to-move.from)*eased;camera.current=move.cameraFrom+(move.cameraTo-move.cameraFrom)*eased;
          if(progress>0&&progress<1)el.dataset.hadIntermediate='true';
          if(time-lastHud>60||progress===1){lastHud=time;setHudDepth(Math.round(shownDepth.current));}
          if(progress===1){shownDepth.current=move.to;camera.current=move.cameraTo;animation.current=null;}
        }
        el.dataset.camera=camera.current.toFixed(2);el.dataset.worldDepth=shownDepth.current.toFixed(2);
        drawMineWorld(ctx,{width:el.clientWidth,height:el.clientHeight,cameraY:camera.current,animatedDepth:shownDepth.current,seed,time,digging:action.startsWith('dig'),lowPower});
      }
      raf=requestAnimationFrame(draw);
    };
    const onVisibility=()=>{visible=!document.hidden;if(visible)raf=requestAnimationFrame(draw);else cancelAnimationFrame(raf);};
    document.addEventListener('visibilitychange',onVisibility);raf=requestAnimationFrame(draw);
    return()=>{cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);};
  },[lowPower,seed,action]);

  const biome=biomeForDepth(hudDepth),biomeIndex=biomeIndexForDepth(hudDepth),next=BIOMES[biomeIndex+1];
  const digPower=Math.max(.1,Math.min(1,gain/1000)),isDig=action.startsWith('dig'),tierClass=tier?`tier-${tier.toLowerCase()}`:'';
  return <section className={`mine-scene biome-${biome.id} ${isDig?'traveling':''} ${tierClass} ${tier&&tierOrder.indexOf(tier)>=3?'powerful-dig':''}`} style={{'--dig-power':digPower,'--dig-time':`${digDurationForPoints(gain/10)}ms`} as React.CSSProperties} aria-label={`Mining at ${hudDepth.toLocaleString()} metres in ${biome.name}`}>
    <canvas ref={canvas}/><div className="mine-hud"><span>{biome.name}</span><strong>{hudDepth.toLocaleString()} m</strong></div>
    <details className="depth-map"><summary><span>Depth map</span><b>{hudDepth.toLocaleString()}m</b></summary><div><i className="map-track"><b style={{height:`${Math.min(100,hudDepth/FINAL_DEPTH*100)}%`}}/><em style={{top:`${Math.min(100,hudDepth/FINAL_DEPTH*100)}%`}}>🐾</em></i><ol>{BIOMES.map((item,index)=><li key={item.id} className={index<biomeIndex?'found':index===biomeIndex?'current':'locked'}><b>{index<=biomeIndex+1?item.name:'???'}</b><small>{item.start.toLocaleString()}m</small></li>)}</ol><p>{next?`Next: ${next.name} at ${next.start.toLocaleString()}m`:'Final treasure chamber reached!'}</p></div></details>
    <div className="descent-lines" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    {isDig&&<div className="dig-particles" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i}/>)}</div>}
    {gain>0&&<div className="depth-gain" key={depth}>+{gain.toLocaleString()} m</div>}
    {discovery&&<div className="biome-discovery" role="status"><small>New discovery</small><strong>{discovery.name}</strong><span>{discovery.start.toLocaleString()} metres</span></div>}
    <div className="cave-message">{cheers[Math.floor(hudDepth/180)%cheers.length]}</div><PixelCat id={cat} action={action} cosmetic={cosmetic}/>
  </section>;
}

function WorldThumbnail({ depth, seed }: { depth:number; seed:string }) {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{const el=ref.current,ctx=el?.getContext('2d');if(!el||!ctx)return;el.width=240;el.height=150;ctx.imageSmoothingEnabled=false;drawMineWorld(ctx,{width:240,height:150,cameraY:worldYForDepth(depth),animatedDepth:depth,seed,time:0,digging:false,lowPower:false});},[depth,seed]);
  return <canvas ref={ref} aria-label={`${biomeForDepth(depth).name} preview`}/>;
}

function WorldPreview() {
  const [depth,setDepth]=useState(75),[cat,setCat]=useState<CatId>('pebble'),[tier,setTier]=useState<Tier>('Pebble'),[action,setAction]=useState('idle'),[viewport,setViewport]=useState('phone');
  const seed='world-preview-5';
  const simulate=(nextTier:Tier)=>{setTier(nextTier);setAction(`dig-${nextTier.toLowerCase()}`);setDepth(value=>Math.min(FINAL_DEPTH,value+TIERS[nextTier]*10));window.setTimeout(()=>setAction('idle'),digDurationForPoints(TIERS[nextTier],false)+400);};
  return <main className="world-preview"><header><div><small>Development only · deterministic seed</small><h1>Saffilion World Preview</h1></div><output>Depth {depth}m · World Y {worldYForDepth(depth).toFixed(1)}px · {biomeForDepth(depth).name}</output></header>
    <section className="preview-controls"><label>Depth<input type="range" min="0" max={FINAL_DEPTH} step="10" value={depth} onChange={event=>setDepth(Number(event.target.value))}/><input type="number" min="0" max={FINAL_DEPTH} value={depth} onChange={event=>setDepth(Math.max(0,Math.min(FINAL_DEPTH,Number(event.target.value))))}/></label><label>Cat<select value={cat} onChange={event=>setCat(event.target.value as CatId)}>{cats.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Viewport<select value={viewport} onChange={event=>setViewport(event.target.value)}><option value="phone">390px phone</option><option value="small">320px phone</option><option value="landscape">844px landscape</option><option value="tablet">768px tablet</option></select></label><div>{tierOrder.map(item=><button key={item} className={`tier-${item.toLowerCase()}`} onClick={()=>simulate(item)}>{item} +{TIERS[item]*10}m</button>)}</div></section>
    <section className={`preview-stage ${viewport}`}><MineScene cat={cat} depth={depth} action={action} lowPower={false} tier={tier} seed={seed}/></section>
    <section className="biome-grid">{BIOMES.map(item=>{const middle=Math.min(item.end-1,item.start+Math.max(40,(item.end-item.start)/2));return <article key={item.id}><WorldThumbnail depth={middle} seed={seed}/><div><strong>{item.name}</strong><span>{item.start.toLocaleString()}–{Math.min(FINAL_DEPTH,item.end).toLocaleString()}m</span></div></article>;})}</section>
  </main>;
}

function Timer({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const fired = useRef(false);
  useEffect(() => { fired.current = false; const tick=()=>{ const n=Math.max(0,deadline-Date.now()); setLeft(n); if(n===0&&!fired.current){fired.current=true;onExpire();} }; tick(); const id=setInterval(tick,100); return()=>clearInterval(id); },[deadline,onExpire]);
  const sec = Math.ceil(left/1000); return <div className={`timer ${sec<=5?'urgent':''}`} aria-label={`${sec} seconds remaining`}><span>{sec}</span><i style={{ '--p': `${left/30000*100}%` } as React.CSSProperties}/></div>;
}

function AnswerExplorer({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const question = questions.find(item => item.id === questionId);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 24;
  const answers = useMemo(() => {
    if (!question) return [];
    const needle = search.trim().toLocaleLowerCase();
    return question.answers.filter(answer => !needle || [answer.canonical, ...answer.aliases].some(value => value.toLocaleLowerCase().includes(needle)))
      .sort((left, right) => tierOrder.indexOf(left.tier) - tierOrder.indexOf(right.tier) || left.canonical.localeCompare(right.canonical));
  }, [question, search]);
  if (!question) return null;
  const pages = Math.max(1, Math.ceil(answers.length / pageSize));
  const shown = answers.slice(page * pageSize, page * pageSize + pageSize);
  return <section className="answer-explorer" aria-label="Verified alternative answers"><header><div><small>What else could I have found?</small><h2>{question.prompt}</h2></div><button onClick={onClose} aria-label="Close answer list">×</button></header><label>Search {question.answers.length.toLocaleString()} verified answers<input value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}} placeholder="Search answers…"/></label><div className="answer-list">{shown.map(answer=><article key={answer.entityId} className={`tier-${answer.tier.toLowerCase()}`}><i/><span><strong>{answer.canonical}</strong>{answer.aliases.length>0&&<small>Also: {answer.aliases.slice(0,3).join(', ')}</small>}</span><b>{answer.tier}<small>{answer.points} pts</small></b></article>)}</div>{answers.length===0?<p>No verified answers match that search.</p>:<footer><button disabled={page===0} onClick={()=>setPage(value=>value-1)}>← Previous</button><span>{page+1} / {pages}</span><button disabled={page>=pages-1} onClick={()=>setPage(value=>value+1)}>Next →</button></footer>}</section>;
}

function App() {
  if(import.meta.env.DEV&&new URLSearchParams(location.search).has('worldPreview'))return <WorldPreview/>;
  const [save,setSave] = useState<SaveData>(()=>loadSave());
  const [screen,setScreen] = useState<Screen>(()=>loadSave().active?'game':'intro');
  const [category,setCategory] = useState('All');
  const [answer,setAnswer] = useState('');
  const [notice,setNotice] = useState('');
  const [suggestion,setSuggestion] = useState<string>();
  const [locked,setLocked] = useState(false);
  const [action,setAction] = useState('idle');
  const [pendingPoints,setPendingPoints] = useState(0);
  const [lastFind,setLastFind] = useState<Answer|null>(null);
  const [lastExpedition,setLastExpedition] = useState<Expedition|null>(null);
  const [isRecord,setIsRecord] = useState(false);
  const [journalOpen,setJournalOpen] = useState<string|null>(null);
  const [answerExploreId,setAnswerExploreId] = useState<string|null>(null);
  const [reportPreview,setReportPreview] = useState<MissingAnswerReport|null>(null);
  const [updateReady,setUpdateReady] = useState(()=>Boolean((window as typeof window&{saffilionUpdateReady?:boolean}).saffilionUpdateReady));
  const fileInput=useRef<HTMLInputElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);
  const recoverPendingOnMount=useRef(Boolean(save.active?.pendingResult));

  useEffect(()=>persist(save),[save]);
  useEffect(()=>{let mounted=true;void hydrateExpeditions().then(records=>{if(!mounted||!records.length)return;setSave(current=>{const merged=[...new Map([...current.expeditions,...records].map(item=>[item.id,item])).values()].sort((a,b)=>b.date.localeCompare(a.date));return {...current,expeditions:merged,lifetimeStats:summarizeExpeditions(merged)};});});return()=>{mounted=false;};},[]);
  useEffect(()=>{const ready=()=>setUpdateReady(true);window.addEventListener('saffilion-update-ready',ready);return()=>window.removeEventListener('saffilion-update-ready',ready);},[]);
  useEffect(()=>{
    const root=document.documentElement;
    let inputFocused=document.activeElement instanceof HTMLInputElement;
    let maxViewportHeight=Math.max(innerHeight,visualViewport?.height||0);
    let wasOpen=false;
    let blurTimer=0;
    const update=()=>{
      const viewport=visualViewport;
      const height=Math.round(viewport?.height||innerHeight);
      if(!inputFocused)maxViewportHeight=Math.max(maxViewportHeight,innerHeight,height);
      const shrunkFromLayout=innerHeight-height>80;
      const shrunkFromRest=maxViewportHeight-height>100;
      const shortFocusedViewport=inputFocused&&innerWidth<1024&&height<650;
      const open=inputFocused&&(shrunkFromLayout||shrunkFromRest||shortFocusedViewport);
      root.style.setProperty('--vvh',`${height}px`);
      root.style.setProperty('--vv-top',`${Math.round(viewport?.offsetTop||0)}px`);
      root.classList.toggle('keyboard-open',open);
      if(open&&!wasOpen){const panel=document.querySelector<HTMLElement>('.question-panel');if(panel)panel.scrollTop=0;}
      wasOpen=open;
    };
    const onFocusIn=(event:FocusEvent)=>{clearTimeout(blurTimer);inputFocused=event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement;update();};
    const onFocusOut=()=>{clearTimeout(blurTimer);blurTimer=window.setTimeout(()=>{inputFocused=document.activeElement instanceof HTMLInputElement||document.activeElement instanceof HTMLTextAreaElement;update();},80);};
    update();
    visualViewport?.addEventListener('resize',update);visualViewport?.addEventListener('scroll',update);window.addEventListener('resize',update);document.addEventListener('focusin',onFocusIn);document.addEventListener('focusout',onFocusOut);
    return()=>{clearTimeout(blurTimer);visualViewport?.removeEventListener('resize',update);visualViewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);document.removeEventListener('focusin',onFocusIn);document.removeEventListener('focusout',onFocusOut);root.classList.remove('keyboard-open');};
  },[]);
  const cat = save.selectedCat;
  const game = save.active;
  const question = game ? questions.find(q=>q.id===game.questionIds[game.round]) : undefined;
  const score = game?.results.reduce((n,r)=>n+r.points,0)||0;
  const depth = depthForPoints(score+pendingPoints);

  const beep=useCallback((kind:'good'|'bad'|'dig')=>{ if(!save.settings.sound) return; const A=window.AudioContext; if(!A)return; const c=new A(),o=c.createOscillator(),g=c.createGain(); o.connect(g).connect(c.destination); o.frequency.value=kind==='good'?660:kind==='dig'?150:220; g.gain.setValueAtTime(.035,c.currentTime); g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.18); o.start();o.stop(c.currentTime+.2); },[save.settings.sound]);
  const haptic=useCallback((pattern:number|number[])=>{if(save.settings.haptics&&navigator.vibrate)navigator.vibrate(pattern);},[save.settings.haptics]);

  const chooseCat=(id:CatId)=>setSave(s=>({...s,selectedCat:id}));
  const begin=(mode:GameMode='unlimited', requestedDate=utcDateKey())=>{
    const isDaily=mode==='daily'||mode==='practice';
    if(mode==='daily'&&save.dailyRecords.some(record=>record.date===requestedDate)){setNotice('Today’s Daily Dig is complete. You can practise it from the Archive.');setScreen('archive');return;}
    const dailyIds=isDaily?dailyQuestionIds(questions,requestedDate,DAILY_SCHEDULE_VERSION):null;
    if(isDaily&&!dailyIds){setNotice('That historical question-bank version is not available on this device.');setScreen('archive');return;}
    const picked=isDaily?{chosen:dailyIds!,bag:save.questionBag,recent:save.recentQuestions}:pickQuestions(questions,save,category);
    const active:ActiveGame={questionIds:picked.chosen,round:0,results:[],deadline:Date.now()+30000,category:isDaily?'Daily Dig':category,mode,dailyDate:isDaily?requestedDate:undefined,scheduleVersion:isDaily?DAILY_SCHEDULE_VERSION:undefined,seed:isDaily?`daily:${requestedDate}:${DAILY_SCHEDULE_VERSION}`:crypto.randomUUID()};
    setSave(s=>({...s,active,questionBag:picked.bag,recentQuestions:picked.recent}));setLocked(false);setPendingPoints(0);setAction('idle');setScreen('game');setAnswer('');setNotice('');setSuggestion(undefined);setLastFind(null);setAnswerExploreId(null);setTimeout(()=>inputRef.current?.focus(),100);
  };

  const finishGame=useCallback((resultList:RoundResult[])=>{
    const total=resultList.reduce((n,r)=>n+r.points,0), mode=game?.mode??'unlimited';
    const expeditionDepth=depthForPoints(total);
    const expedition:Expedition={id:crypto.randomUUID(),date:new Date().toISOString(),cat,score:total,depth:expeditionDepth,rounds:resultList,mode,dailyDate:game?.dailyDate,scheduleVersion:game?.scheduleVersion,questionIds:game?.questionIds,datasetVersion:DATASET_VERSION,scoringVersion:SCORING_VERSION,questionVersion:QUESTION_VERSION,seed:game?.seed,discoveredBiomes:biomesThroughDepth(expeditionDepth)};
    setIsRecord(total>save.lifetimeStats.highestScore);setLastExpedition(expedition);setSave(s=>{
      const dailyRecords=mode==='daily'&&game?.dailyDate&&!s.dailyRecords.some(record=>record.date===game.dailyDate)?[...s.dailyRecords,{date:game.dailyDate,scheduleVersion:game.scheduleVersion??DAILY_SCHEDULE_VERSION,expeditionId:expedition.id,score:total,depth:expedition.depth,cat,questionIds:[...(game.questionIds??[])],rounds:resultList,completedAt:expedition.date,datasetVersion:DATASET_VERSION,scoringVersion:SCORING_VERSION,questionVersion:QUESTION_VERSION}]:s.dailyRecords;
      const expeditions=[expedition,...s.expeditions];
      return {...s,active:null,dailyRecords,expeditions,lifetimeStats:summarizeExpeditions(expeditions),crystals:s.crystals+Math.max(5,Math.round(total/25))};
    });setScreen('results');setAction('celebrate');haptic([25,45,25]);
  },[cat,game,save.lifetimeStats.highestScore,haptic]);

  useEffect(()=>{
    if(!recoverPendingOnMount.current||!game?.pendingResult)return;
    recoverPendingOnMount.current=false;
    const recovered=[...game.results,game.pendingResult];
    if(game.round>=6){finishGame(recovered);return;}
    setSave(current=>({...current,active:current.active?{...current.active,round:current.active.round+1,results:recovered,pendingResult:undefined,deadline:Date.now()+30000}:null}));
    setAnswer('');setNotice('');setSuggestion(undefined);setLastFind(null);setLocked(false);setPendingPoints(0);setAction('idle');
  },[game?.pendingResult,game?.round,game?.results,finishGame]);

  const nextRound=useCallback((result:RoundResult)=>{
    if(!game)return; const results=[...game.results,result];
    const finalize=()=>{if(game.round>=6){setPendingPoints(0);finishGame(results);return;}setSave(s=>({...s,active:s.active?{...s.active,round:s.active.round+1,results,pendingResult:undefined,deadline:Date.now()+30000}:null}));setAnswer('');setNotice('');setSuggestion(undefined);setLastFind(null);setLocked(false);setPendingPoints(0);setAction('idle');setTimeout(()=>inputRef.current?.focus(),50);};
    setSave(s=>({...s,active:s.active?{...s.active,pendingResult:result}:null}));
    setLocked(true);
    if(result.points){const reveal=save.settings.reducedMotion?60:360,dig=digDurationForPoints(result.points,save.settings.reducedMotion);setAction('happy');haptic(result.points>=TIERS.Amethyst?[20,35,20]:20);setTimeout(()=>{setPendingPoints(result.points);setAction(`dig-${result.tier?.toLowerCase()||'pebble'}`);beep('dig');haptic(result.points===TIERS.Stardust?[18,25,18,25,35]:result.points>=TIERS.Sapphire?[20,35,25]:18);setTimeout(finalize,dig);},reveal);}
    else{setAction('sad');setTimeout(finalize,save.settings.reducedMotion?120:520);}
  },[game,beep,finishGame,haptic,save.settings.reducedMotion]);

  const expire=useCallback(()=>{ if(!question||locked)return; setLastFind(null); nextRound({questionId:question.id,prompt:question.prompt,answer:answer.trim(),points:0,timedOut:true,datasetVersion:DATASET_VERSION,scoringVersion:SCORING_VERSION,questionVersion:QUESTION_VERSION});setNotice('Time’s up — let’s see what waits below.'); },[question,locked,nextRound,answer]);

  const submit=(e?:React.FormEvent)=>{ e?.preventDefault(); if(!question||locked||Date.now()>=game!.deadline)return; const raw=answer.trim(); if(!raw){setLastFind(null);setNotice('Type an answer first, little miner!');return;} const match=findAnswer(question,raw); if(match){beep('good');setLastFind(match);setNotice('');nextRound({questionId:question.id,prompt:question.prompt,answer:raw,canonical:match.canonical,entityId:match.entityId,points:match.points,tier:match.tier,timedOut:false,datasetVersion:DATASET_VERSION,scoringVersion:SCORING_VERSION,questionVersion:QUESTION_VERSION});return;} setLastFind(null);const maybe=suggestAnswer(question,raw);setSuggestion(maybe?.canonical);setNotice(maybe?`That isn’t an exact match. Did you mean ${maybe.canonical}?`:isKnownOutsideQuestion(question,raw)?'That is a real answer, but it does not fit this question. Try another!':'That answer isn’t in our answer book yet. Try another!');beep('bad'); };

  const recordMissing=()=>{if(!question||!answer.trim())return;const explanation=prompt('Optional: briefly explain why this answer should count. Leave blank to skip.')?.trim()||undefined;const report:MissingAnswerReport={id:crypto.randomUUID(),questionId:question.id,prompt:question.prompt,answer:answer.trim(),datasetVersion:DATASET_VERSION,date:new Date().toISOString(),explanation};setSave(s=>({...s,missingAnswers:[...s.missingAnswers,report]}));setNotice('Saved only on this device for review. Nothing was sent.');};
  const updateSettings=(patch:Partial<SaveData['settings']>)=>setSave(s=>({...s,settings:{...s.settings,...patch}}));
  const exportSave=()=>{ const blob=new Blob([JSON.stringify(save,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='saffilion-save.json';a.click();URL.revokeObjectURL(a.href); };
  const exportReports=()=>{const safe=save.missingAnswers.map(({questionId,prompt,answer,datasetVersion,date,explanation})=>({questionId,prompt,answer,datasetVersion,date,explanation}));const blob=new Blob([JSON.stringify({datasetVersion:DATASET_VERSION,reports:safe},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='saffilion-answer-reports.json';a.click();URL.revokeObjectURL(a.href);};
  const openIssue=(report:MissingAnswerReport)=>{const title=encodeURIComponent('[Answer review] '+report.answer+' for '+(report.prompt??report.questionId));const body=encodeURIComponent(['Please review this possible missing answer.','',`Prompt ID: ${report.questionId}`,`Prompt: ${report.prompt??''}`,`Suggested answer: ${report.answer}`,`Dataset version: ${report.datasetVersion??'unknown'}`,report.explanation?`Explanation: ${report.explanation}`:''].filter(Boolean).join('\n'));window.open(`https://github.com/Sunniestwind605-art/Saffilion/issues/new?title=${title}&body=${body}`,'_blank','noopener,noreferrer');};
  const importSave=async(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(![1,2].includes(data?.version)||!Array.isArray(data.expeditions)||data.expeditions.some((item:Expedition)=>!item?.id||!Array.isArray(item.rounds)||!Number.isFinite(item.score)||!Number.isFinite(item.depth)))throw Error();const clean=freshSave(),expeditions=data.expeditions as Expedition[];await replaceHistory(expeditions);setSave({...clean,...data,version:2,expeditions,lifetimeStats:summarizeExpeditions(expeditions),settings:{...clean.settings,...data.settings},active:null});setNotice('Save imported safely. All expedition history was restored.');}catch{setNotice('That file is not a valid Saffilion save.');}e.target.value='';};
  const reset=()=>{if(confirm('Reset all Saffilion progress? This cannot be undone unless you exported a save.')){void clearHistory();setSave(freshSave());setScreen('intro');}};

  const buyCosmetic=(id:string,price:number)=>{if(save.unlocked.includes(id)){setSave(s=>({...s,equipped:s.equipped===id?null:id}));setNotice(save.equipped===id?'Cosmetic put away.':'Cosmetic equipped!');return;}if(save.crystals<price){setNotice(`You need ${price-save.crystals} more crystals.`);return;}setSave(s=>({...s,crystals:s.crystals-price,unlocked:[...s.unlocked,id],equipped:id}));setNotice('Cosmetic unlocked and equipped!');};
  const stats=useMemo(()=>({best:save.lifetimeStats.highestScore,deepest:save.lifetimeStats.deepestExpedition,lifetime:save.lifetimeStats.lifetimeDepth,correct:save.lifetimeStats.correctAnswers,rare:save.lifetimeStats.rareAnswers}),[save.lifetimeStats]);
  const menu=<><nav className="top-actions"><button onClick={()=>setScreen('journal')} aria-label="Open My Digging Journal">Journal</button><button onClick={()=>setScreen('archive')}>Archive</button><button onClick={()=>setScreen('shop')}>Burrow</button><button onClick={()=>setScreen('help')}>Help</button><button onClick={()=>updateSettings({sound:!save.settings.sound})} aria-label={save.settings.sound?'Mute sound':'Enable sound'}>{save.settings.sound?'♪':'×'}</button></nav>{updateReady&&<aside className="update-ready"><span>{save.active?'A new cave map is ready after this expedition.':'A new Saffilion update is ready.'}</span>{!save.active&&<button onClick={()=>window.dispatchEvent(new Event('saffilion-apply-update'))}>Update safely</button>}</aside>}</>;

  if(screen==='intro') return <main className="intro screen"><div className="sky" aria-hidden="true"><i/><i/><i/><b/><b/><b/></div><div className="intro-sparkles" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/></div><section className="title-card"><p>Made with love for Safia</p><h1>SAFFILION</h1><span><i className="mini-gem amethyst"/>A cozy rarity-mining adventure<i className="mini-gem quartz"/></span></section><div className="intro-land"><PixelCat id={cat} action="walk" cosmetic={save.equipped}/><div className="mine-door"><b>MINE</b><i/><em/></div><div className="flowers" aria-hidden="true">✦ · ✿ · ✦ · ✿</div></div><div className="intro-strata" aria-hidden="true"><i/><i/><i/><i/><i/><b className="buried-gem gem-a"/><b className="buried-gem gem-b"/><b className="buried-gem gem-c"/><b className="buried-gem gem-d"/><b className="buried-gem gem-e"/></div><div className="intro-bottom"><div className="intro-chips"><span>7 Questions</span><span>30 Seconds</span><span>10 Biomes</span></div><button className="primary intro-cta" onClick={()=>setScreen('select')}><i aria-hidden="true"/>Let’s Dig!</button><p>The rarer the answer, the deeper we dig!</p></div></main>;

  if(screen==='select') return <main className="screen paper"><header><button className="back" onClick={()=>setScreen('intro')}>← Back</button><div><small>Choose your digging buddy</small><h1>Meet the miners</h1></div></header><div className="cat-grid">{cats.map(c=><button key={c.id} className={`cat-card ${cat===c.id?'selected':''}`} onClick={()=>chooseCat(c.id)} aria-pressed={cat===c.id}><PixelCat id={c.id} cosmetic={save.equipped}/><strong>{c.name}</strong><span>{c.mood}</span><i>{cat===c.id?'✓ Ready to dig!':'Choose'}</i></button>)}</div><button className="primary sticky-cta" onClick={()=>setScreen('ready')}>Adventure with {cats.find(c=>c.id===cat)!.name}</button></main>;

  if(screen==='ready') {const today=utcDateKey(),daily=save.dailyRecords.find(record=>record.date===today);return <main className="screen ready">{menu}<section><span className="eyebrow">Expedition board</span><h1>Where shall we dig?</h1><PixelCat id={cat} cosmetic={save.equipped}/><p className="tutorial-tip">Think of a correct answer. The rarer it is, the deeper your cat digs! You have 30 seconds.</p><div className="mode-cards"><article><span>✦ Shared UTC challenge</span><h2>Daily Dig</h2><p>{daily?`Complete · ${daily.score} points · ${daily.depth.toLocaleString()} m`:'The same balanced seven questions for every player today.'}</p><button className="primary" onClick={()=>daily?setScreen('archive'):begin('daily',today)}>{daily?'View in Archive':'Play Today'}</button></article><article><span>∞ No daily limit</span><h2>Unlimited Dig</h2><label>Question mix<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c} value={c}>{c==='All'?`General knowledge (${questions.filter(question=>question.mode==='standard').length})`:`${c} (${categoryCounts.get(c)??0})`}</option>)}</select></label><button className="primary" onClick={()=>begin('unlimited')}>Start Digging</button></article></div><div className="rules"><span>7 questions</span><span>30 seconds each</span><span>2 easy · 3 medium · 2 challenging</span></div><button className="text-button" onClick={()=>setScreen('select')}>Change cat</button></section></main>;}

  if(screen==='game'&&game&&question) return <main className={`game-shell ${locked?'is-locked':''}`}>{menu}<MineScene cat={cat} depth={depth} action={action} lowPower={save.settings.batterySaver} tier={lastFind?.tier} cosmetic={save.equipped} seed={game.seed??game.questionIds.join('|')}/><section className="question-panel"><div className="round-row"><span>Question {game.round+1} / 7</span><span>{game.mode==='daily'||game.mode==='practice'?`Daily Dig · ${game.dailyDate}`:question.category}</span><strong>{score} pts</strong></div><div className="progress"><i style={{width:`${(game.round/7)*100}%`}}/></div><div className="prompt-row"><h1>{question.prompt}</h1><Timer deadline={game.deadline} onExpire={expire}/></div><form onSubmit={submit}><label htmlFor="answer">Your answer</label><div className="answer-row"><input ref={inputRef} id="answer" value={answer} onChange={e=>{setAnswer(e.target.value);setSuggestion(undefined);setNotice('');setLastFind(null);}} autoComplete="off" autoCorrect="off" enterKeyHint="go" placeholder="Type something clever…" disabled={locked}/><button className="primary" disabled={locked}>Dig!</button></div></form><div className="feedback" aria-live="polite">{lastFind?<div className={`rarity-reveal tier-${lastFind.tier.toLowerCase()}`}><i className="rarity-gem"/><span><strong>{lastFind.tier}</strong><small>{lastFind.canonical}</small></span><b>{lastFind.points} points<small>+{depthForPoints(lastFind.points).toLocaleString()} m</small></b></div>:notice}{suggestion&&<button onClick={()=>{setAnswer(suggestion);setSuggestion(undefined);setNotice('Correction filled in — submit it to score.');inputRef.current?.focus();}}>Use “{suggestion}”</button>}{notice.includes('answer book')&&<button className="text-button" onClick={recordMissing}>My answer should count</button>}</div></section></main>;

  if(screen==='results'&&lastExpedition) { const exp=lastExpedition,best=[...exp.rounds].sort((a,b)=>b.points-a.points)[0],name=cats.find(c=>c.id===exp.cat)!.name,reached=zoneNames[zoneForDepth(exp.depth)]; const distribution=tierOrder.map(t=>({tier:t,count:exp.rounds.filter(r=>r.tier===t).length})); return <main className="screen results"><div className="confetti">✦ · ✧ · ✦ · ✧ · ✦</div><PixelCat id={cat} action="celebrate" cosmetic={save.equipped}/><span className="eyebrow">{exp.mode==='daily'?'Daily Dig complete':exp.mode==='practice'?'Archive practice complete':'Expedition complete'}</span><h1>{name} reached {reached}!</h1><div className="rank-badge">{rankFor(exp.score)}{isRecord&&<small>★ New personal record!</small>}</div><p className="big-depth">{exp.depth.toLocaleString()} m</p><p className="result-facts"><b>{exp.score}</b> / {maxScore} points <span>·</span> <b>{exp.rounds.filter(r=>r.points).length}</b> / 7 correct</p><div className="rarity-distribution" aria-label="Rarity distribution">{distribution.map(({tier,count})=><div key={tier} className={`tier-${tier.toLowerCase()} ${count?'earned':''}`}><i/><span>{tier}</span><b>×{count}</b></div>)}</div><p>Best find: <strong>{best?.canonical||'A brave try'} {best?.tier?`· ${best.tier}`:''}</strong></p><div className="round-summary">{exp.rounds.map((r,i)=><div key={i} className={r.tier?`tier-${r.tier.toLowerCase()}`:''}><i className="result-gem"/><p><b>Round {i+1}</b> · {r.answer||'No answer'}<small>{r.canonical&&r.canonical!==r.answer?` → ${r.canonical}`:r.tier||'No find'}</small><button className="text-button" onClick={()=>setAnswerExploreId(r.questionId)}>Explore verified answers</button></p><strong>{r.points}</strong></div>)}</div>{answerExploreId&&<AnswerExplorer questionId={answerExploreId} onClose={()=>setAnswerExploreId(null)}/>}<div className="result-actions"><button className="primary" onClick={()=>begin(exp.mode==='daily'||exp.mode==='practice'?'practice':'unlimited',exp.dailyDate)}>{exp.mode==='daily'||exp.mode==='practice'?'Practise Again':'Dig Again!'}</button><button onClick={()=>setScreen(exp.mode==='daily'||exp.mode==='practice'?'archive':'journal')}>{exp.mode==='daily'||exp.mode==='practice'?'Daily Archive':'My Digging Journal'}</button><button onClick={()=>setScreen('select')}>Change Cat</button><button onClick={()=>navigator.clipboard?.writeText(`Saffilion ✦ ${rankFor(exp.score)}\n${exp.score}/${maxScore} points · ${exp.depth.toLocaleString()}m deep\n${exp.rounds.map(r=>r.tier?['🟫','🟠','◇','💎','🔮','✦'][tierOrder.indexOf(r.tier)]:'·').join(' ')}`)}>Copy Results</button></div></main>; }

if(screen==='journal') return <main className="screen paper journal"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Personal records, stored on this device</small><h1>My Digging Journal</h1></div></header><div className="stats"><div><strong>{stats.best}</strong><span>Best score</span></div><div><strong>{stats.deepest.toLocaleString()}m</strong><span>Deepest dig</span></div><div><strong>{save.expeditions.length}</strong><span>Expeditions</span></div><div><strong>{stats.rare}</strong><span>Rare finds</span></div><div><strong>{stats.lifetime.toLocaleString()}m</strong><span>Lifetime depth</span></div><div><strong>{stats.correct.toLocaleString()}</strong><span>Correct answers</span></div></div><section className="discovery-collection"><h2>Underground discoveries</h2><div>{BIOMES.map(item=>{const found=save.lifetimeStats.discoveredBiomes.includes(item.id);return <article key={item.id} className={found?'found':'locked'}><i/><strong>{found?item.name:'???'}</strong><small>{found?`${item.start.toLocaleString()}m`:'Keep digging'}</small></article>;})}</div></section><h2>Recent mine shafts</h2><div className="expeditions">{save.expeditions.length===0?<p>Your first adventure will appear here.</p>:save.expeditions.map(e=><article key={e.id} className={`shaft zone-${zoneForDepth(e.depth)}`}><button onClick={()=>setJournalOpen(journalOpen===e.id?null:e.id)}><PixelCat id={e.cat} cosmetic={save.equipped}/><span><strong>{rankFor(e.score)}</strong><small>{new Date(e.date).toLocaleDateString()} · {e.depth.toLocaleString()}m · {e.scoringVersion??'legacy scoring'}</small><i className="journal-gems">{e.rounds.map((r,i)=><b key={i} className={r.tier?`tier-${r.tier.toLowerCase()}`:'empty'} aria-label={r.tier||'No find'}/>)}</i></span><b>{e.score} pts</b></button>{journalOpen===e.id&&<div className="expedition-detail">{e.rounds.map((r,i)=><div key={i} className={r.tier?`tier-${r.tier.toLowerCase()}`:''}><i/><span><b>{i+1}. {r.prompt}</b><small>{r.answer||'No answer'}{r.tier?` · ${r.tier}`:''}</small><button className="text-button" onClick={()=>setAnswerExploreId(r.questionId)}>See verified answers</button></span><strong>+{r.points}<small>{depthForPoints(r.points)}m</small></strong></div>)}</div>}</article>)}</div>{answerExploreId&&<AnswerExplorer questionId={answerExploreId} onClose={()=>setAnswerExploreId(null)}/>}<section className="answer-reports"><h2>Answer review list</h2><p>These reports stay on this device unless you explicitly export one or open a public GitHub issue draft.</p>{save.missingAnswers.length===0?<p>No saved answer reports.</p>:save.missingAnswers.map((report,index)=><article key={report.id??`${report.questionId}-${index}`}><span><strong>{report.answer}</strong><small>{report.prompt??report.questionId} · {report.datasetVersion??'older save'}</small></span><button onClick={()=>setReportPreview(report)}>Preview issue</button></article>)}{save.missingAnswers.length>0&&<button onClick={exportReports}>Export answer reports</button>}</section>{reportPreview&&<section className="report-preview" role="dialog" aria-modal="true" aria-label="Preview public answer report"><h2>Preview public report</h2><p><strong>Warning:</strong> GitHub issues are public. This draft contains only the prompt, proposed answer, dataset version, and your optional explanation.</p><pre>{JSON.stringify({questionId:reportPreview.questionId,prompt:reportPreview.prompt,answer:reportPreview.answer,datasetVersion:reportPreview.datasetVersion,explanation:reportPreview.explanation},null,2)}</pre><div><button onClick={()=>setReportPreview(null)}>Keep local</button><button className="primary" onClick={()=>{openIssue(reportPreview);setReportPreview(null);}}>Open GitHub draft</button></div></section>}<div className="data-actions"><button onClick={exportSave}>Export save</button><button onClick={()=>fileInput.current?.click()}>Import save</button><button className="danger" onClick={reset}>Reset progress</button><input ref={fileInput} hidden type="file" accept="application/json" onChange={importSave}/></div><p className="feedback">{notice}</p></main>;

  if(screen==='archive') {const days=Array.from({length:30},(_,offset)=>{const date=new Date();date.setUTCHours(0,0,0,0);date.setUTCDate(date.getUTCDate()-offset);return utcDateKey(date);});return <main className="screen paper archive"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Stable daily schedules · UTC</small><h1>Daily Dig Archive</h1></div></header><p>Completed scores are permanent. Practice attempts never replace the original result.</p><div className="archive-list">{days.map(date=>{const record=save.dailyRecords.find(item=>item.date===date),available=!record||record.scheduleVersion===DAILY_SCHEDULE_VERSION;return <article key={date} className={record?'complete':''}><time>{new Date(date+'T00:00:00Z').toLocaleDateString(undefined,{dateStyle:'medium',timeZone:'UTC'})}</time>{record?<><PixelCat id={record.cat} cosmetic={save.equipped}/><span><strong>{record.score} pts · {record.depth.toLocaleString()} m</strong><small>{cats.find(item=>item.id===record.cat)?.name} · completed {new Date(record.completedAt).toLocaleDateString()}</small></span></>:<span><strong>Not completed</strong><small>Seven reproducible questions</small></span>}<button disabled={!available} onClick={()=>begin('practice',date)}>{available?'Practise':'Bank unavailable'}</button></article>;})}</div><p className="feedback">{notice}</p></main>;}

  if(screen==='shop') return <main className="screen paper shop"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Purely cosmetic · no advantages</small><h1>The Treasure Burrow</h1></div></header><div className="crystal-balance">◇ {save.crystals} crystals</div><div className="shopkeeper"><PixelCat id="marmalade" cosmetic={save.equipped}/><blockquote>“No loot boxes here. I nap on those.”</blockquote></div><div className="cosmetic-grid">{cosmetics.map(item=>{const owned=save.unlocked.includes(item.id),equipped=save.equipped===item.id;return <button key={item.id} className={equipped?'equipped':''} onClick={()=>buyCosmetic(item.id,item.price)}><i>{item.icon}</i><strong>{item.name}</strong><span>{equipped?'Equipped':owned?'Owned · tap to equip':`◇ ${item.price}`}</span></button>;})}</div><p className="feedback" aria-live="polite">{notice}</p></main>;

  return <main className="screen paper help"><header><button className="back" onClick={()=>setScreen(save.active?'game':'ready')}>← Back</button><div><small>Field guide</small><h1>How to Saffilion</h1></div></header><section><h2>Rarer answers dig much deeper</h2><p>Every accepted answer has a question-specific rarity based on cached familiarity evidence, answer-set context, and a small audited override list. Missing evidence is treated neutrally—not as proof that an answer is rare. Stardust is worth 100 points versus Pebble’s 10, and every point digs 10 metres.</p><div className="tiers">{tierOrder.map((t,i)=><div key={t}><i className={`gem g${i}`}/><strong>{t}</strong><span>{TIERS[t]} pts</span></div>)}</div><h2>Spelling help, after submission</h2><p>Saffilion never reveals answers while you type. After an incorrect submission, a close spelling suggestion may appear. Safe plurals and curated aliases are accepted. You still choose and submit corrections yourself.</p><h2>Comfort settings</h2><label className="toggle"><input type="checkbox" checked={save.settings.reducedMotion} onChange={e=>updateSettings({reducedMotion:e.target.checked})}/> Reduce motion</label><label className="toggle"><input type="checkbox" checked={save.settings.batterySaver} onChange={e=>updateSettings({batterySaver:e.target.checked})}/> Battery-conscious animation</label><label className="toggle"><input type="checkbox" checked={save.settings.sound} onChange={e=>updateSettings({sound:e.target.checked})}/> Gentle sounds</label><label className="toggle"><input type="checkbox" checked={save.settings.haptics} onChange={e=>updateSettings({haptics:e.target.checked})}/> Gentle vibration where supported</label><h2>Offline play</h2><p>After the first successful load, the installed game keeps its questions and logic on your device. iPhone installation uses Safari’s Share → Add to Home Screen; supported Android browsers can offer Install app.</p></section></main>;
}

export default App;
