import { expect, test } from '@playwright/test';

test('new player can select a cat and begin an expedition by touch', async ({ page }) => {
  await page.goto('.');
  await expect(page.getByText('Made with love for Safia')).toBeVisible();
  await page.getByRole('button', { name: 'Let’s Dig!' }).click();
  await expect(page.getByRole('button', { name: /Kairo/ })).toBeVisible();
  await page.locator('.cat-card').nth(1).click();
  await page.getByRole('button', { name: /Adventure with Kairo/ }).click();
  await page.getByRole('button', { name: 'Start Digging' }).click();
  await expect(page.getByText('Question 1 / 7')).toBeVisible();
  await expect(page.getByRole('img', { name: /Kairo/ })).toBeVisible();
  await expect(page.getByLabel('Your answer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dig!' })).toBeVisible();
});

test('characters use true low-resolution pixel sprites', async ({ page }) => {
  await page.goto('.');
  const sprite = page.locator('.pixel-cat canvas').first();
  await expect(sprite).toBeVisible();
  await expect(sprite).toHaveAttribute('width', '48');
  await expect(sprite).toHaveAttribute('height', '48');
  const rendering = await sprite.evaluate(element => getComputedStyle(element).imageRendering);
  expect(rendering).toMatch(/pixelated|crisp-edges/);
});

test('submitted typo offers correction but does not auto-score', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'pebble', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], settings:{sound:false,reducedMotion:true,batterySaver:true},
    active:{questionIds:['science-01','geo-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
  })));
  await page.goto('.');
  await page.getByLabel('Your answer').fill('Jupitr');
  await page.getByRole('button', { name: 'Dig!' }).click();
  await expect(page.getByRole('button', { name: 'Use “Jupiter”' })).toBeVisible();
  await expect(page.getByText('0 pts')).toBeVisible();
  await page.getByRole('button', { name: 'Use “Jupiter”' }).click();
  await expect(page.getByLabel('Your answer')).toHaveValue('Jupiter');
  await expect(page.getByText('0 pts')).toBeVisible();
});

test('a correct answer visibly travels through depth instead of jumping', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'pebble', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], settings:{sound:false,reducedMotion:false,batterySaver:false},
    active:{questionIds:['science-01','geo-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
  })));
  await page.goto('.');
  const caveCanvas = page.locator('.mine-scene > canvas');
  const startCamera = Number(await caveCanvas.getAttribute('data-camera'));
  await page.getByLabel('Your answer').fill('Jupiter');
  await page.getByRole('button', { name: 'Dig!' }).click();
  await expect(page.locator('.mine-scene')).toHaveClass(/traveling/);
  await expect(page.locator('.depth-gain')).toHaveText('+50 m');
  await expect(page.locator('.mine-hud strong')).toHaveText('50 m', { timeout: 1600 });
  const movingCamera = Number(await caveCanvas.getAttribute('data-camera'));
  expect(movingCamera).toBeGreaterThan(startCamera);
});

test('a rare answer reveals its full rarity, score, and depth weight', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'pebble', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], settings:{sound:false,reducedMotion:false,batterySaver:false},
    active:{questionIds:['geo-01','geo-02','geo-03','geo-04','geo-05','geo-06','geo-07'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
  })));
  await page.goto('.');
  await page.getByLabel('Your answer').fill('Comoros');
  await page.getByRole('button', { name: 'Dig!' }).click();
  await expect(page.getByRole('img', { name: /Safia/ })).toHaveClass(/happy/, { timeout: 1000 });
  const reveal = page.locator('.rarity-reveal');
  await expect(reveal).toContainText('Stardust');
  await expect(reveal).toContainText('100 points');
  await expect(reveal).toContainText('+1,000 m');
  await expect(page.locator('.mine-scene')).toHaveClass(/traveling/);
  await expect(page.locator('.mine-scene')).toHaveClass(/powerful-dig/);
  await expect(page.locator('.depth-gain')).toHaveText('+1,000 m');
});

test('all seven rounds finish, save, show gems, and Dig Again skips menus', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'mochi', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], equipped:null, settings:{sound:false,haptics:false,reducedMotion:true,batterySaver:true},
    active:{questionIds:['science-01','geo-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
  })));
  await page.goto('.');
  for (const [index, answer] of ['Jupiter','South Africa','Brazil','Brazil','London','Japan','Spain'].entries()) {
    await page.getByLabel('Your answer').fill(answer);
    await page.getByRole('button', { name: 'Dig!' }).click();
    if (index < 6) await expect(page.getByText(`Question ${index+2} / 7`)).toBeVisible();
  }
  await expect(page.getByText('Expedition complete')).toBeVisible();
  await expect(page.getByText(/Kairo reached/)).toBeVisible();
  await expect(page.locator('.round-summary > div')).toHaveCount(7);
  await expect(page.locator('.rarity-distribution')).toBeVisible();
  await page.getByRole('button', { name: 'Dig Again!' }).click();
  await expect(page.getByText('Question 1 / 7')).toBeVisible();
  const replayInput=page.getByLabel('Your answer');
  await expect(replayInput).toBeEnabled();
  await replayInput.focus();
  await expect(replayInput).toBeFocused();
  await replayInput.fill('Jupiter');
  await expect(replayInput).toHaveValue('Jupiter');
});

test('timeout advances accurately with zero points', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'nova', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], settings:{sound:false,haptics:false,reducedMotion:true,batterySaver:true},
    active:{questionIds:['science-01','geo-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+250,category:'All'}
  })));
  await page.goto('.');
  await expect(page.getByText('Question 2 / 7')).toBeVisible({ timeout: 3000 });
  await expect(page.getByText('0 pts')).toBeVisible();
});

test('Treasure Burrow sells and equips deterministic cosmetics', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'marmalade', expeditions:[], active:null, questionBag:[], recentQuestions:[], missingAnswers:[], crystals:40, unlocked:[], equipped:null, settings:{sound:false,haptics:false,reducedMotion:true,batterySaver:true}
  })));
  await page.goto('.');
  await page.getByRole('button', { name: 'Let’s Dig!' }).click();
  await page.getByRole('button', { name: /Adventure with Sharon/ }).click();
  await page.getByRole('button', { name: 'Burrow' }).click();
  await page.getByRole('button', { name: /Pink Shovel/ }).click();
  await expect(page.getByRole('button', { name: /Pink Shovel/ })).toContainText('Equipped');
  await expect(page.getByText('◇ 28 crystals')).toBeVisible();
});

for (const viewport of [{width:320,height:500},{width:844,height:390}]) {
  test(`game controls remain accessible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
      version:1, selectedCat:'pebble', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], settings:{sound:false,haptics:false,reducedMotion:true,batterySaver:true},
      active:{questionIds:['science-01','geo-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
    })));
    await page.goto('.');
    await page.getByLabel('Your answer').focus();
    await expect(page.getByRole('img', { name: /Safia/ })).toBeVisible();
    await expect(page.locator('.timer')).toBeVisible();
    await expect(page.getByLabel('Your answer')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dig!' })).toBeVisible();
    const metrics=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
  });
}

test('focused answer stays in a compact portrait layout above a mobile keyboard', async ({ page }) => {
  await page.setViewportSize({width:390,height:360});
  await page.addInitScript(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'pebble', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], settings:{sound:false,haptics:false,reducedMotion:true,batterySaver:true},
    active:{questionIds:['geo-01','science-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
  })));
  await page.goto('.');
  await page.getByLabel('Your answer').focus();
  await expect(page.locator('html')).toHaveClass(/keyboard-open/);
  const layout=await page.evaluate(()=>{
    const rect=(selector:string)=>{const value=document.querySelector(selector)!.getBoundingClientRect();return {top:value.top,bottom:value.bottom,left:value.left,right:value.right,width:value.width,height:value.height};};
    return {height:innerHeight,width:innerWidth,scene:rect('.mine-scene'),panel:rect('.question-panel'),prompt:rect('.prompt-row'),timer:rect('.timer'),input:rect('#answer'),submit:rect('.answer-row button'),cat:rect('.mine-scene .pixel-cat')};
  });
  expect(layout.scene.width).toBeGreaterThanOrEqual(layout.width-1);
  expect(layout.panel.left).toBeLessThanOrEqual(1);
  expect(layout.panel.top).toBeGreaterThanOrEqual(layout.scene.bottom-1);
  for (const item of [layout.prompt,layout.timer,layout.input,layout.submit,layout.cat]) {
    expect(item.top).toBeGreaterThanOrEqual(-1);
    expect(item.bottom).toBeLessThanOrEqual(layout.height+1);
  }
  expect(layout.prompt.bottom).toBeLessThanOrEqual(layout.input.top+1);
  expect(layout.input.height).toBeGreaterThanOrEqual(44);
  expect(layout.submit.height).toBeGreaterThanOrEqual(44);
});

for (const width of [320, 375, 390, 430, 768]) {
  test(`layout has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 740 : 1024 });
    await page.goto('.');
    const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.client);
    await expect(page.getByRole('button', { name: 'Let’s Dig!' })).toBeVisible();
  });
}

test('production PWA completes a seven-round expedition offline', async ({ page, context }) => {
  test.setTimeout(60000);
  await page.goto('.');
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active));
  await page.reload();
  await page.evaluate(() => localStorage.setItem('saffilion-save-v1', JSON.stringify({
    version:1, selectedCat:'pebble', expeditions:[], questionBag:[], recentQuestions:[], missingAnswers:[], crystals:0, unlocked:[], equipped:null, settings:{sound:false,haptics:false,reducedMotion:true,batterySaver:true},
    active:{questionIds:['science-01','geo-01','geo-02','geo-03','geo-04','geo-05','geo-06'],round:0,results:[],deadline:Date.now()+30000,category:'All'}
  })));
  await context.setOffline(true);
  await page.reload();
  for (const [index, answer] of ['Jupitr','South Africa','Brazil','Brazil','London','Japan','Spain'].entries()) {
    await page.getByLabel('Your answer').fill(answer);
    await page.getByRole('button', { name: 'Dig!' }).click();
    if(index===0){await page.getByRole('button',{name:'Use “Jupiter”'}).click();await page.getByRole('button',{name:'Dig!'}).click();}
    if(index<6)await expect(page.getByText(`Question ${index+2} / 7`)).toBeVisible();
  }
  await expect(page.getByText('Expedition complete')).toBeVisible();
  await expect(page.locator('.round-summary > div')).toHaveCount(7);
  await context.setOffline(false);
});
