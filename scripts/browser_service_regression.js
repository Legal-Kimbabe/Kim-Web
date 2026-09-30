/* Service-page scope and first-frame regression checks against recovery base. */
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const pixelmatch = require('pixelmatch').default || require('pixelmatch');
const { PNG } = require('pngjs');

const baseline = '42a5073c2ac4c1f59f60a675077d96319d444bb8';
const base = process.env.CLAUSEBANK_TEST_BASE || 'http://localhost:8765';
const sections = {
  about: 'about',
  'contract-drafting': 'draft',
  'contract-review': 'review',
  'legal-translation': 'translate'
};
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const pixelDifference = (first, second) => {
  const a = PNG.sync.read(first);
  const b = PNG.sync.read(second);
  if (a.width !== b.width || a.height !== b.height) return 1;
  return pixelmatch(a.data, b.data, null, a.width, a.height, {threshold: .12}) /
    (a.width * a.height);
};

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
        await page.waitForTimeout(route === 'contract-drafting' && !old ? 900 : 400);
        const visible = page.locator(`#${section}`);
        if (!await visible.isVisible()) throw new Error(`${route} ${width}: section hidden`);
        results.push({
          dom: hash(await visible.evaluate(el => el.outerHTML)),
          text: hash(await visible.innerText()),
          pixels: await page.screenshot({fullPage: true, animations: 'disabled'}),
          errors,
          draftingReady: route === 'contract-drafting' && !old ? await page.evaluate(() => ({
            pending: document.documentElement.classList.contains('drafting-machine-pending'),
            ready: document.querySelector('#draft .td-shell')?.classList.contains('td-machine-ready'),
            machineDecoded: Boolean(document.querySelector('[data-drafting-machine]')?.complete &&
              document.querySelector('[data-drafting-machine]')?.naturalWidth),
            propsReady: innerWidth <= 600 || Array.from(document.querySelectorAll('#draft .td-prop'))
              .every(el => el.classList.contains('is-loaded') && el.complete && el.naturalWidth)
          })) : null
        });
        await context.close();
      }
      if (route === 'contract-drafting') {
        if (results[0].text !== results[1].text)
          throw new Error(`${route} ${width}: visible service copy changed`);
        if (!results[1].draftingReady.ready || results[1].draftingReady.pending ||
            !results[1].draftingReady.machineDecoded || !results[1].draftingReady.propsReady)
          throw new Error(`${route} ${width}: approved first-frame assets are not ready`);
      } else {
        if (results[0].dom !== results[1].dom) throw new Error(`${route} ${width}: visible DOM changed`);
        const difference = pixelDifference(results[0].pixels, results[1].pixels);
        if (difference > .01) throw new Error(`${route} ${width}: pixel difference ${(difference * 100).toFixed(3)}%`);
      }
      if (results[1].errors.length) throw new Error(`${route} ${width}: JS error`);
      console.log(route === 'contract-drafting'
        ? `PASS ${route} ${width}: copy preserved; machine/props decoded before ready`
        : `PASS ${route} ${width}: visible DOM and screenshot identical`);
    }
  }
  await browser.close();
}
run().catch(error => {console.error(error); process.exit(1);});
