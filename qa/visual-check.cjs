const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const [width, name] of [[1280, 'desktop'], [390, 'mobile']]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto('http://127.0.0.1:4173/qa/preview.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true });
    if (await page.locator('#st-proactive-director').count() !== 1) throw new Error('Missing console root');
    if (await page.locator('button[role="tab"]').count() !== 7) throw new Error('Missing tabs');
    if (!await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)) throw new Error(`${name} overflows horizontally`);
    await page.getByRole('tab', { name: '偏好' }).click();
    if (await page.locator('input[type="range"]').count() !== 4) throw new Error('Preference controls missing');
    if (errors.length) throw new Error(errors.join('\n'));
    await page.close();
  }
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
