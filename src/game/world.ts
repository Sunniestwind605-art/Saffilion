export const PIXELS_PER_METRE = 0.36;
export const FINAL_DEPTH = 7000;

export interface Biome {
  id: string;
  name: string;
  start: number;
  end: number;
  sky: string;
  rock: string;
  rockDark: string;
  tunnel: string;
  accent: string;
  glow: string;
}

export const BIOMES: Biome[] = [
  { id:'roots', name:'Surface Roots', start:0, end:150, sky:'#5a3a7c', rock:'#8a5a45', rockDark:'#5e2f33', tunnel:'#2a1d33', accent:'#a8e070', glow:'#ffe27a' },
  { id:'wormwood', name:'Wormwood Burrow', start:150, end:300, sky:'#4b3a78', rock:'#7a3f3a', rockDark:'#4a2a3a', tunnel:'#241a2e', accent:'#98c46a', glow:'#ffd56a' },
  { id:'mine', name:'Forgotten Mine', start:300, end:650, sky:'#3d2d5a', rock:'#665064', rockDark:'#2a1d33', tunnel:'#16111f', accent:'#d8a060', glow:'#ffe69a' },
  { id:'copper', name:'Copper Caverns', start:650, end:1200, sky:'#5a3347', rock:'#8d4f42', rockDark:'#4a2a2a', tunnel:'#271923', accent:'#e08a4f', glow:'#ffc477' },
  { id:'fossil', name:'Fossil Chambers', start:1200, end:2000, sky:'#6b5264', rock:'#8a6b58', rockDark:'#4e3a42', tunnel:'#29202b', accent:'#e3c394', glow:'#fff3d6' },
  { id:'sapphire', name:'Sapphire Grotto', start:2000, end:2800, sky:'#2b3556', rock:'#3d4e72', rockDark:'#1f2742', tunnel:'#151a2f', accent:'#5fd0c8', glow:'#c4fbf4' },
  { id:'mushroom', name:'Mushroom Hollow', start:2800, end:3800, sky:'#4a2e63', rock:'#5a3a7c', rockDark:'#2a1d45', tunnel:'#1b1426', accent:'#ef8fa8', glow:'#d8ef92' },
  { id:'amethyst', name:'Amethyst Kingdom', start:3800, end:4900, sky:'#3b2a63', rock:'#4b3a78', rockDark:'#2a1d45', tunnel:'#1b1426', accent:'#a366d6', glow:'#d6a8ff' },
  { id:'golden', name:'Golden Sanctuary', start:4900, end:6200, sky:'#5e4435', rock:'#7a5b42', rockDark:'#3a2b2e', tunnel:'#211824', accent:'#f6c453', glow:'#ffe69a' },
  { id:'stardust', name:'Stardust Abyss', start:6200, end:7001, sky:'#1f1b4a', rock:'#2f2a6a', rockDark:'#161338', tunnel:'#100c21', accent:'#ef8fa8', glow:'#fff2a6' },
];

export const worldYForDepth = (metres: number) => Math.max(0, Math.min(FINAL_DEPTH, metres)) * PIXELS_PER_METRE;
export const depthForWorldY = (worldY: number) => Math.max(0, Math.min(FINAL_DEPTH, worldY / PIXELS_PER_METRE));
export const biomeIndexForDepth = (depth: number) => Math.max(0, BIOMES.findIndex(item => depth >= item.start && depth < item.end));
export const biomeForDepth = (depth: number) => BIOMES[biomeIndexForDepth(depth)] ?? BIOMES.at(-1)!;
export const biomesThroughDepth = (depth: number) => BIOMES.filter(item => item.start <= depth).map(item => item.id);

const hash = (text: string) => {
  let value = 2166136261;
  for (let index=0; index<text.length; index++) { value ^= text.charCodeAt(index); value = Math.imul(value, 16777619); }
  return value >>> 0;
};
const random = (seed: string, n: number) => {
  let value = hash(`${seed}:${n}`);
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  return (value >>> 0) / 4294967296;
};
const mix = (a: number,b: number,t: number)=>Math.round(a+(b-a)*t);
const mixColor=(a:string,b:string,t:number)=>{
  const left=a.match(/\w\w/g)!.map(v=>parseInt(v,16)),right=b.match(/\w\w/g)!.map(v=>parseInt(v,16));
  return `rgb(${mix(left[0],right[0],t)},${mix(left[1],right[1],t)},${mix(left[2],right[2],t)})`;
};
const blendBiome=(depth:number)=>{
  const index=biomeIndexForDepth(depth),current=BIOMES[index],prior=BIOMES[index-1];
  if(!prior||depth-current.start>=70)return current;
  const t=Math.max(0,(depth-current.start)/70);
  return {...current,sky:mixColor(prior.sky,current.sky,t),rock:mixColor(prior.rock,current.rock,t),rockDark:mixColor(prior.rockDark,current.rockDark,t),tunnel:mixColor(prior.tunnel,current.tunnel,t)};
};

const px=(ctx:CanvasRenderingContext2D,color:string,x:number,y:number,w=4,h=4)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
const crystal=(ctx:CanvasRenderingContext2D,x:number,y:number,color:string,scale=1)=>{
  px(ctx,'#17111f',x-3*scale,y+4*scale,19*scale,7*scale);px(ctx,'#17111f',x-1*scale,y-2*scale,9*scale,18*scale);px(ctx,'#17111f',x+6*scale,y+2*scale,9*scale,14*scale);px(ctx,color,x+1*scale,y,6*scale,14*scale);px(ctx,color,x+8*scale,y+4*scale,5*scale,10*scale);px(ctx,'#ffffffaa',x+2*scale,y+2*scale,2*scale,7*scale);
};
const mushroom=(ctx:CanvasRenderingContext2D,x:number,y:number,cap:string,scale=1)=>{
  px(ctx,'#2d2534',x+5*scale,y+8*scale,6*scale,15*scale);px(ctx,'#f3d3b0',x+7*scale,y+9*scale,3*scale,12*scale);px(ctx,'#2d2534',x,y+3*scale,18*scale,8*scale);px(ctx,cap,x+2*scale,y+1*scale,14*scale,7*scale);px(ctx,'#fff1bd',x+5*scale,y+3*scale,3*scale,3*scale);
};
const sign=(ctx:CanvasRenderingContext2D,x:number,y:number,text:string)=>{
  px(ctx,'#352a34',x+22,y+19,5,25);px(ctx,'#3b2b32',x,y,58,23);px(ctx,'#d6a36a',x+3,y+3,52,17);ctx.fillStyle='#46323a';ctx.font='bold 6px monospace';ctx.textAlign='center';ctx.fillText(text.toUpperCase(),x+29,y+14);ctx.textAlign='left';
};

function drawLandmark(ctx:CanvasRenderingContext2D, biome:Biome, x:number, y:number, seed:string, variant:number, w:number) {
  const s=variant%4;
  if(biome.id==='roots'){
    if(s===0){px(ctx,'#5d3d36',x,y,8,52);px(ctx,'#8b6444',x+3,y,3,52);for(let i=0;i<4;i++)px(ctx,'#659650',x-8+i*8,y+i*10,12,4);}
    else if(s===1){px(ctx,'#dcb672',x,y+26,5,16);px(ctx,'#e68ca4',x-7,y+18,19,8);px(ctx,'#fff2a4',x,y+20,5,5);}
    else if(s===2){px(ctx,'#8b5a43',x,y+18,34,7);px(ctx,'#d98965',x+5,y+16,4,4);px(ctx,'#d98965',x+18,y+20,4,4);}
    else sign(ctx,x,y,"KEEP DIGGING!");
  } else if(biome.id==='wormwood'){
    if(s===0){for(let i=0;i<5;i++){px(ctx,'#3b2b33',x+i*7,y+i*7,10,7);px(ctx,'#8e7046',x+2+i*7,y+2+i*7,8,3);}}
    else if(s===1){px(ctx,'#2c2530',x,y+18,44,20);px(ctx,'#8a6c55',x+5,y+8,30,25);px(ctx,'#241d29',x+11,y+18,5,4);px(ctx,'#241d29',x+26,y+18,5,4);px(ctx,'#e8b18a',x+19,y+24,5,3);}
    else if(s===2){sign(ctx,x,y,"LITTLE STEPS COUNT");}
    else {px(ctx,'#382a32',x,y+20,45,6);px(ctx,'#a77a4d',x+3,y+22,39,3);px(ctx,'#f2d879',x+30,y+12,5,8);}
  } else if(biome.id==='mine'){
    if(s===0){px(ctx,'#2d2830',x,y,10,74);px(ctx,'#a36d45',x+2,y,6,74);px(ctx,'#2d2830',x-20,y,50,9);px(ctx,'#a36d45',x-17,y+2,44,5);}
    else if(s===1){px(ctx,'#282631',x,y+26,54,7);px(ctx,'#b17448',x+5,y+9,39,19);px(ctx,'#684637',x+9,y+13,31,11);px(ctx,'#292631',x+8,y+29,10,10);px(ctx,'#292631',x+37,y+29,10,10);}
    else if(s===2){px(ctx,'#4d342f',x,y+9,7,42);px(ctx,'#ffd36d',x-6,y,19,18);px(ctx,'#fff4b1',x-2,y+3,11,10);}
    else sign(ctx,x,y,"YOU'VE GOT THIS!");
  } else if(biome.id==='copper'){
    if(s===0){for(let i=0;i<6;i++){px(ctx,'#4a2f31',x+i*6,y+i*7,11,6);px(ctx,'#e17a45',x+2+i*6,y+1+i*7,7,3);}}
    else if(s===1)crystal(ctx,x,y,biome.accent,2);
    else if(s===2){px(ctx,'#35282d',x,y,52,42);px(ctx,'#b45b3f',x+5,y+8,42,6);px(ctx,'#e99b55',x+12,y+21,29,7);}
    else sign(ctx,x,y,"EVERY GEM STARTS SOMEWHERE");
  } else if(biome.id==='fossil'){
    if(s===0){px(ctx,'#3d3433',x,y+30,60,8);px(ctx,'#e1c18d',x+8,y+12,10,28);px(ctx,'#e1c18d',x+26,y+4,11,36);px(ctx,'#e1c18d',x+44,y+14,9,26);px(ctx,'#8d755d',x+11,y+17,5,5);}
    else if(s===1){for(let i=0;i<12;i++){const a=i*.7;px(ctx,'#e8d09d',x+28+Math.cos(a)*i*2,y+25+Math.sin(a)*i*2,5,5);}}
    else if(s===2){px(ctx,'#392f31',x,y,52,44);px(ctx,'#c6a676',x+5,y+6,42,30);px(ctx,'#f1d7a0',x+14,y+11,8,18);px(ctx,'#f1d7a0',x+29,y+9,8,22);}
    else {px(ctx,'#342d30',x,y+22,46,5);px(ctx,'#e8cc94',x+7,y+9,30,18);px(ctx,'#8b7158',x+11,y+13,22,10);}
  } else if(biome.id==='sapphire'){
    if(s===0){crystal(ctx,x,y,'#57c6ef',2);crystal(ctx,x+37,y+19,'#8eeaff',1);}
    else if(s===1){px(ctx,'#bdf8f3',x,y,10,54);px(ctx,'#5ba9cf',x+2,y,6,54);px(ctx,'#20364a',x-11,y+50,34,8);}
    else if(s===2){px(ctx,'#162c3e',x,y+29,62,12);px(ctx,'#4aa7cc',x+4,y+30,54,7);px(ctx,'#aaf2ec',x+14,y+31,18,2);}
    else sign(ctx,x,y,"LOOK HOW FAR YOU'VE COME!");
  } else if(biome.id==='mushroom'){
    if(s===0){mushroom(ctx,x,y,'#ef87c2',2);mushroom(ctx,x+39,y+23,'#7bd9a2',1);}
    else if(s===1){px(ctx,'#30263a',x,y+19,54,39);px(ctx,'#d77bb8',x+4,y+10,46,19);px(ctx,'#f4d28b',x+22,y+34,12,24);px(ctx,'#fff3a0',x+9,y+35,8,8);}
    else if(s===2){for(let i=0;i<10;i++)px(ctx,i%2?'#a4edbb':'#f1a7d8',x+(i*17)%55,y+(i*23)%45,3,3);}
    else {px(ctx,'#302838',x,y+27,62,6);mushroom(ctx,x+20,y,'#f0a1ce',1);}
  } else if(biome.id==='amethyst'){
    if(s===0){crystal(ctx,x,y,'#b96fe6',3);crystal(ctx,x+52,y+25,'#e0a4ff',2);}
    else if(s===1){px(ctx,'#271e33',x,y,64,54);px(ctx,'#754798',x+6,y+6,52,42);px(ctx,'#ddb0f4',x+18,y+13,28,27);px(ctx,'#fff1c8',x+27,y+20,10,13);}
    else if(s===2){for(let i=0;i<7;i++)crystal(ctx,x+i*10,y+(i%2)*14,i%2?'#9556c8':'#c47aea',1);}
    else sign(ctx,x,y,"A LITTLE DEEPER, A LITTLE BRIGHTER");
  } else if(biome.id==='golden'){
    if(s===0){px(ctx,'#332c30',x,y,18,68);px(ctx,'#d5a747',x+3,y+4,12,60);px(ctx,'#ffe47b',x+6,y+7,4,54);px(ctx,'#332c30',x-8,y,34,8);}
    else if(s===1){px(ctx,'#342c2f',x,y+33,65,8);for(let i=0;i<9;i++)px(ctx,i%2?'#f7d45e':'#b78332',x+5+(i*13)%54,y+16+(i%3)*7,7,7);}
    else if(s===2){px(ctx,'#342c30',x,y,62,53);px(ctx,'#b7883c',x+5,y+5,52,43);px(ctx,'#f2c95a',x+12,y+12,38,29);px(ctx,'#6b4a32',x+26,y+20,10,18);}
    else sign(ctx,x,y,"BRIGHT THINGS WAIT BELOW");
  } else {
    if(s===0){for(let i=0;i<7;i++){const yy=y+(i%3)*18,xx=x+i*12;px(ctx,'#fff1a2',xx,yy+4,11,3);px(ctx,'#fff1a2',xx+4,yy,3,11);}}
    else if(s===1){crystal(ctx,x,y,'#efacd9',2);crystal(ctx,x+37,y+17,'#9bdff1',2);}
    else if(s===2){px(ctx,'#17182b',x,y,68,52);px(ctx,'#6b4c70',x+5,y+5,58,42);px(ctx,'#f1c86a',x+10,y+19,48,27);px(ctx,'#fff1a3',x+15,y+23,38,18);}
    else {px(ctx,'#f5e79d',x,y+16,55,5);px(ctx,'#efaddc',x+24,y,7,39);}
  }
  void seed;void w;
}

export interface WorldRenderOptions { width:number; height:number; cameraY:number; animatedDepth:number; seed:string; time:number; digging:boolean; lowPower:boolean; }

export function drawMineWorld(ctx:CanvasRenderingContext2D, options:WorldRenderOptions) {
  const {width:w,height:h,cameraY,animatedDepth,seed,time,digging,lowPower}=options;
  const biome=blendBiome(animatedDepth),biomeIndex=biomeIndexForDepth(animatedDepth);
  ctx.clearRect(0,0,w,h);px(ctx,biome.rock,0,0,w,h);

  // Broad, stepped colour bands echo the title artwork and keep every biome unmistakable.
  px(ctx,biome.sky,0,0,w,h);
  const bandHeight=44,firstBand=Math.floor((cameraY*.2)/bandHeight)-2;
  for(let row=0;row<Math.ceil(h/bandHeight)+5;row++){
    const chunk=firstBand+row,y=chunk*bandHeight-cameraY*.2+h*.58;
    const bandColor=chunk%3===0?mixColor(biome.rock,biome.accent,.16):chunk%3===1?biome.rock:mixColor(biome.rock,biome.rockDark,.22);
    px(ctx,bandColor,0,y,w,bandHeight+1);
    px(ctx,chunk%2===0?biome.rockDark:mixColor(biome.accent,biome.rock,.45),0,y,w,4);
  }
  // Distant formations move slowly, providing parallax behind the excavated shaft.
  for(let i=0;i<9;i++){
    const x=(i*97+random(seed,i)*55)%Math.max(1,w), y=((i*83-cameraY*.18)%(h+120)+h+120)%(h+120)-60;
    px(ctx,'#17111f',x-32,y-2,59,84);px(ctx,biome.rockDark,x-29,y,55,80);px(ctx,mixColor(biome.rock,biome.accent,.12),x-22,y+8,40,64);
  }

  const shaftWidth=Math.min(w*.7,Math.max(150,w*.48)),centre=w/2,left=centre-shaftWidth/2,right=centre+shaftWidth/2;
  const edgeStep=28,firstChunk=Math.floor(cameraY/edgeStep)-2;
  // Main terrain and jagged cut walls use absolute chunks, so refreshes reproduce the same shaft.
  px(ctx,biome.tunnel,left,0,shaftWidth,h);
  for(let row=0;row<Math.ceil(h/edgeStep)+5;row++){
    const chunk=firstChunk+row, world=chunk*edgeStep, y=world-cameraY+h*.58;
    const jagLeft=(random(seed,chunk*3)-.5)*18,jagRight=(random(seed,chunk*3+1)-.5)*18;
    const layer=chunk%4===0?mixColor(biome.rock,biome.accent,.18):biome.rock;
    px(ctx,layer,0,y,left+jagLeft,edgeStep+2);px(ctx,layer,right+jagRight,y,w-right-jagRight,edgeStep+2);
    px(ctx,biome.rockDark,left+jagLeft-5,y,7,edgeStep+2);px(ctx,biome.rockDark,right+jagRight,y,7,edgeStep+2);
    if(chunk%4===0){px(ctx,biome.accent,0,y,left+jagLeft-6,3);px(ctx,biome.accent,right+jagRight+7,y,w-right-jagRight-7,3);}
    for(let side=0;side<2;side++){
      const start=side?right+12:left-42,rx=start+random(seed,chunk*7+side)*28;
      px(ctx,random(seed,chunk*11+side)>.72?biome.accent:biome.rockDark,rx,y+8+random(seed,chunk*13+side)*12,5+random(seed,chunk)*8,4);
    }
    if(random(seed,chunk*29)>.82){
      const gemX=random(seed,chunk*31)>.5?left-30:right+13;
      crystal(ctx,gemX,y+7,random(seed,chunk*37)>.58?biome.glow:biome.accent,random(seed,chunk*41)>.72?1.25:.75);
    }
  }

  // Curated landmarks are anchored in absolute world chunks and do not visibly repeat every screen.
  const landmarkGap=180,firstLandmark=Math.floor((cameraY-h*.7)/landmarkGap)-1;
  for(let i=0;i<7;i++){
    const chunk=firstLandmark+i,world=chunk*landmarkGap+70,y=world-cameraY+h*.58;
    if(y<-90||y>h+40)continue;
    const depth=depthForWorldY(Math.max(0,world)),landmarkBiome=biomeForDepth(depth);
    const available=Math.max(65,shaftWidth-84),x=left+24+random(seed,chunk*17)*available;
    drawLandmark(ctx,landmarkBiome,x,y,seed,chunk,w);
  }

  // Undisturbed terrain waits just below the cat; digging cuts pixels from its edge.
  const floorY=h-24;
  px(ctx,biome.rockDark,left-3,floorY,shaftWidth+6,h-floorY);px(ctx,biome.rock,left,floorY+6,shaftWidth,h-floorY);
  for(let x=left;x<right;x+=12){const crumble=random(seed,Math.floor(cameraY)+x);px(ctx,crumble>.55?biome.accent:biome.rockDark,x,floorY+(crumble>.75?0:5),7,4);}
  if(digging){for(let i=0;i<(lowPower?5:12);i++){const phase=((time*.12+i*31)%90),x=centre+(random(seed,i+Math.floor(cameraY))*2-1)*55,y=floorY-phase*.55;px(ctx,i%3===0?biome.glow:biome.accent,x,y,4+(i%2)*2,4);}}

  // Ambient particles and foreground fragments.
  const particleCount=lowPower?5:12;
  for(let i=0;i<particleCount;i++){
    const x=left+10+random(seed,i+biomeIndex*31)*(shaftWidth-20),y=((i*71+time*.012*(i%2?1:-1)-cameraY*.08)%(h+30)+h+30)%(h+30)-15;
    px(ctx,i%3===0?biome.glow:biome.accent,x,y,i%4===0?4:2,i%4===0?4:2);
  }
  if(animatedDepth>=FINAL_DEPTH-1){px(ctx,'#fff4ae',centre-47,22,94,6);px(ctx,'#e8a6d8',centre-4,5,8,40);ctx.fillStyle='#fff4ae';ctx.font='bold 8px monospace';ctx.textAlign='center';ctx.fillText('FINAL TREASURE',centre,56);ctx.textAlign='left';}
}

