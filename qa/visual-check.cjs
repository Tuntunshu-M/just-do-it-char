const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH });
  const baseUrl = process.env.QA_BASE_URL ?? 'http://127.0.0.1:4173';
  try {
    for (const [width, height, name] of [[1280, 800, 'desktop'], [420, 640, 'mobile']]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${baseUrl}/qa/preview.html`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(__dirname, `${name}.png`), fullPage: true });
    if (await page.locator('#st-proactive-director').count() !== 1) throw new Error('Missing console root');
    const tabs = page.locator('.stpd-tabs button[role="tab"]');
    if (await tabs.count() !== 6) throw new Error('Expected six main tabs');
    const tabTops = await tabs.evaluateAll((items) => [...new Set(items.map((item) => Math.round(item.getBoundingClientRect().top)))]);
    if (tabTops.length !== 1) throw new Error(`${name} tabs are not on one row: ${tabTops}`);
    if (!await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)) throw new Error(`${name} overflows horizontally`);
    await page.getByRole('tab', { name: '偏好', exact: true }).click();
    if (await page.locator('input[type="range"]').count() !== 4) throw new Error('Preference controls missing');
    await page.getByRole('button', { name: '打开设置' }).click();
    if (!await page.getByRole('tab', { name: '连接', exact: true }).getAttribute('aria-selected')) throw new Error('Connection settings did not open');
    await page.getByRole('tab', { name: '检查', exact: true }).click();
    await page.getByRole('button', { name: '运行检查' }).click();
    if (await page.locator('.stpd-diagnostic-check').count() !== 3) throw new Error('Diagnostics checks did not render');
    if (await page.locator('.stpd-diagnostic-record').count() !== 1) throw new Error('Diagnostics record did not render');
    if (!await page.locator('.stpd-modal').evaluate((modal) => modal.scrollWidth <= modal.clientWidth)) throw new Error(`${name} diagnostics overflow horizontally`);
    const backBox = await page.getByRole('button', { name: '返回导演时间' }).boundingBox();
    if (!backBox || backBox.y < 0 || backBox.y + backBox.height > height) throw new Error(`${name} back button is outside viewport`);
    await page.getByRole('tab', { name: '外观', exact: true }).click();
    if (await page.getByRole('tab', { name: '外观', exact: true }).getAttribute('aria-selected') !== 'true') throw new Error('Appearance settings did not activate');
    await page.getByRole('button', { name: '返回导演时间' }).click();
    if (await page.locator('.stpd-tabs button[role="tab"]').count() !== 6) throw new Error('Main tabs did not return');
    await page.getByRole('tab', { name: '世界书', exact: true }).click();
    if (await page.locator('.stpd-world-book').count() !== 2) throw new Error('Installed world books were not listed');
    await page.getByRole('button', { name: '展开 城市设定' }).click();
    await page.getByText('街区与交通', { exact: true }).waitFor();
    await page.getByLabel('选择世界书 城市设定').check();
    if (await page.locator('.stpd-world-entries input:checked').count() !== 2) throw new Error('Whole-book selection did not select its entries');
    await page.getByRole('tab', { name: '副本', exact: true }).click();
    await page.locator('.stpd-field').filter({ hasText: '迁移模式' }).locator('select').selectOption('clone');
    const checked = await page.locator('.stpd-field input[type="checkbox"]:checked').count();
    if (checked !== 5) throw new Error(`Clone mode selected ${checked} options instead of five`);
    const closeBox = await page.getByRole('button', { name: '关闭导演时间' }).boundingBox();
    if (!closeBox || closeBox.y < 0 || closeBox.y + closeBox.height > height) throw new Error(`${name} close button is outside viewport`);
    if (errors.length) throw new Error(errors.join('\n'));
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
