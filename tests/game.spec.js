const { test, expect } = require('@playwright/test');

test('start button is visible on screen, starts game and monsters spawn', async ({ page }) => {
  await page.goto('/');
  const start = page.getByRole('button', { name: /играть/i });
  await expect(start).toBeVisible();
  const visible = await start.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  });
  expect(visible).toBe(true);
  await start.click();
  await expect(start).toBeHidden();
  await expect.poll(() => page.evaluate(() => monsters.length), { timeout: 5000 }).toBeGreaterThan(0);
});

test('pointer shooting scores and saves best result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /играть/i }).click();
  await page.evaluate(() => { monsters = []; add(); monsters[0].x = 450; monsters[0].y = 250; });
  const box = await page.locator('#game').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#score')).toHaveText('10');
  await expect(page.locator('#best')).toHaveText('10');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('monsterBest'))).toBe('10');
});

test('missed monsters reduce lives and restart works', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /играть/i }).click();
  await page.evaluate(() => {
    monsters = Array.from({ length: 3 }, () => ({ x: 400, y: -100, r: 25, v: 75, color: '#f75ba9' }));
  });
  await expect(page.locator('#life')).toHaveText('0');
  await expect(page.getByRole('button', { name: /играть снова/i })).toBeVisible();
  await page.getByRole('button', { name: /играть снова/i }).click();
  await expect(page.locator('#life')).toHaveText('3');
  await expect(page.locator('#score')).toHaveText('0');
});

test('touch screen shooting works', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Only for mobile browser profiles');
  await page.goto('/');
  await page.getByRole('button', { name: /играть/i }).tap();
  await page.evaluate(() => { monsters = []; add(); monsters[0].x = 450; monsters[0].y = 250; });
  const box = await page.locator('#game').boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#score')).toHaveText('10');
});

test('page has no uncaught JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /играть/i }).click();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('all three sketched monster types are supported', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => sprites.length)).toBe(3);
  await page.getByRole('button', { name: /играть/i }).click();
  await page.evaluate(() => {
    monsters = [];
    for(let i=0;i<3;i++){add();monsters[i].kind=i;monsters[i].y=250;}
    draw();
  });
  expect(await page.evaluate(() => monsters.map(m => m.kind))).toEqual([0,1,2]);
});

test('chip music accelerates with game speed and mute works', async ({ page }) => {
  await page.goto('/');
  const initial=await page.evaluate(() => musicDelay());
  await page.getByRole('button', { name: /играть/i }).click();
  const later=await page.evaluate(() => { elapsed=35; return musicDelay(); });
  expect(later).toBeLessThan(initial);
  await page.getByRole('button', { name: /звук/i }).click();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(() => musicTimer)).toBeNull();
});

test('game canvas suppresses double-click zoom and touch action', async ({ page }) => {
  await page.goto('/');
  const c=page.locator('#game');
  expect(await c.evaluate(el => getComputedStyle(el).touchAction)).toBe('manipulation');
  expect(await c.evaluate(el => {
    const event=new MouseEvent('dblclick',{bubbles:true,cancelable:true});
    el.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(true);
});

test('game over plays tragic comic chiptune; restart cuts it off', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /играть/i }).click();
  await page.evaluate(() => { monsters = Array.from({length:3},()=>({x:450,y:-100,r:25,v:75,kind:0})); });
  await expect(page.locator('#life')).toHaveText('0');
  await expect.poll(() => page.evaluate(() => endingVoices.length)).toBeGreaterThan(10);
  await page.getByRole('button', { name: /играть снова/i }).click();
  expect(await page.evaluate(() => endingVoices.length)).toBe(0);
});

test('muting during game over stops the ending song', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /играть/i }).click();
  await page.evaluate(() => { monsters = Array.from({length:3},()=>({x:450,y:-100,r:25,v:75,kind:0})); });
  await expect(page.locator('#life')).toHaveText('0');
  await page.getByRole('button', { name: /звук/i }).click();
  expect(await page.evaluate(() => endingVoices.length)).toBe(0);
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed','false');
});

test('game-over punchline rises into a cheerful major chord', async ({ page }) => {
  await page.goto('/');
  const notes = await page.evaluate(() => gameOverNotes.map(([time,pitch]) => ({time,pitch})));
  const flourish = notes.filter(n => n.time >= 3.35 && n.time < 3.95).map(n => n.pitch);
  expect(flourish).toEqual([72,76,79]);
  const finalChord = notes.filter(n => n.time >= 3.95).map(n => n.pitch).sort((a,b) => a-b);
  expect(finalChord).toEqual([72,76,79,84]);
});
