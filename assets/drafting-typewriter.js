(() => {
  const draft = document.querySelector('#draft .td-shell');
  if (!draft) return;

  // Keep the four service descriptions and prices supplied for this page.
  const services = [
    {
      name: '簡式契約',
      description: '適合一般交易及日常法律文件。',
      types: '買賣、使用、委任、保密、保證、贈與、借貸、承攬',
      basis: '1－3頁 NT$ 3,000',
      price: '4－5頁 NT$ 5,000'
    },
    {
      name: '完整契約',
      description: '適合完整履約責任、違約責任或合作架構之正式契約',
      types: '商務合作、股東協議、投資開發、合夥合資、工程承攬、\n信託規劃、技術服務、顧問服務、平台、代理、經銷、加盟',
      basis: '20頁以內',
      price: 'NT$ 15,000－20,000'
    },
    {
      name: '複雜契約',
      description: '適合涉及多方交易、跨國交易、重大投資或融資，以及高度專業技術。',
      types: '大型投資、軟體授權、融資、SaaS、股權設計、智慧財產權規劃、\n併購、跨國商務、PPM、私募基金、技術移轉、特殊交易架構',
      basis: '不限頁數',
      price: 'NT$ 20,000－30,000'
    },
    {
      name: '專業法律文件',
      description: '提供各式專業法律文件服務，涵蓋公司商務、正式函件，個人法律文件',
      types: '公司章程、公司設立登記、公司內部規章、工作規則辦法、內部控制文件\n催告函、存證信函、律師函、法律意見書、法律聲明、風險揭露、\n會員平台規範、網站使用條款、隱私權政策\n遺囑、遺產分配、和解協議、離婚協議、授權委託、切結書',
      basis: '計價基準相同',
      price: '依實際內容評估'
    }
  ];

  const paper = draft.querySelector('.td-paper');
  const content = draft.querySelector('.td-paper-content');
  const keys = Array.from(draft.querySelectorAll('.td-key:not([data-key="reset"])'));
  const resetKey = draft.querySelector('.td-key[data-key="reset"]');
  const status = draft.querySelector('[role="status"]');
  const fields = {
    name: draft.querySelector('.td-paper-name'),
    description: draft.querySelector('.td-paper-description'),
    inlineTypes: draft.querySelector('.td-paper-inline-types'),
    basis: draft.querySelector('.td-paper-basis'),
    price: draft.querySelector('.td-paper-price'),
    secondPrice: draft.querySelector('.td-paper-price-sub')
  };
  let generation = 0;

  function clearPaper() {
    Object.values(fields).forEach(node => { node.textContent = ''; });
    status.textContent = '';
  }

  function typeText(node, value, token, done) {
    const characters = Array.from(value);
    let position = 0;
    const step = () => {
      if (token !== generation) return;
      if (position >= characters.length) { done(); return; }
      node.textContent += characters[position++];
      const typed = characters[position - 1];
      const pace = node === fields.name ? 120 : node === fields.price ? 110 : 86;
      setTimeout(step, /[，。、；：]/.test(typed) ? 250 : pace + (position % 5) * 9);
    };
    step();
  }

  function finish(service, token) {
    if (token !== generation) return;
    paper.removeAttribute('aria-busy');
    status.textContent = `${service.name}。內容已打在紙上。`;
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
        [fields.inlineTypes, service.types],
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
        typeText(node, value, token, () => setTimeout(typeNext, 140));
      };
      typeNext();
    }, 180);
  }

  clearPaper();
  keys.forEach((key, index) => key.addEventListener('click', () => select(index)));
  resetKey?.addEventListener('click', () => {
    ++generation;
    keys.forEach(key => {
      key.classList.remove('is-pressed');
      key.setAttribute('aria-pressed', 'false');
    });
    paper.classList.remove('is-changing');
    paper.dataset.active = 'false';
    paper.removeAttribute('aria-busy');
    clearPaper();
    content.hidden = true;
  });
})();
