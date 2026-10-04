/* 金法務在線｜關於我們・電梯 */
(function () {
  var root = document.getElementById('about-lift');
  if (!root) return;
  var aboutSection = document.getElementById('about');
  if (aboutSection) aboutSection.classList.add('lkl-on');

  /* 讓電梯剛好塞滿導覽列以下的螢幕高度 */
  var frame = root.querySelector('.lkl-frame');
  var stageEl = root.querySelector('.lkl-stage');
  var footer = document.querySelector('.site-footer');
  var portrait = window.matchMedia('(max-aspect-ratio: 1/1)');
  function isM() { return portrait.matches; }
  function fitHeader() {
    var top = frame.getBoundingClientRect().top + window.scrollY;
    if (top > 0 && top < 400) root.style.setProperty('--lkl-header', Math.round(top) + 'px');
    /* 直式時：電梯區塊高度 = 視窗高度 − 導覽列 − 頁尾 */
    var fh = footer ? footer.getBoundingClientRect().height : 0;
    var fill = Math.floor(window.innerHeight - top - fh);
    if (fill > 200) root.style.setProperty('--lkl-fill', fill + 'px');
    layoutMobile();
    placeNarr();
  }
  /* 遊戲卡：桌機／橫式放在場景內（原位置）；直式手機移到場景下方，成為一般文件流內容 */
  function placeNarr() {
    var el = root.querySelector('.lkl-narr');
    if (!el) return;
    if (el.parentNode !== stageEl) stageEl.insertBefore(el, stageEl.querySelector('.lkl-return'));
  }

  /* 直式手機：把直式電梯圖（1024×1536）cover 到舞台上、靠右保留按鍵，
     並依圖上的實際門洞換算門片與場景起始位置 */
  var M_CAR = { w: 1024, h: 1536, door: { x0: 152, x1: 757, y0: 192, y1: 1367, seam: 456 } };
  var M_VARS = ['--lkl-cx', '--lkl-cy', '--lkl-cw', '--lkl-ch', '--lkl-dx', '--lkl-dy', '--lkl-dw', '--lkl-dh', '--lkl-ilx', '--lkl-irx', '--lkl-iy', '--lkl-co'];
  function layoutMobile() {
    var s = root.style;
    if (!isM()) { M_VARS.forEach(function (k) { s.removeProperty(k); }); return; }
    var W = stageEl.clientWidth, H = stageEl.clientHeight;
    if (!W || !H) return;
    var k = Math.max(W / M_CAR.w, H / M_CAR.h);
    var cw = M_CAR.w * k, ch = M_CAR.h * k;
    var cx = W - cw, cy = (H - ch) / 2;              /* 靠右、上下置中 */
    var d = M_CAR.door;
    var dl = cx + d.x0 * k, dt = cy + d.y0 * k, dwp = (d.x1 - d.x0) * k, dhp = (d.y1 - d.y0) * k;
    var leftW = (d.seam - d.x0) * k;
    s.setProperty('--lkl-cx', cx + 'px'); s.setProperty('--lkl-cy', cy + 'px');
    s.setProperty('--lkl-cw', cw + 'px'); s.setProperty('--lkl-ch', ch + 'px');
    s.setProperty('--lkl-dx', (dl / W * 100) + '%'); s.setProperty('--lkl-dy', (dt / H * 100) + '%');
    s.setProperty('--lkl-dw', (dwp / W * 100) + '%'); s.setProperty('--lkl-dh', (dhp / H * 100) + '%');
    s.setProperty('--lkl-ilx', (cx - dl) + 'px'); s.setProperty('--lkl-irx', (cx - dl - leftW) + 'px');
    s.setProperty('--lkl-iy', (cy - dt) + 'px');
    s.setProperty('--lkl-co', ((dl + dwp / 2) / W * 100) + '% ' + ((dt + dhp / 2) / H * 100) + '%');
  }

  fitHeader();
  window.addEventListener('resize', fitHeader);
  window.addEventListener('load', fitHeader);

  var ORDER = ['P3', 'P2', 'G', 'RF'];      /* 由低到高；進電梯時停在 G */
  /* 走近的位置（場景寬高比例）與倍率：桌機與直式手機的構圖不同，各自一組 */
  var ZOOMS_D = { wall: { x: .611, y: .27, s: 1.86 }, plq: { x: .646, y: .435, s: 1.7 } };
  var ZOOMS_M = { wall: { x: .685, y: .366, s: 2.0 }, plq: { x: .714, y: .395, s: 1.95 } };
  function zoomOf(key) { return (isM() ? ZOOMS_M : ZOOMS_D)[key]; }
  var FLOORS = { RF: 1, G: 1, P2: 1, P3: 1 };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var st = { at: 'G', out: false, open: false, busy: false, zoom: false };
  var catState = 0;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, reduce ? 0 : ms); }); }
  function scene(f) { return $('.lkl-scene[data-floor="' + f + '"]'); }
  function inner(f) { return $('.lkl-cam-inner', scene(f)); }

  /* G 圖片準備：P1 與目前裝置的電梯先 decode；P2－P4 進 G 後才依序 idle 準備。
     P5 是有聲影片，只在使用者到 P4 後才開始 preload。 */
  var G_IMAGES = {
    1: '/assets/about-lift/lk-g-p1.webp?v=g6',
    2: '/assets/about-lift/lk-g-p2.png?v=g8',
    3: '/assets/about-lift/lk-g-p3.png?v=g7',
    4: '/assets/about-lift/lk-g-p4.png?v=g7'
  };
  var imageJobs = Object.create(null);
  var heldImages = Object.create(null);
  var gReady = Object.create(null);
  var gPageIntent = 0;
  var gIdleStarted = false;

  function loadAndDecode(url) {
    if (imageJobs[url]) return imageJobs[url];
    imageJobs[url] = new Promise(function (resolve, reject) {
      var img = new Image();
      heldImages[url] = img;              /* 保留 decoded bitmap，避免進場前被回收 */
      img.decoding = 'async';
      img.src = url;
      function ready() { resolve(img); }
      function failed() { reject(new Error('Image failed to load: ' + url)); }
      if (img.decode) {
        img.decode().then(ready, function () {
          if (img.complete && img.naturalWidth) ready();
          else { img.addEventListener('load', ready, { once: true }); img.addEventListener('error', failed, { once: true }); }
        });
      } else {
        if (img.complete && img.naturalWidth) ready();
        else { img.addEventListener('load', ready, { once: true }); img.addEventListener('error', failed, { once: true }); }
      }
    });
    return imageJobs[url];
  }
  function nextFrame() { return new Promise(function (resolve) { requestAnimationFrame(function () { resolve(); }); }); }
  function currentElevatorImage() {
    return isM() ? '/assets/about-lift/lk-m-elevator.webp?v=g1' : '/assets/about-lift/lk-elevator-d2.webp?v=d2';
  }
  var P3_IMAGE = '/assets/about-lift/lk-p3-fullbody.webp?v=p3-fullbody-lossless-1';
  function ensureGPage(n) {
    var url = G_IMAGES[n];
    if (!url) return Promise.resolve();
    return loadAndDecode(url).then(function () {
      if (n > 1) root.style.setProperty('--lkl-g-p' + n, 'url("' + url + '")');
      if (!gReady[n]) {
        gReady[n] = true;
        if (window.performance && performance.mark) performance.mark('lkl-g-p' + n + '-decoded');
      }
    });
  }
  function idleTask(fn) {
    if ('requestIdleCallback' in window) return requestIdleCallback(fn, { timeout: 1800 });
    return setTimeout(fn, 160);
  }
  function preloadRemainingG(n) {
    if (n > 4) return;
    idleTask(function () {
      ensureGPage(n).then(function () { preloadRemainingG(n + 1); }, function () { /* 翻頁時會再試 */ });
    });
  }
  function startGIdlePreload() {
    if (gIdleStarted) return;
    gIdleStarted = true;
    preloadRemainingG(2);
  }
  function setGPageNow(n) {
    gPageIntent++;
    $('.lkl-gpages', scene('G')).setAttribute('data-page', String(n));
    root.classList.toggle('is-gfinale', +n === 5);
    if (+n !== 5) resetGFinale();
  }
  function gFinale() { return $('.lkl-gfinale', scene('G')); }
  function preloadGFinale() {
    var video = gFinale();
    if (!video || video.preload === 'auto') return;
    video.preload = 'auto';
    video.load();
  }
  function resetGFinale() {
    var video = gFinale();
    if (!video) return;
    video.pause();
    try { video.currentTime = 0; } catch (_) { /* metadata may not be ready yet */ }
    video.closest('.lkl-gpage').classList.remove('is-audio-blocked');
  }
  function playGFinaleFromGesture() {
    var video = gFinale();
    if (!video) return;
    preloadGFinale();
    video.muted = false;
    video.volume = 1;
    try { video.currentTime = 0; } catch (_) { /* playback will begin at zero after metadata */ }
    var promise = video.play();
    if (promise && promise.catch) {
      promise.catch(function () { video.closest('.lkl-gpage').classList.add('is-audio-blocked'); });
    }
  }
  async function openGPage(n) {
    n = +n;
    var intent = ++gPageIntent;
    await ensureGPage(n);
    await nextFrame();                    /* CSS background 已掛上後再顯示，不讓第一次翻頁撞 decode */
    if (intent !== gPageIntent) return;
    root.classList.toggle('is-gfinale', n === 5);
    $('.lkl-gpages', scene('G')).setAttribute('data-page', String(n));
    if (n === 4) preloadGFinale();
    else if (n !== 5) resetGFinale();
  }
  async function prepareGLayers() {
    root.classList.add('is-layer-prep');
    await nextFrame();
    await nextFrame();                    /* 至少留一個完整 frame commit 合成層，再開始既有 transition */
    if (window.performance && performance.mark) performance.mark('lkl-g-layers-prepared');
  }
  function clearGLayers() { root.classList.remove('is-layer-prep'); }

  /* 文字層跟著畫面縮放 */
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function (entries) {
      entries.forEach(function (en) {
        var sc = en.target.closest('.lkl-scene');
        $$('.lkl-layer', sc).forEach(function (layer) {
          var w = +(layer.getAttribute('data-w') || sc.getAttribute('data-w'));
          if (w) layer.style.setProperty('--k', en.contentRect.width / w);
        });
      });
    });
    $$('.lkl-scene[data-w] .lkl-cam-inner').forEach(function (el) { ro.observe(el); });
  }

  function light(f) {
    $$('.lkl-call').forEach(function (b) { b.classList.toggle('is-lit', b.getAttribute('data-floor') === f); });
  }
  function setSign() { /* The approved ABOUT US plaque is part of the elevator artwork. */ }
  function showScene(f) {
    $$('.lkl-scene').forEach(function (s) { s.classList.toggle('is-current', s.getAttribute('data-floor') === f); });
  }

  /* 以「固定點」縮放：只改 scale，鏡頭直直推近，不會先往旁邊晃 */
  function zoomRect(f, x0, y0, s, ms) {
    var el = inner(f);
    var fx = s * x0 / (s - 1), fy = s * y0 / (s - 1);
    el.style.transformOrigin = (fx * 100) + '% ' + (fy * 100) + '%';
    el.style.transitionDuration = (reduce ? 0 : (ms || 1300)) + 'ms';
    el.style.transform = 'scale(' + s + ')';
    scene(f).classList.add('is-zoomed'); root.classList.add('is-zoomed');
  }
  function camTo(f, z) {
    var x0 = Math.min(1 - 1 / z.s, Math.max(0, z.x - .5 / z.s));
    var y0 = Math.min(1 - 1 / z.s, Math.max(0, z.y - .5 / z.s));
    zoomRect(f, x0, y0, z.s, 1300);
  }
  function camReset(f, ms) {
    var el = inner(f);
    el.style.transitionDuration = (reduce ? 0 : (ms || 1300)) + 'ms';
    el.style.transform = '';
    scene(f).classList.remove('is-zoomed'); root.classList.remove('is-zoomed');
  }

  async function stepOut() {
    if (st.at === 'G' && !root.classList.contains('is-layer-prep')) await prepareGLayers();
    if (st.at === 'G' && window.performance && performance.mark) performance.mark('lkl-g-step-out');
    root.classList.add('is-out'); st.out = true; await wait(1150);
    if (st.at === 'G') { roamG(true); clearGLayers(); startGIdlePreload(); }
  }
  /* G（直式手機）：走出電梯後改成可左右瀏覽的橫式 showroom，捲到與原本置中相同的位置，畫面不跳 */
  function roamG(on) {
    var sc = scene('G');
    if (!on || !isM()) { sc.classList.remove('is-roam'); sc.scrollLeft = 0; return; }
    var cam = $('.lkl-cam', sc);
    var off = (cam.offsetWidth - sc.clientWidth) / 2;
    sc.classList.add('is-roam');
    sc.scrollLeft = Math.max(0, off);
  }
  /* 回電梯前先回到頁面頂端：走出電梯後頁面可以往下捲，回電梯時要讓電梯完整在畫面內 */
  async function toTop() {
    if (window.scrollY > 2) {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      await wait(450);
    }
  }
  /* ---------- RF 開場旁白：左下角透明小卡，逐字出現 ---------- */
  var NARRATION = [
    { time: '15:03', text: 'Kim 去開會了嗎？人怎麼不見了，不是跟我約了下午三點嗎？' },
    { text: '先摸摸可愛的地瓜好了。' }
  ];
  var nv = { el: root.querySelector('.lkl-narr'), seen: false, i: 0, typing: null, full: false, startTimer: null };
  var nvTime = nv.el && nv.el.querySelector('.lkl-narr-time');
  var nvText = nv.el && nv.el.querySelector('.lkl-narr-text');
  function narrShow(k) {
    var line = NARRATION[k];
    nv.i = k; nv.full = false;
    nv.el.classList.remove('is-quip'); clearTimeout(nv.quipTimer);
    nvTime.textContent = line.time || '';
    nvTime.hidden = !line.time;
    nvText.textContent = '';
    nv.el.classList.add('is-on');
    clearInterval(nv.typing);
    if (reduce) { nvText.textContent = line.text; nv.full = true; return; }
    var n = 0;
    nv.typing = setInterval(function () {
      n++;
      nvText.textContent = line.text.slice(0, n);
      if (n >= line.text.length) { clearInterval(nv.typing); nv.full = true; }
    }, 60);
  }
  function narrate() {
    if (!nv.el || nv.seen) return;
    clearTimeout(nv.startTimer);
    nv.startTimer = setTimeout(function () {
      if (st.at === 'RF' && st.out) narrShow(0);
    }, reduce ? 0 : 800);
  }
  function narrNext() {
    if (!nv.full) {                      /* 還在打字：先把這句顯示完整 */
      clearInterval(nv.typing);
      nvText.textContent = NARRATION[nv.i].text; nv.full = true;
      return;
    }
    if (nv.i + 1 < NARRATION.length) { narrShow(nv.i + 1); return; }
    nv.seen = true;                      /* 這次瀏覽只播一次 */
    nv.el.classList.remove('is-on');
  }
  function narrHide() {
    if (!nv.el) return;
    clearTimeout(nv.startTimer); clearInterval(nv.typing); clearTimeout(nv.quipTimer);
    nv.el.classList.remove('is-on');
  }

  /* 摸地瓜的內心旁白：打完字停 3 秒自己淡出，不用按 NEXT */
  var QUIPS = [
    '肚子露出來了。律師說，這叫默示同意。',
    '喵吉拉！！！……好，我撤回。\n看來摸肚子這一項，不在授權範圍內。',
    '回復原狀。這隻貓很懂法律。'
  ];
  var petCount = 0;
  function quip(text) {
    if (!nv.el) return;
    nv.seen = true;                      /* 開始摸貓，開場旁白就算看過了 */
    clearTimeout(nv.startTimer); clearInterval(nv.typing); clearTimeout(nv.quipTimer);
    nv.el.classList.add('is-quip', 'is-on');
    nvTime.hidden = true; nvText.textContent = '';
    function done() { nv.quipTimer = setTimeout(function () { nv.el.classList.remove('is-on'); }, 3000); }
    if (reduce) { nvText.textContent = text; done(); return; }
    var n = 0, hold = 0;
    nv.typing = setInterval(function () {
      if (hold > 0) { hold--; return; }
      n++; nvText.textContent = text.slice(0, n);
      if (text.charAt(n - 1) === '\n') hold = 8;   /* 換行前停頓一下 */
      if (n >= text.length) { clearInterval(nv.typing); done(); }
    }, 55);
  }

  /* 等電梯（與門組）縮放真正結束才關門，不用固定秒數去猜 */
  function carSettled() {
    var car = root.querySelector('.lkl-car');
    return new Promise(function (res) {
      if (reduce) { res(); return; }
      var done = false;
      function fin() { if (done) return; done = true; car.removeEventListener('transitionend', onEnd); res(); }
      function onEnd(e) { if (e.target === car && e.propertyName === 'transform') fin(); }
      car.addEventListener('transitionend', onEnd);
      setTimeout(fin, 1700);
    });
  }
  async function stepIn() {
    narrHide();
    await toTop();
    roamG(false);
    if (st.at === 'G') setGPageNow(1);     /* 離開 G：G 內部頁面回到 P1，不影響電梯狀態 */
    if (st.zoom) { camReset(st.at, 1100); st.zoom = false; await wait(1000); }
    if (st.at === 'G') await prepareGLayers();
    var settled = carSettled();
    if (st.at === 'G' && window.performance && performance.mark) performance.mark('lkl-g-step-in');
    root.classList.remove('is-out'); st.out = false;
    await settled;
    if (st.at === 'G') clearGLayers();
  }
  async function returnToElevator() {
    if (st.busy || !st.out) return;
    st.busy = true;
    await stepIn();
    if (st.open) {
      root.classList.remove('is-open');
      st.open = false;
      await wait(1000);
    }
    st.busy = false;
  }

  async function goTo(f) {
    if (st.busy) return;
    st.busy = true;
    root.classList.remove('is-lobby');
    /* P3 點下樓層鍵就開始下載與 decode；電梯移動期間在背景準備，門打開前必須 ready。 */
    var targetReady = f === 'P3' ? loadAndDecode(P3_IMAGE) : Promise.resolve();

    if (st.out) {
      if (f === st.at) { st.busy = false; return; }
      await stepIn();
    }
    if (st.open && f === st.at) { await stepOut(); st.busy = false; if (f === 'RF') narrate(); return; }

    light(f);
    if (st.open) { root.classList.remove('is-open'); st.open = false; await wait(1000); }

    var from = ORDER.indexOf(st.at), to = ORDER.indexOf(f);
    if (from !== to) {
      var step = to > from ? 1 : -1;
      for (var i = from + step; i !== to; i += step) await wait(560);
    }
    await wait(480);

    st.at = f;
    if (f === 'G') {
      setGPageNow(1);                       /* 抵達 G：門後與進場都先看到 P1 */
      await Promise.all([ensureGPage(1), loadAndDecode(currentElevatorImage())]);
    }
    if (f === 'P3') await targetReady;
    showScene(f);
    root.setAttribute('data-at', f);
    if (f === 'RF') setCatState(0);

    if (f === 'G') await prepareGLayers(); /* 門仍關閉時先完成 decode、scene 與 layer commit */

    if (f === 'G' && window.performance && performance.mark) performance.mark('lkl-g-door-open');
    root.classList.add('is-open'); st.open = true;
    await wait(1100);
    await stepOut();
    st.busy = false;
    syncNav(f);
    if (f === 'RF') narrate();
  }

  /* ---------- 導覽列：Free Download（/about/?floor=G）與電梯共用同一個 G ---------- */
  function syncNav(f) {
    var url = window.location.pathname + (f === 'G' ? '?floor=G' : '');
    if (window.location.pathname + window.location.search !== url && window.history.replaceState) {
      try { window.history.replaceState(null, '', url + window.location.hash); } catch (err) { /* 預覽環境可能不允許 */ }
    }
    $$('.editorial-desktop-nav a, .editorial-service-menu a', document).forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var on = f === 'G' ? href === '/about/?floor=G' : href === '/about/';
      if (href === '/about/?floor=G' || href === '/about/') {
        a.classList.toggle('is-current', on);
        if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      }
    });
  }
  function requestFloor(f) {
    if (!FLOORS[f]) return;
    if (st.busy) { setTimeout(function () { requestFloor(f); }, 200); return; }
    if (st.out && st.at === f) return;
    goTo(f);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var url;
    try { url = new URL(a.getAttribute('href'), window.location.href); } catch (err) { return; }
    var f = url.searchParams.get('floor');
    var aboutLink = /\/about\/?$/.test(url.pathname) || url.pathname === window.location.pathname;
    if (!FLOORS[f] || !aboutLink) return;      /* 本頁就是電梯頁：直接走電梯，不換頁、不會 404 */
    e.preventDefault();                         /* 已在 /about/：不重新載入，直接搭電梯 */
    var toggle = document.querySelector('.editorial-service-toggle[aria-expanded="true"]');
    if (toggle) toggle.click();
    requestFloor(f);
  });

  /* 直接以 /about/?floor=G 進站：停在 G 的電梯裡，稍後自動開門走出去 */
  (function () {
    var f = new URLSearchParams(window.location.search).get('floor');
    if (FLOORS[f]) setTimeout(function () { requestFloor(f); }, reduce ? 0 : 600);
  })();

  /* 裝置轉向：保留所在樓層與電梯狀態，只重新換算構圖；走近狀態因兩種構圖不同而先退回 */
  function onModeChange() {
    fitHeader();
    if (st.at === 'G' && st.out) roamG(isM());
    if (st.zoom) { camReset(st.at, 0); st.zoom = false; }
  }
  if (portrait.addEventListener) portrait.addEventListener('change', onModeChange);
  else if (portrait.addListener) portrait.addListener(onModeChange);

  async function walkTo(key) {
    if (st.busy || st.zoom) return;
    st.busy = true; st.zoom = true;
    camTo(st.at, zoomOf(key));
    await wait(1300);
    st.busy = false;
  }
  async function walkBack() {
    if (st.busy || !st.zoom || st.at === 'P3') return;
    st.busy = true;
    camReset(st.at); st.zoom = false;
    await wait(1300);
    st.busy = false;
  }

  var catTimer;
  function setCatState(next) {
    var sc = scene('RF');
    var belly = $('.lkl-belly', sc), yawn = $('.lkl-yawn', sc);
    clearTimeout(catTimer);
    catState = next;
    if (next === 0) {            /* 回到原本姿勢：上層淡出 */
      yawn.classList.remove('is-on'); belly.classList.remove('is-on');
    } else if (next === 1) {     /* 翻肚：淡入 */
      belly.classList.add('is-on'); yawn.classList.remove('is-on');
    } else {                     /* 喵吉拉：蓋在翻肚上淡入，完成後再收掉翻肚 */
      yawn.classList.add('is-on');
      catTimer = setTimeout(function () { belly.classList.remove('is-on'); }, 320);
    }
  }
  function pet() {
    setCatState((catState + 1) % 3);
    if (petCount < QUIPS.length) quip(QUIPS[petCount]);
    petCount++;
  }
  root.addEventListener('click', function (e) {
    var t = e.target.closest('button');
    if (!t || !root.contains(t)) return;
    if (t.matches('.lkl-call')) { goTo(t.getAttribute('data-floor')); return; }
    if (t.matches('.lkl-return')) { returnToElevator(); return; }
    var gn = t.closest('.lkl-gnav');
    if (gn && !gn.disabled) {
      var targetGPage = +gn.getAttribute('data-gpage');
      if (targetGPage === 5) playGFinaleFromGesture();
      else resetGFinale();
      openGPage(targetGPage);
      if (scene('G').classList.contains('is-roam')) scene('G').scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }
    if (t.matches('.lkl-gvideo-sound')) { playGFinaleFromGesture(); return; }
    if (t.matches('.lkl-narr-next')) { narrNext(); return; }
    if (t.matches('.lkl-unzoom')) { walkBack(); return; }
    var a = t.getAttribute('data-action');
    if (a === 'cat') pet();
    else if (zoomOf(a)) walkTo(a);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') walkBack(); });
})();
