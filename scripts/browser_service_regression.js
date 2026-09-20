/* Pixel/DOM comparison for the four service pages against approved main. */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const baseline = 'ca99b687e89082e3617f5cee317b01466c218b96';
const base = process.env.CLAUSEBANK_TEST_BASE || 'http://localhost:8765';
const sections = {
  about: 'about',
  'contract-drafting': 'draft',
  'contract-review': 'review',
  'legal-translation': 'translate'
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function run() {
  const browser = await chromium.launch({headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const [route, section] of Object.entries(sections)) {
    for (const width of [1280, 390]) {
      const results = [];
      for (const old of [true, false]) {
        const context = await browser.newContext({viewport: {
          width, height: width === 390 ? 844 : 900}, reducedMotion: 'reduce'});
        if (old) {
          const html = execFileSync('git', ['show', `${baseline}:${route}/index.html`],
            {encoding: 'utf8'});
          await context.route(`${base}/${route}/`, request =>
            request.fulfill({status: 200, contentType: 'text/html', body: html}));
        }
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/${route}/`);
        await page.waitForTimeout(400);
        const visible = page.locator(`#${section}`);
        if (!await visible.isVisible()) throw new Error(`${route} ${width}: section hidden`);
        results.push({
          dom: hash(await visible.evaluate(el => el.outerHTML)),
          pixels: hash(await page.screenshot({fullPage: true, animations: 'disabled'})),
          errors
        });
        await context.close();
      }
      if (results[0].dom !== results[1].dom) throw new Error(`${route} ${width}: visible DOM changed`);
      if (results[0].pixels !== results[1].pixels) throw new Error(`${route} ${width}: pixels changed`);
      if (results[1].errors.length) throw new Error(`${route} ${width}: JS error`);
      console.log(`PASS ${route} ${width}: visible DOM and screenshot identical`);
    }
  }
  await browser.close();
}
run().catch(error => {console.error(error); process.exit(1);});
