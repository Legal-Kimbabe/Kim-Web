(() => {
  const draft = document.querySelector('#draft .td-shell');
  if (!draft) return;

  // Copy and prices are carried over from the previous four service cards.
  const services = [
    {
      name: '簡式契約',
      description: '一般交易與日常法律文件，權利義務相對明確。',
      fullDescription: '適合一般交易及日常法律文件，內容單純、權利義務關係較為明確之案件。',
      basis: '1－3頁', price: 'NT$ 3,000', secondPrice: '4－5頁｜NT$ 5,000',
      types: [['常見類型', '買賣、使用、委任、保密、服務、保證、贈與、借貸、承攬']]
    },
    {
      name: '完整契約',
      description: '付款、履約與違約責任較多的正式契約。',
      fullDescription: '適合涉及多項權利義務、付款機制、履約責任、違約責任或合作架構之正式契約',
      basis: '20頁以內', price: 'NT$ 15,000－20,000', secondPrice: '',
      types: [['常見類型', '商務合作、股東協議、投資開發、合夥合資、工程承攬、信託規劃、技術服務、顧問服務、複合型契約、平台／電商、代理／經銷／加盟']]
    },
    {
      name: '複雜契約',
      description: '多方、跨國、重大投融資或高度專業技術案件。',
      fullDescription: '適合涉及多方交易、跨國交易、重大投資或融資，以及高度專業技術等案件',
      basis: '', price: 'NT$ 20,000－30,000', secondPrice: '',
      types: [['常見類型', '大型投資契約、軟體授權、融資／投資、SaaS／軟體服務、股權投資／轉讓、智慧財產權複合授權、併購／分割、跨國商務、PPM、多方合作架構、技術移轉、特殊交易架構']]
    },
    {
      name: '專業法律文件',
      description: '公司商務、正式函件與個人法律文件。',
      fullDescription: '依個案需求，提供各式專業法律文件服務，涵蓋公司商務、正式函件，以及個人法律文件',
      basis: '計價基準相同', price: '依實際內容評估', secondPrice: '',
      types: [
        ['公司治理', '公司章程、公司設立登記文件、公司內部規章、公司工作規則辦法、內部控制文件、公司治理相關文件'],
        ['商務函件與規範', '催告函、存證信函、律師函、法律意見書、意向書、法律聲明、風險揭露文件、會員／平台規範、個人資料、網站使用條款、隱私權政策'],
        ['個人法律文件', '遺囑、遺產分配、和解協議、離婚協議、授權委託、切結書']
      ]
    },
    {
      name: '怎麼開始',
      description: '把你想約定的事告訴我。標準稿每頁約 500－600 字。',
      fullDescription: '',
      basis: '報價依內容、法律關係與個案需求評估',
      price: '初步諮詢免費',
      secondPrice: '提供 Word 可編輯檔；是否承接依個案評估',
      types: [], guide: true
    }
  ];

  const paper = draft.querySelector('.td-paper');
  const content = draft.querySelector('.td-paper-content');
  const details = draft.querySelector('.td-paper-more');
  const keys = Array.from(draft.querySelectorAll('.td-key'));
  const status = draft.querySelector('.td-screenreader');
  const fields = {
    name: draft.querySelector('.td-paper-name'),
    description: draft.querySelector('.td-paper-description'),
    basis: draft.querySelector('.td-paper-basis'),
    price: draft.querySelector('.td-paper-price'),
    secondPrice: draft.querySelector('.td-paper-price-sub')
  };
  const link = draft.querySelector('.td-paper-link');
  let generation = 0;

  function clearPaper() {
    Object.values(fields).forEach(node => { node.textContent = ''; });
    draft.querySelector('.td-paper-types').replaceChildren();
    details.open = false;
    details.hidden = true;
    link.hidden = true;
    status.textContent = '';
  }

  function appendTypes(service) {
    const target = draft.querySelector('.td-paper-types');
    const fullDescription = document.createElement('p');
    fullDescription.className = 'td-full-description';
    fullDescription.textContent = service.fullDescription;
    target.append(fullDescription);
    service.types.forEach(([heading, body]) => {
      const group = document.createElement('div');
      group.className = 'td-type-group';
      const title = document.createElement('h3');
      title.textContent = heading;
      const copy = document.createElement('p');
      copy.textContent = body;
      group.append(title, copy);
      target.append(group);
    });
  }

  function typeText(node, value, token, done) {
    const characters = Array.from(value);
    let position = 0;
    const step = () => {
      if (token !== generation) return;
      if (position >= characters.length) { done(); return; }
      node.textContent += characters[position++];
      const typed = characters[position - 1];
      const pace = node === fields.name ? 78 : node === fields.price ? 72 : 52;
      setTimeout(step, /[，。、；：]/.test(typed) ? 155 : pace + (position % 5) * 7);
    };
    step();
  }

  function finish(service, token) {
    if (token !== generation) return;
    if (!service.guide) {
      appendTypes(service);
      details.hidden = false;
    }
    link.hidden = false;
    paper.removeAttribute('aria-busy');
    status.textContent = `${service.name}，${service.price}。內容已打在紙上。`;
  }

  function select(index) {
    const service = services[index];
    const token = ++generation;
    keys.forEach((key, i) => {
      const selected = i === index;
      key.classList.toggle('is-pressed', selected);
      key.setAttribute('aria-pressed', String(selected));
    });
    paper.classList.add('is-changing');
    paper.dataset.active = 'true';
    paper.setAttribute('aria-busy', 'true');
    content.hidden = false;
    clearPaper();

    // The keys may sit below the fold on a short desktop viewport. Keep the
    // paper in view so the response is visibly attached to the pressed key.
    setTimeout(() => {
      if (token !== generation) return;
      const rect = paper.getBoundingClientRect();
      if (rect.top < 100 || rect.bottom > window.innerHeight - 40) {
        paper.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'center'
        });
      }
    }, 90);

    setTimeout(() => {
      if (token !== generation) return;
      paper.classList.remove('is-changing');
      const entries = [
        [fields.name, service.name],
        [fields.description, service.description],
        [fields.basis, service.basis],
        [fields.price, service.price],
        [fields.secondPrice, service.secondPrice]
      ].filter(([, value]) => value);
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        entries.forEach(([node, value]) => { node.textContent = value; });
        finish(service, token);
        return;
      }
      let next = 0;
      const typeNext = () => {
        if (token !== generation) return;
        if (next >= entries.length) { finish(service, token); return; }
        const [node, value] = entries[next++];
        typeText(node, value, token, () => setTimeout(typeNext, 60));
      };
      typeNext();
    }, 180);
  }

  clearPaper();
  keys.forEach((key, index) => key.addEventListener('click', () => select(index)));
})();
