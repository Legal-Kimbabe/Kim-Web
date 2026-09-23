(function () {
  const items = [
    { path: '/clausebank/', zh: '條款金庫', en: 'ClauseBank', mobileEn: 'CLAUSE BANK' },
    { path: '/contract-drafting/', zh: '契約撰寫', en: 'Contract Drafting' },
    { path: '/contract-review/', zh: '契約健檢', en: 'Contract Checkup' },
    { path: '/legal-translation/', zh: '法律翻譯', en: 'Legal Translation' },
    { path: '/about/', zh: '關於我們', en: 'About Us' }
  ];

  function currentPath() {
    const path = window.location.pathname.replace(/\/index\.html$/, '/');
    if (path.startsWith('/clausebank/')) return '/clausebank/';
    return items.some(item => item.path === path) ? path : '';
  }

  function navLink(item, mobile, current) {
    const link = document.createElement('a');
    link.href = item.path;
    if (item.path === current) {
      link.className = 'is-current';
      link.setAttribute('aria-current', 'page');
    }

    const primary = document.createElement('span');
    const secondary = document.createElement('small');
    primary.textContent = mobile ? (item.mobileEn || item.en.toUpperCase()) : item.zh;
    secondary.textContent = mobile ? item.zh : item.en;
    link.append(primary, secondary);
    return link;
  }

  function buildHeader() {
    const current = currentPath();
    const header = document.createElement('header');
    header.className = 'editorial-site-header';

    const brand = document.createElement('a');
    brand.className = 'editorial-brand';
    brand.href = '/';
    brand.setAttribute('aria-label', 'Legal Kim home');
    brand.textContent = 'LEGAL KIM';

    const desktopNav = document.createElement('nav');
    desktopNav.className = 'editorial-desktop-nav';
    desktopNav.setAttribute('aria-label', 'Main navigation');
    items.forEach(item => desktopNav.append(navLink(item, false, current)));

    const toggle = document.createElement('button');
    toggle.className = 'editorial-service-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'editorialServiceOverlay');
    toggle.innerHTML = 'SERVICE<sup>+</sup>';

    header.append(brand, desktopNav, toggle);

    const overlay = document.createElement('div');
    overlay.className = 'editorial-service-overlay';
    overlay.id = 'editorialServiceOverlay';
    overlay.hidden = true;

    const mobileNav = document.createElement('nav');
    mobileNav.className = 'editorial-service-menu';
    mobileNav.setAttribute('aria-label', 'Services');
    items.forEach(item => mobileNav.append(navLink(item, true, current)));
    overlay.append(mobileNav);

    const anchor = document.querySelector('header.hero, main, body > :first-child');
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(header, anchor);
      anchor.parentNode.insertBefore(overlay, anchor);
    } else {
      document.body.prepend(overlay);
      document.body.prepend(header);
    }
    return { header, toggle, overlay };
  }

  function enhance(header, toggle, overlay) {
    if (!header || !toggle || !overlay || header.dataset.editorialEnhanced === 'true') return;
    header.dataset.editorialEnhanced = 'true';

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open ? 'NO THX <sup>−</sup>' : 'SERVICE<sup>+</sup>';
      overlay.hidden = false;
      overlay.classList.toggle('is-open', open);
      document.body.classList.toggle('editorial-menu-open', open);
      if (!open) {
        window.setTimeout(function () {
          if (!overlay.classList.contains('is-open')) overlay.hidden = true;
        }, 300);
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setOpen(false);
        toggle.focus();
      }
    });
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) setOpen(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 700 && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
    });
  }

  function init() {
    let header = document.querySelector('.editorial-site-header');
    let toggle = document.querySelector('.editorial-service-toggle');
    let overlay = document.getElementById('editorialServiceOverlay');

    if (!header) {
      const built = buildHeader();
      header = built.header;
      toggle = built.toggle;
      overlay = built.overlay;
      if (!document.querySelector('script[src*="clausebank.js"]')) enhance(header, toggle, overlay);
    }

    document.documentElement.classList.add('editorial-header-mounted');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
