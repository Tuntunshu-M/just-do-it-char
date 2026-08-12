const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 420, height: 640 } });
    await page.goto('http://127.0.0.1:4173/qa/preview.html');
    await page.waitForLoadState('networkidle');
    await page.locator('#st-proactive-director.stpd-modal-open').waitFor({ state: 'attached' });
    await page.evaluate(() => { document.documentElement.style.transform = 'translateZ(0)'; });

    const geometry = await page.evaluate(() => {
      const overlay = document.querySelector('.stpd-overlay').getBoundingClientRect();
      const modal = document.querySelector('.stpd-modal').getBoundingClientRect();
      const close = document.querySelector('.stpd-close').getBoundingClientRect();
      return {
        overlay: { top: overlay.top, bottom: overlay.bottom, height: overlay.height },
        modal: { top: modal.top, bottom: modal.bottom },
        close: { top: close.top, bottom: close.bottom },
        viewport: { width: innerWidth, height: innerHeight },
      };
    });

    if (geometry.overlay.height !== geometry.viewport.height) {
      throw new Error(`Overlay height ${geometry.overlay.height} does not match viewport ${geometry.viewport.height}`);
    }
    if (geometry.modal.top < 0 || geometry.modal.bottom > geometry.viewport.height) {
      throw new Error(`Modal is outside viewport: ${JSON.stringify(geometry)}`);
    }
    if (geometry.close.top < 0 || geometry.close.bottom > geometry.viewport.height) {
      throw new Error(`Close button is outside viewport: ${JSON.stringify(geometry)}`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
