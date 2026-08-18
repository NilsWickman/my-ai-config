// Screenshot every variant of a design mockup.
// The mockup is one HTML file whose <html> carries data-variant; each option is
// a [data-variant="N"] CSS block. Variant 0 = the current state (baseline).
//
//   MOCK_HTML=./mock.html TARGET=#panel VARIANTS=5 node shoot.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const MOCK = path.resolve(process.env.MOCK_HTML || `${__dirname}/mock.html`);
const OUT = path.resolve(process.env.OUT_DIR || `${__dirname}/out`);
const TARGET = process.env.TARGET || 'body'; // region to shoot, not full page
const VARIANTS = Number(process.env.VARIANTS || 5); // highest variant number

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    await page.goto(`file://${MOCK}`);
    for (let v = 0; v <= VARIANTS; v++) {
      await page.evaluate((n) => {
        document.documentElement.dataset.variant = n;
      }, String(v));
      await page.waitForTimeout(150); // let transitions settle
      const file = `${OUT}/variant-${v}.png`;
      await page.locator(TARGET).screenshot({ path: file });
      console.log(file);
    }
  } finally {
    await browser.close();
  }
})();
