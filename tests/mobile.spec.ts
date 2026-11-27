import { expect, test } from '@playwright/test';

test('new player can select a cat and begin an expedition by touch', async ({ page }) => {
  await page.goto('.');
  await expect(page.getByText('Made with love for Safia')).toBeVisible();
  await page.getByRole('button', { name: 'Let’s Dig!' }).click();
  await expect(page.getByRole('button', { name: /Mochi/ })).toBeVisible();
  await page.locator('.cat-card').nth(1).click();
  await page.getByRole('button', { name: /Adventure with Mochi/ }).click();
  await page.getByRole('button', { name: 'Start Digging' }).click();
  await expect(page.getByText('Question 1 / 7')).toBeVisible();
  await expect(page.getByRole('img', { name: /Mochi/ })).toBeVisible();
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
  await expect(page.getByText('+100 m')).toBeVisible();
  await expect(caveCanvas).toHaveAttribute('data-had-intermediate', 'true');
  await expect(page.locator('.mine-hud strong')).toHaveText('100 m', { timeout: 1600 });
  const movingCamera = Number(await caveCanvas.getAttribute('data-camera'));
  expect(movingCamera).toBeGreaterThan(startCamera);
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

test('production PWA reopens offline after its cache is ready', async ({ page, context }) => {
  await page.goto('.');
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.ready).active));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Made with love for Safia')).toBeVisible();
  await context.setOffline(false);
});
