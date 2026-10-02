/* Run with NODE_PATH pointing at the bundled Playwright dependency. */
const { chromium } = require('playwright');

const base = process.env.CLAUSEBANK_TEST_BASE || 'http://localhost:8765';
const semanticCases = [
  ['/clausebank/short-entire-agreement-clause/', 'IA-01'],
  ['/clausebank/comprehensive-force-majeure-clause/', 'FM-02'],
  ['/clausebank/cumulative-remedies-no-implied-waiver/', 'MI-12'],
  ['/clausebank/unilateral-damages-clause/', 'DM-02'],
  ['/clausebank/system-availability-sla/', 'SLA-02'],
];
const assert = (test, message) => { if (!test) throw new Error(message); };

async function prepareContext(browser, width, height) {
  const context = await browser.newContext({
    viewport: {width, height},
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  let postCount = 0;
  await context.route('https://vvkvwxjerjejrenkteeg.supabase.co/**', async route => {
    if (route.request().method() === 'POST') postCount++;
    await route.fulfill({status: 200, contentType: 'application/json',
      body: route.request().method() === 'POST'
        ? '6' : '[{"clause_code":"WT-01","copy_count":5}]'});
  });
  return {context, getPostCount: () => postCount};
}

async function runLandingCase(browser, route, width, height) {
  const {context, getPostCount} = await prepareContext(browser, width, height);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + route, {waitUntil: 'load'});
  await page.waitForTimeout(300);
  assert(await page.locator('#vault .card').count() === 98,
    `${route} ${width}: landing card count`);
  assert(await page.locator('#vault .copy-count').count() === 98,
    `${route} ${width}: copy-count hooks`);
  assert(await page.locator('[data-filter="payment"]').count() === 1,
    `${route} ${width}: payment filter`);
  assert(await page.locator('.editorial-desktop-nav a[href="/"]').count() >= 1,
    `${route} ${width}: canonical hub navigation`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${route} ${width}: horizontal overflow`);
  assert(errors.length === 0, `${route} ${width}: JS errors: ${errors.join('; ')}`);
  assert(await page.locator('header.hero img').evaluate(img =>
    img.complete && img.naturalWidth > 0 && img.naturalHeight > 0),
    `${route} ${width}: homepage hero did not render`);

  await page.locator('[data-filter="warranty"]').click();
  assert(await page.locator('#vault .card:visible').count() === 3,
    `${route} ${width}: warranty filter count`);
  const warranty = page.locator('#vault .card:visible').first();
  const filters = page.locator('#vault .filters');
  const selectedScroll = await filters.evaluate(el => el.scrollLeft);
  for (let step = 0; step < 3; step++) {
    const wasOpen = await warranty.evaluate(el => el.classList.contains('open'));
    await warranty.locator('.cardhead').click();
    assert(await warranty.evaluate(el => el.classList.contains('open')) !== wasOpen,
      `${route} ${width}: header did not toggle exactly once step ${step}`);
    assert(await page.locator('[data-filter="warranty"]').evaluate(el => el.classList.contains('active')),
      `${route} ${width}: selected category lost step ${step}`);
    assert(await page.locator('#vault .card:visible').count() === 3,
      `${route} ${width}: visible cards reset step ${step}`);
    assert(Math.abs((await filters.evaluate(el => el.scrollLeft)) - selectedScroll) <= 2,
      `${route} ${width}: filter strip jumped step ${step}`);
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
    await warranty.locator('.cardhead').click();
  await warranty.locator('.copy').click();
  await page.waitForTimeout(150);
  assert(getPostCount() > 0, `${route} ${width}: copy increment`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${route} ${width}: overflow after interaction`);
  await context.close();
  console.log(`PASS ${width}x${height} ${route}: landing 98 cards, filter/toggle/copy, visual smoke`);
}

async function runSemanticCase(browser, route, targetCode, width, height) {
  const {context, getPostCount} = await prepareContext(browser, width, height);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + route, {waitUntil: 'load'});
  await page.waitForTimeout(500);
  assert(await page.locator('#vault .card').count() === 98,
    `${route} ${width}: semantic card count`);
  assert(await page.locator('#vault .copy-count').count() === 98,
    `${route} ${width}: semantic copy-count hooks`);
  assert(await page.locator('[data-filter="payment"]').count() === 1,
    `${route} ${width}: semantic filters missing`);
  const target = page.locator('#vault .card').filter({
    has: page.locator(`.code:text-is("${targetCode}")`),
  });
  assert(await target.count() === 1, `${route} ${width}: wrong semantic target`);
  assert(await target.evaluate(el => el.classList.contains('open')),
    `${route} ${width}: direct target must open`);
  await page.waitForFunction(code => {
    const card = [...document.querySelectorAll('#vault .card')]
      .find(el => el.querySelector('.code')?.textContent.trim() === code);
    if (!card) return false;
    const box = card.getBoundingClientRect();
    return box.top < innerHeight && box.bottom > 0;
  }, targetCode, {timeout: 4000});
  assert(await page.locator('h1').count() === 1,
    `${route} ${width}: semantic H1 count`);
  assert(await page.locator('.editorial-desktop-nav a[href="/"]').count() >= 1,
    `${route} ${width}: semantic hub link is not canonical root`);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${route} ${width}: semantic overflow`);
  assert(errors.length === 0, `${route} ${width}: JS errors: ${errors.join('; ')}`);
  const lang = page.locator('#vault .lang');
  await lang.getByText('EN', {exact: true}).click();
  assert(await page.evaluate(() => document.body.classList.contains('en-mode')),
    `${route} ${width}: semantic English toggle`);
  await lang.getByText('中文', {exact: true}).click();
  await target.locator('.copy').click();
  await page.waitForTimeout(150);
  assert(getPostCount() > 0, `${route} ${width}: semantic copy increment`);

  await page.locator('[data-filter="warranty"]').click();
  assert(await page.locator('#vault .card:visible').count() === 3,
    `${route} ${width}: semantic warranty filter count`);
  const warranty = page.locator('#vault .card:visible').first();
  for (let step = 0; step < 3; step++) {
    const wasOpen = await warranty.evaluate(el => el.classList.contains('open'));
    await warranty.locator('.cardhead').click();
    assert(await warranty.evaluate(el => el.classList.contains('open')) !== wasOpen,
      `${route} ${width}: semantic filter card did not toggle step ${step}`);
    assert(await page.locator('[data-filter="warranty"]').evaluate(el => el.classList.contains('active')),
      `${route} ${width}: semantic category lost step ${step}`);
    assert(await page.locator('#vault .card:visible').count() === 3,
      `${route} ${width}: semantic filter reset step ${step}`);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${route} ${width}: semantic overflow after interaction`);
  await context.close();
  console.log(`PASS ${width}x${height} ${route}: 98 cards, ${targetCode} open/focused, full UX`);
}

async function runTitleClickMatrix(browser, width, height) {
  const {context} = await prepareContext(browser, width, height);
  const seed = await context.newPage();
  await seed.goto(base + '/', {waitUntil: 'load'});
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
    await page.goto(base + '/', {waitUntil: 'load'});
    documentNavigations = 0;
    const card = page.locator('#vault .card').filter({
      has: page.locator(`.code:text-is("${code}")`),
    });
    const category = await card.getAttribute('data-cat');
    await page.locator(`[data-filter="${category}"]`).click();
    const before = await page.evaluate(() => ({
      pathname: location.pathname, search: location.search, hash: location.hash,
      hero: document.querySelector('header.hero img')?.getAttribute('src') || '',
    }));
    const visibleBefore = await page.locator('#vault .card:visible').count();
    assert(!(await card.evaluate(el => el.classList.contains('open'))),
      `${width}: ${code} must begin collapsed`);
    await card.locator('.clause-semantic-link .title').click();
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => ({
      pathname: location.pathname, search: location.search, hash: location.hash,
      hero: document.querySelector('header.hero img')?.getAttribute('src') || '',
    }));
    assert(JSON.stringify(after) === JSON.stringify(before),
      `${width}: ${code} title changed URL or hero`);
    assert(documentNavigations === 0, `${width}: ${code} title caused navigation`);
    assert(await card.evaluate(el => el.classList.contains('open')),
      `${width}: ${code} title did not open exactly once`);
    assert(await page.locator(`[data-filter="${category}"]`).evaluate(el => el.classList.contains('active')),
      `${width}: ${code} title lost category`);
    assert(!(await page.locator('[data-filter="all"]').evaluate(el => el.classList.contains('active'))),
      `${width}: ${code} title reactivated all`);
    assert(await page.locator('#vault .card:visible').count() === visibleBefore,
      `${width}: ${code} title changed visible results`);
    await card.locator('.clause-semantic-link .title').click();
    await page.waitForTimeout(50);
    assert(documentNavigations === 0 &&
      !(await card.evaluate(el => el.classList.contains('open'))),
      `${width}: ${code} second title click did not collapse exactly once`);
    await page.close();
  }
  await context.close();
  console.log(`PASS ${width}x${height}: landing title click 98/98 local toggles`);
}

async function run() {
  const browser = await chromium.launch({headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for (const [width, height] of [[1280, 900], [390, 844]]) {
    await runLandingCase(browser, '/', width, height);
    await runLandingCase(browser, '/clausebank/', width, height);
    for (const [route, targetCode] of semanticCases)
      await runSemanticCase(browser, route, targetCode, width, height);
    await runTitleClickMatrix(browser, width, height);
  }
  await browser.close();
  console.log('PASS: desktop/mobile landing, 98-title matrix, five semantic families');
}

run().catch(error => { console.error(error); process.exit(1); });
