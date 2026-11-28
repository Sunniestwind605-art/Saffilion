import { describe, expect, it } from 'vitest';
import { BIOMES, FINAL_DEPTH, PIXELS_PER_METRE, biomeForDepth, biomeIndexForDepth, biomesThroughDepth, depthForWorldY, worldYForDepth } from './world';

describe('Phase 5 underground world', () => {
  it('has ten contiguous, named biomes through the final treasure', () => {
    expect(BIOMES.map(item=>[item.id,item.start,item.end])).toEqual([
      ['roots',0,150],['wormwood',150,300],['mine',300,650],['copper',650,1200],['fossil',1200,2000],
      ['sapphire',2000,2800],['mushroom',2800,3800],['amethyst',3800,4900],['golden',4900,6200],['stardust',6200,7001],
    ]);
    for(let index=1;index<BIOMES.length;index++)expect(BIOMES[index].start).toBe(BIOMES[index-1].end);
    expect(biomeForDepth(FINAL_DEPTH).id).toBe('stardust');
  });

  it('switches exactly at every biome boundary', () => {
    for(let index=1;index<BIOMES.length;index++){
      const boundary=BIOMES[index].start;
      expect(biomeIndexForDepth(boundary-.01)).toBe(index-1);
      expect(biomeIndexForDepth(boundary)).toBe(index);
    }
  });

  it('uses a single reversible absolute world coordinate', () => {
    for(const depth of [0,149,150,649,650,1999,3800,6199,7000]){
      expect(worldYForDepth(depth)).toBeCloseTo(depth*PIXELS_PER_METRE,8);
      expect(depthForWorldY(worldYForDepth(depth))).toBeCloseTo(depth,8);
    }
    expect(worldYForDepth(8000)).toBe(worldYForDepth(FINAL_DEPTH));
  });

  it('reveals crossed biomes in their ordered world path', () => {
    expect(biomesThroughDepth(0)).toEqual(['roots']);
    expect(biomesThroughDepth(2050)).toEqual(['roots','wormwood','mine','copper','fossil','sapphire']);
    expect(biomesThroughDepth(FINAL_DEPTH)).toEqual(BIOMES.map(item=>item.id));
  });
});
