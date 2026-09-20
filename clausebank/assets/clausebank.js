window.setActivePage=function(page,btn){
  var section=document.getElementById(page);
  if(!section) return;
  document.querySelectorAll('.page').forEach(function(item){
    item.style.setProperty('display',item===section?'block':'none','important');
  });
  document.querySelectorAll('.nav-item').forEach(function(item){
    item.classList.toggle('active',item.getAttribute('data-page')===page);
  });
  window.scrollTo(0,0);
};

function toggle(card){
  if(!card || card.classList.contains('short-clause')) return;
  card.classList.toggle('open');
  const arrow=card.querySelector('.arrow');
  if(arrow){
    const open=card.classList.contains('open');
    arrow.textContent=open?'⌃':'⌄';
    arrow.setAttribute('aria-expanded',String(open));
  }
}

function filterCards(cat,btn){
  document.querySelectorAll('.filters>button').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  document.querySelectorAll('.card').forEach(function(card){
    card.style.display=(cat==='all'||card.dataset.cat===cat)?'block':'none';
  });
}

function setLanguage(mode,btn){
  if(!['zh','en','both'].includes(mode)) mode='zh';

  document.querySelectorAll('.lang button').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');

  document.body.classList.remove('zh-mode','en-mode','bilingual-mode');
  document.body.classList.add(mode==='en'?'en-mode':mode==='both'?'bilingual-mode':'zh-mode');

  document.querySelectorAll('#vault .pizza-zh').forEach(function(section){
    section.style.setProperty('display',mode==='en'?'none':'block','important');
  });
  document.querySelectorAll('#vault .pizza-en').forEach(function(section){
    section.style.setProperty('display',mode==='zh'?'none':'block','important');
  });

  document.querySelectorAll('.long-clause').forEach(function(card){
    const zh=card.querySelector('.clause.zh');
    const en=card.querySelector('.clause.en-copy');
    const pzh=card.querySelector('.preview-zh');
    const pen=card.querySelector('.preview-en');
    if(!zh || !en || !pzh || !pen) return;

    pzh.textContent=zh.innerText.replace(/\s+/g,' ').trim();
    pen.textContent=en.innerText.replace(/\s+/g,' ').trim();
  });
}

function copyClause(e,btn){
  e.stopPropagation();
  const body=btn.closest('.body');
  const zh=body.querySelector('.clause.zh');
  const en=body.querySelector('.clause.en-copy');
  const bilingual=document.body.classList.contains('bilingual-mode');
  let text='';
  if(bilingual){
    text=(zh?zh.innerText:'')+'\n\n'+(en?en.innerText:'');
  }else if(document.body.classList.contains('en-mode')){
    text=en?en.innerText:'';
  }else{
    text=zh?zh.innerText:'';
  }
  const done=function(){
    btn.textContent='已複製　COPIED';
    btn.classList.add('copied');
    setTimeout(function(){btn.textContent='複製　COPY';btn.classList.remove('copied');},1300);
    if(window.ClauseCopyCount) window.ClauseCopyCount.incrementForButton(btn);
  };
  if(navigator.clipboard && window.isSecureContext){
    navigator.clipboard.writeText(text).then(done).catch(function(){fallbackCopy(text,done);});
  }else{
    fallbackCopy(text,done);
  }
}

function fallbackCopy(text,done){
  const ta=document.createElement('textarea');
  ta.value=text;
  ta.style.position='fixed';
  ta.style.left='-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try{document.execCommand('copy');done();}catch(err){}
  ta.remove();
}

document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.long-clause').forEach(function(card){
    const head=card.querySelector('.cardhead');
    if(head) head.onclick=function(event){
      // The arrow has its own inline toggle handler; do not toggle again on bubbling.
      if(event.target.closest('.clause-expand')) return;
      // Keep crawlable semantic links, but make the full header a toggle on mobile.
      if(window.matchMedia('(max-width:700px)').matches && event.target.closest('.clause-semantic-link')){
        event.preventDefault();
      }
      toggle(card);
    };
  });
  const active=document.querySelector('.lang button.active');
  setLanguage('zh',active);
});

(function(){
  'use strict';
  /* Public browser credentials only. Never place a secret or service_role key here. */
var SUPABASE_URL='https://vvkvwxjerjejrenkteeg.supabase.co';
var SUPABASE_PUBLISHABLE_KEY='sb_publishable_V-GBA8xcWu3h9aMjLk5JuA_2LX_KzkJ';
  var REQUEST_TIMEOUT_MS=4500;
  var countByCode=new Map();
  var elementByCode=new Map();

  function isConfigured(){
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && /^sb_publishable_/i.test(SUPABASE_PUBLISHABLE_KEY);
  }
  function codeFromCard(card){
    var code=card&&card.querySelector('.code');
    return code?code.textContent.trim():'';
  }
  function showCount(code,value){
    var number=Number(value);
    var element=elementByCode.get(code);
    if(!element||!Number.isFinite(number)||number<0) return;
    var current=countByCode.get(code);
    if(Number.isFinite(current)&&number<current) return;
    countByCode.set(code,number);
    element.textContent=number.toLocaleString('en-US',{maximumFractionDigits:0});
    element.hidden=false;
  }
  function request(path,options){
    var controller=new AbortController();
    var timer=setTimeout(function(){controller.abort();},REQUEST_TIMEOUT_MS);
    var settings=Object.assign({},options||{}, {
      signal:controller.signal,
      headers:Object.assign({apikey:SUPABASE_PUBLISHABLE_KEY},(options&&options.headers)||{})
    });
    return fetch(SUPABASE_URL.replace(/\/$/,'')+path,settings).finally(function(){clearTimeout(timer);});
  }
  function mountCounters(){
    document.querySelectorAll('#vault .clause-library .card').forEach(function(card){
      var code=codeFromCard(card);
      var button=card.querySelector('.body > .copy');
      if(!code||!button||elementByCode.has(code)) return;
      var row=document.createElement('div');
      row.className='copy-action-row';
      var count=document.createElement('span');
      count.className='copy-count';
      count.hidden=true;
      count.setAttribute('aria-label','全站累計複製次數');
      button.parentNode.insertBefore(row,button);
      row.appendChild(button);
      row.appendChild(count);
      elementByCode.set(code,count);
    });
  }
  function loadCounts(){
    if(!isConfigured()) return Promise.resolve();
    return request('/rest/v1/clause_copy_counts?select=clause_code,copy_count',{method:'GET'})
      .then(function(response){if(!response.ok) throw new Error('Copy count load failed');return response.json();})
      .then(function(rows){if(Array.isArray(rows)) rows.forEach(function(row){showCount(row.clause_code,row.copy_count);});})
      .catch(function(){});
  }
  function incrementForButton(button){
    if(!isConfigured()) return;
    var code=codeFromCard(button&&button.closest('.card'));
    if(!code) return;
    request('/rest/v1/rpc/increment_clause_copy_count',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({p_clause_code:code})
    }).then(function(response){if(!response.ok) throw new Error('Copy count increment failed');return response.json();})
      .then(function(value){showCount(code,value);})
      .catch(function(){});
  }
  window.ClauseCopyCount={incrementForButton:incrementForButton};
  function init(){mountCounters();loadCounts();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

(function(){
  function orderCompleteAgreementCards(){
    var anchor=document.querySelector('[data-search^="IA-01 "]');
    if(!anchor) return;
    var cursor=anchor;
    ['IA-02 ','IA-03 ','IA-04 ','IA-05 '].forEach(function(code){
      var card=document.querySelector('[data-search^="'+code+'"]');
      if(!card) return;
      cursor.insertAdjacentElement('afterend',card);
      cursor=card;
    });
  }
  function orderLiquidatedDamagesCards(){
    var first=document.querySelector('[data-search^="LD-01 "]');
    var second=document.querySelector('[data-search^="LD-02 "]');
    var third=document.querySelector('[data-search^="LD-03 "]');
    if(!first||!second||!third) return;
    first.insertAdjacentElement('afterend',second);
    second.insertAdjacentElement('afterend',third);
  }
  function orderCards(){
    orderCompleteAgreementCards();
    orderLiquidatedDamagesCards();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',orderCards);
  else orderCards();
})();

(function(){
  function initMobileToolbarFreeze(){
    var toolbar=document.querySelector('#vault .toolbar');
    var spacer=document.querySelector('#vault .toolbar-spacer');
    if(!toolbar||!spacer) return;
    var mobileQuery=window.matchMedia('(max-width:700px)');
    var freezeAt=0;
    var ticking=false;

    function measure(){
      toolbar.classList.remove('mobile-toolbar-fixed');
      spacer.classList.remove('mobile-toolbar-spacer-active');
      spacer.style.height='';
      freezeAt=toolbar.getBoundingClientRect().top+window.scrollY;
      update();
    }
    function update(){
      if(!mobileQuery.matches){
        toolbar.classList.remove('mobile-toolbar-fixed');
        spacer.classList.remove('mobile-toolbar-spacer-active');
        spacer.style.height='';
        ticking=false;
        return;
      }
      var shouldFreeze=window.scrollY>=freezeAt;
      if(shouldFreeze){
        spacer.style.height=toolbar.offsetHeight+'px';
        spacer.classList.add('mobile-toolbar-spacer-active');
        toolbar.classList.add('mobile-toolbar-fixed');
      }else{
        toolbar.classList.remove('mobile-toolbar-fixed');
        spacer.classList.remove('mobile-toolbar-spacer-active');
        spacer.style.height='';
      }
      ticking=false;
    }
    function requestUpdate(){
      if(ticking) return;
      ticking=true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll',requestUpdate,{passive:true});
    window.addEventListener('resize',measure);
    if(mobileQuery.addEventListener) mobileQuery.addEventListener('change',measure);
    measure();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initMobileToolbarFreeze);
  else initMobileToolbarFreeze();
})();

(function(){
  function init(){
  var button=document.querySelector('.back-to-top');
  if(!button) return;
  var footer=document.querySelector('.site-footer');
  var reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  var mobileQuery=window.matchMedia('(max-width:700px)');
  var ticking=false;
  function vaultVisible(){
    var vault=document.getElementById('vault');
    return vault && getComputedStyle(vault).display!=='none';
  }
  function update(){
    var visible=vaultVisible();
    var show=visible && window.scrollY>Math.max(420,window.innerHeight*.7);
    button.classList.toggle('is-visible',show);
    var base=mobileQuery.matches?12:18;
    var lift=base;
    if(footer && visible){
      var rect=footer.getBoundingClientRect();
      if(rect.top<window.innerHeight&&rect.bottom>0){
        lift=Math.max(base,window.innerHeight-rect.top+12);
      }
    }
    button.style.setProperty('--back-top-bottom',lift+'px');
    ticking=false;
  }
  function requestUpdate(){
    if(ticking) return;
    ticking=true;
    requestAnimationFrame(update);
  }
  button.addEventListener('click',function(){
    window.scrollTo({top:0,behavior:reduceMotion.matches?'auto':'smooth'});
  });
  window.addEventListener('scroll',requestUpdate,{passive:true});
  window.addEventListener('resize',requestUpdate);
  document.querySelectorAll('.nav-item').forEach(function(item){
    item.addEventListener('click',function(){setTimeout(requestUpdate,0);});
  });
  update();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

(function(){
  function focusClause(){
    var targetCode=document.body.getAttribute('data-clause-code');
    if(!targetCode) return;
    var card=Array.from(document.querySelectorAll('#vault .clause-library .card')).find(function(item){
      var code=item.querySelector('.code');
      return code&&code.textContent.trim()===targetCode;
    });
    if(!card) return;
    card.style.removeProperty('display');
    card.classList.add('open');
    var arrow=card.querySelector('.arrow');
    if(arrow) arrow.textContent='⌃';
    function scrollCard(){
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){card.scrollIntoView({block:'center',behavior:'auto'});});
      });
    }
    scrollCard();
    window.addEventListener('load',scrollCard,{once:true});
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(scrollCard);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',focusClause);
  else focusClause();
})();
