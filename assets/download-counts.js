(function(){
  'use strict';
  /* Public browser credentials only. Never place a secret or service_role key here. */
  var SUPABASE_URL='https://vvkvwxjerjejrenkteeg.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY='sb_publishable_V-GBA8xcWu3h9aMjLk5JuA_2LX_KzkJ';
  var REQUEST_TIMEOUT_MS=4500;
  var CLICK_COOLDOWN_MS=3000;
  var countById=new Map();
  var elementById=new Map();
  var lastIncrementAtById=new Map();

  function isConfigured(){
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) && /^sb_publishable_/i.test(SUPABASE_PUBLISHABLE_KEY);
  }
  function showCount(id,value){
    var number=Number(value);
    var element=elementById.get(id);
    if(!element||!Number.isFinite(number)||number<0) return;
    var current=countById.get(id);
    if(Number.isFinite(current)&&number<current) return;
    countById.set(id,number);
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
    document.querySelectorAll('.lkl-dl[data-download-id]').forEach(function(link){
      var id=link.dataset.downloadId;
      if(!id||elementById.has(id)) return;
      var count=document.createElement('span');
      count.className='lkl-dl-count';
      count.hidden=true;
      count.setAttribute('aria-label','全站累計下載次數');
      link.appendChild(count);
      elementById.set(id,count);
      link.addEventListener('click',function(){increment(id);});
    });
  }
  function loadCounts(){
    if(!isConfigured()) return Promise.resolve();
    return request('/rest/v1/download_counts?select=download_id,download_count',{method:'GET'})
      .then(function(response){if(!response.ok) throw new Error('Download count load failed');return response.json();})
      .then(function(rows){if(Array.isArray(rows)) rows.forEach(function(row){showCount(row.download_id,row.download_count);});})
      .catch(function(){});
  }
  function increment(id){
    if(!isConfigured()||!elementById.has(id)) return;
    var now=Date.now();
    var lastIncrementAt=lastIncrementAtById.get(id);
    if(Number.isFinite(lastIncrementAt)&&now-lastIncrementAt<CLICK_COOLDOWN_MS) return;
    lastIncrementAtById.set(id,now);
    request('/rest/v1/rpc/increment_download_count',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({p_download_id:id})
    }).then(function(response){if(!response.ok) throw new Error('Download count increment failed');return response.json();})
      .then(function(value){showCount(id,value);})
      .catch(function(){});
  }
  function init(){mountCounters();loadCounts();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
