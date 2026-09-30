/* Run with NODE_PATH pointing at the bundled Playwright dependency. */
const { chromium } = require('playwright');

const base = process.env.CLAUSEBANK_TEST_BASE || 'http://localhost:8765';
const cases = [
  ['/', ''],
  ['/clausebank/', ''],
  ['/clausebank/governing-law-jurisdiction-taiwan/', 'GL-01'],
  ['/clausebank/cumulative-remedies-no-implied-waiver/', 'MI-12'],
  ['/clausebank/conflict-of-interest/', 'COI-01'],
  ['/clausebank/cross-border-personal-data-transfer/', 'PD-04'],
];
const assert = (test, message) => { if (!test) throw new Error(message); };

async function runTitleClickMatrix(browser, width, height) {
  const context = await browser.newContext({viewport: {width, height}});
  await context.route('https://vvkvwxjerjejrenkteeg.supabase.co/**', request =>
    request.fulfill({status: 200, contentType: 'application/json', body: '[]'}));

  const seed = await context.newPage();
  await seed.goto(base + '/clausebank/', {waitUntil: 'load'});
  const codes = await seed.locator('#vault .card .code').allTextContents();
  assert(codes.length === 98 && new Set(codes).size === 98,
    `${width}: expected 98 unique title-click cases`);
  for (const code of ['SLA-01', 'SLA-02', 'SLA-03']) {
    const card = seed.locator('#vault .card').filter({
      has: seed.locator(`.code:text-is("${code}")`),
    });
    assert(await card.evaluate(el => el.classList.contains('long-clause')),
      `${width}: ${code} must remain long-clause`);
  }
  await seed.close();

  for (const code of codes) {
    const page = await context.newPage();
    let documentNavigations = 0;
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) documentNavigations++;
    });
    await page.goto(base + '/clausebank/', {waitUntil: 'load'});
    documentNavigations = 0;

    const card = page.locator('#vault .card').filter({
      has: page.locator(`.code:text-is("${code}")`),
    });
    assert(await card.count() === 1, `${width}: ${code} missing`);
    const category = await card.getAttribute('data-cat');
    await page.locator(`[data-filter="${category}"]`).click();
    const before = await page.evaluate(() => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      hero: document.querySelector('header.hero img')?.getAttribute('src') || '',
    }));
    const visibleBefore = await page.locator('#vault .card:visible').count();
    const wasOpen = await card.evaluate(el => el.classList.contains('open'));
    assert(!wasOpen, `${width}: ${code} must begin collapsed`);

    await card.locator('.clause-semantic-link').click();
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      hero: document.querySelector('header.hero img')?.getAttribute('src') || '',
    }));
    assert(JSON.stringify(after) === JSON.stringify(before),
      `${width}: ${code} title changed URL or hero`);
    assert(documentNavigations === 0, `${width}: ${code} title caused document navigation`);
    assert(await card.evaluate(el => el.classList.contains('open')),
      `${width}: ${code} title did not toggle open exactly once`);
    assert(await page.locator(`[data-filter="${category}"]`).evaluate(
      el => el.classList.contains('active')),
      `${width}: ${code} title lost selected category`);
    assert(!(await page.locator('[data-filter="all"]').evaluate(
      el => el.classList.contains('active'))),
      `${width}: ${code} title reactivated all clauses`);
    assert(await page.locator('#vault .card:visible').count() === visibleBefore,
      `${width}: ${code} title changed visible category results`);

    await card.locator('.clause-semantic-link').click();
    await page.waitForTimeout(80);
    assert(documentNavigations === 0 &&
      !(await card.evaluate(el => el.classList.contains('open'))),
      `${width}: ${code} second title click did not collapse exactly once`);
    await page.close();
  }
  await context.close();
  console.log(`PASS ${width}x${height}: title click 98/98 local toggles`);
}

async function run() {
  const browser = await chromium.launch({headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  let tested = 0;
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    for (const [route, targetCode] of cases) {
      const context = await browser.newContext({viewport: {width, height},
        permissions: ['clipboard-read', 'clipboard-write']});
      let postCount = 0;
      await context.route('https://vvkvwxjerjejrenkteeg.supabase.co/**', async request => {
        if (request.request().method() === 'POST') postCount++;
        await request.fulfill({status: 200, contentType: 'application/json',
          body: request.request().method() === 'POST' ? '6' : '[{"clause_code":"WT-01","copy_count":5}]'});
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + route, {waitUntil: 'load'});
      await page.waitForTimeout(500);
      assert(await page.locator('#vault .card').count() === 98, `${route} ${width}: card count`);
      assert(await page.locator('#vault .copy-count').count() === 98, `${route} ${width}: count hooks`);
      assert(await page.locator('[data-filter="payment"]').count() === 1,
        `${route} ${width}: payment filter`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} ${width}: horizontal overflow`);
      assert(errors.length === 0, `${route} ${width}: JS errors: ${errors.join('; ')}`);
      if (targetCode) {
        const card = page.locator('#vault .card').filter({has: page.locator(`.code:text-is("${targetCode}")`)});
        assert(await card.count() === 1, `${route} ${width}: deep link card missing`);
        assert(await card.evaluate(el => el.classList.contains('open')),
          `${route} ${width}: target did not open`);
        await page.waitForFunction(code => {
          const card = [...document.querySelectorAll('#vault .card')]
            .find(el => el.querySelector('.code')?.textContent.trim() === code);
          if (!card) return false;
          const box = card.getBoundingClientRect();
          return box.top < innerHeight && box.bottom > 0;
        }, targetCode, {timeout: 4000});
      }
      await page.locator('[data-filter="warranty"]').click();
      const filters = page.locator('#vault .filters');
      const selectedScroll = await filters.evaluate(el => el.scrollLeft);
      assert((await page.locator('#vault .card:visible').count()) === 3,
        `${route} ${width}: warranty filter count`);
      const warranty = page.locator('#vault .card:visible').first();
      const head = warranty.locator('.cardhead');
      for (let step = 0; step < 3; step++) {
        await head.click();
        await page.waitForTimeout(150);
        assert(await page.locator('[data-filter="warranty"]').evaluate(el => el.classList.contains('active')),
          `${route} ${width}: active filter lost step ${step}`);
        assert(await page.locator('#vault .card:visible').count() === 3,
          `${route} ${width}: cards reset step ${step}`);
        assert(Math.abs((await filters.evaluate(el => el.scrollLeft)) - selectedScroll) <= 2,
          `${route} ${width}: filter strip jumped step ${step}`);
      }
      if (width <= 700) {
        const originalUrl = page.url();
        for (let step = 0; step < 3; step++) {
          const wasOpen = await warranty.evaluate(el => el.classList.contains('open'));
          await warranty.locator('.clause-semantic-link .title').click();
          assert(page.url() === originalUrl, `${route}: mobile title navigated step ${step}`);
          assert(await warranty.evaluate(el => el.classList.contains('open')) !== wasOpen,
            `${route}: mobile title did not toggle exactly once step ${step}`);
          assert(await page.locator('[data-filter="warranty"]').evaluate(el => el.classList.contains('active')),
            `${route}: mobile title reset filter step ${step}`);
        }
        for (const selector of ['.clause-semantic-link .code', '.en', '.applicability']) {
          const wasOpen = await warranty.evaluate(el => el.classList.contains('open'));
          await warranty.locator(selector).click();
          assert(page.url() === originalUrl &&
            await warranty.evaluate(el => el.classList.contains('open')) !== wasOpen &&
            await page.locator('[data-filter="warranty"]').evaluate(el => el.classList.contains('active')),
            `${route}: mobile ${selector} must toggle once without navigation or filter reset`);
        }
        const wasOpen = await warranty.evaluate(el => el.classList.contains('open'));
        await warranty.locator('.clause-expand').click();
        assert(page.url() === originalUrl &&
          await warranty.evaluate(el => el.classList.contains('open')) !== wasOpen,
          `${route}: mobile arrow must toggle exactly once without navigation`);

        if (route === '/clausebank/') {
          assert(await page.locator('#vault .card.open').count() <= 1,
            `${route}: unexpected initial open cards`);
          await page.locator('[data-filter="all"]').click();
          const payment = page.locator('#vault .card').filter({
            has: page.locator('.code:text-is("PT-01")'),
          });
          assert(!(await payment.evaluate(el => el.classList.contains('open'))),
            `${route}: PT-01 must remain collapsed on landing`);
        }
      }
      const lang = page.locator('#vault .lang');
      await lang.getByText('EN', {exact: true}).click();
      assert(await page.evaluate(() => document.body.classList.contains('en-mode')),
        `${route} ${width}: English toggle`);
      await lang.getByText('雙語', {exact: true}).click();
      assert(await page.evaluate(() => document.body.classList.contains('bilingual-mode')),
        `${route} ${width}: bilingual toggle`);
      await lang.getByText('中文', {exact: true}).click();
      if (!await warranty.evaluate(el => el.classList.contains('open')))
        await warranty.locator('.en').click();
      await warranty.locator('.copy').click();
      await page.waitForTimeout(250);
      assert(postCount > 0, `${route} ${width}: Supabase copy increment`);
      assert(await warranty.locator('.copy-count').count() === 1,
        `${route} ${width}: copy count missing`);
      await page.locator('[data-filter="all"]').click();
      await page.evaluate(() => window.scrollTo({top: document.body.scrollHeight, behavior: 'instant'}));
      await page.waitForTimeout(800);
      const back = page.locator('.back-to-top');
      assert(await back.evaluate(el => el.classList.contains('is-visible')),
        `${route} ${width}: LWYRUP not visible`);
      const lifted = await back.evaluate(el => parseFloat(getComputedStyle(el).bottom));
      assert(lifted >= (width <= 700 ? 12 : 18), `${route} ${width}: footer avoidance`);
      assert(lifted > (width <= 700 ? 12 : 18),
        `${route} ${width}: footer did not lift LWYRUP`);
      if (width <= 700) assert(await page.locator('#vault .toolbar').evaluate(el => {
        const position = getComputedStyle(el).position;
        return position === 'sticky' ||
          (position === 'fixed' && el.classList.contains('mobile-toolbar-fixed'));
      }), `${route} ${width}: mobile toolbar is neither sticky nor intentionally fixed`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} ${width}: horizontal overflow after interaction`);
      console.log(`PASS ${width}x${height} ${route}: 98 cards, UX, copy/count, no overflow`);
      tested++;
      await context.close();
    }
  }
  await runTitleClickMatrix(browser, 1280, 900);
  await runTitleClickMatrix(browser, 390, 844);
  await browser.close();
  console.log(`PASS ${tested} browser cases`);
}
run().catch(error => {console.error(error); process.exit(1);});
