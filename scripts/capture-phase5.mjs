import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const base=process.argv[2]||'http://localhost:5173/Saffilion/';
const output=path.resolve(process.argv[3]||'phase5-screenshots');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});

const preview=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
await preview.goto(`${base}?worldPreview=1`,{waitUntil:'networkidle'});
await preview.screenshot({path:path.join(output,'phase5-world-overview.png'),fullPage:true});
const cards=preview.locator('.biome-grid article');
const slugs=['surface-roots','wormwood-burrow','forgotten-mine','copper-caverns','fossil-chambers','sapphire-grotto','mushroom-hollow','amethyst-kingdom','golden-sanctuary','stardust-abyss'];
for(let index=0;index<await cards.count();index++)await cards.nth(index).screenshot({path:path.join(output,`biome-${String(index+1).padStart(2,'0')}-${slugs[index]}.png`)});

await preview.locator('input[type="number"]').fill('7000');
await preview.locator('input[type="number"]').press('Enter');
await preview.waitForTimeout(3500);
await preview.locator('.preview-stage').screenshot({path:path.join(output,'phase5-final-treasure.png')});
const performance=await preview.evaluate(async()=>{
  const samples=[];let prior=performance.now();
  for(let index=0;index<180;index++)await new Promise(resolve=>requestAnimationFrame(now=>{samples.push(now-prior);prior=now;resolve();}));
  const sorted=[...samples].sort((a,b)=>a-b),pick=ratio=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*ratio))];
  return {frames:samples.length,medianMs:Number(pick(.5).toFixed(2)),p95Ms:Number(pick(.95).toFixed(2)),framesOver20ms:samples.filter(value=>value>20).length};
});

const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
await mobile.addInitScript(()=>localStorage.setItem('saffilion-save-v1',JSON.stringify({version:1,selectedCat:'nova',expeditions:[],questionBag:[],recentQuestions:[],missingAnswers:[],dailyRecords:[],crystals:0,unlocked:[],equipped:null,settings:{sound:false,haptics:false,reducedMotion:false,batterySaver:false},active:{questionIds:['geo-01','geo-02','geo-03','geo-04','geo-05','geo-06','geo-07'],round:5,results:Array.from({length:5},(_,index)=>({questionId:`past-${index}`,prompt:'Past find',answer:'Rare find',canonical:'Rare find',points:100,tier:'Stardust',timedOut:false})),deadline:Date.now()+30000,category:'All',mode:'unlimited',seed:'phase5-mobile'}})));
await mobile.goto(base,{waitUntil:'networkidle'});
await mobile.screenshot({path:path.join(output,'phase5-mobile-gameplay.png'),fullPage:true});

await browser.close();
console.log(JSON.stringify({output,performance},null,2));
