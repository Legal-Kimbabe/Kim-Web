(function(){
 const root=document.getElementById('about-elevator-prototype'); if(!root)return;
 const about=document.getElementById('about'); about&&about.classList.add('about-elevator-on');
 const stage=root.querySelector('.ae-stage'), floors=[...root.querySelectorAll('.ae-floor')], buttons=[...root.querySelectorAll('.ae-button')];
 const status=root.querySelector('.ae-status'), modal=root.querySelector('.ae-modal'), modalBody=root.querySelector('.ae-modal-body'), p3Close=root.querySelector('.ae-p3-closeup');
 let floor='P3', moving=false, catState=0; stage.dataset.floor=floor; root.classList.add('is-awake');
 function setFloor(next){
  if(moving||next===floor)return; moving=true; p3Close.classList.remove('is-open'); stage.classList.remove('is-inside-rf'); stage.classList.add('is-moving'); status.textContent='MOVING · '+next;
  setTimeout(()=>{floor=next; stage.dataset.floor=floor; floors.forEach(x=>x.classList.toggle('is-active',x.dataset.floor===floor));buttons.forEach(x=>x.classList.toggle('is-active',x.dataset.floor===floor));status.textContent=floor;},620);
  setTimeout(()=>{stage.classList.remove('is-moving');moving=false;},1220);
 }
 buttons.forEach(b=>b.addEventListener('click',()=>setFloor(b.dataset.floor)));
 const sourcePanels=[...document.querySelectorAll('#about .team-photo-panel')];
 root.querySelectorAll('.ae-p2-person').forEach((board,i)=>{const target=board.querySelector('.ae-p2-board-content');if(sourcePanels[i])target.innerHTML=sourcePanels[i].innerHTML;board.addEventListener('click',()=>{if(sourcePanels[i])openModal('<article class="ae-credential">'+sourcePanels[i].innerHTML+'</article>')})});
 function openModal(html){modalBody.innerHTML=html;modal.classList.add('is-open');modal.setAttribute('aria-hidden','false');const close=root.querySelector('.ae-modal-close');close&&close.focus({preventScroll:true});}
 function closeModal(){modal.classList.remove('is-open');modal.setAttribute('aria-hidden','true');modalBody.innerHTML='';}
 root.querySelector('.ae-modal-close').addEventListener('click',closeModal); modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
 root.querySelector('.ae-floor-rf .ae-enter').addEventListener('click',()=>stage.classList.add('is-inside-rf'));
 root.querySelector('.ae-back-to-lift').addEventListener('click',()=>stage.classList.remove('is-inside-rf'));
 root.querySelector('.ae-dossier').addEventListener('click',()=>{
  const src=document.querySelector('#about .about-intro-inner');
  openModal('<h2>金法務在線</h2>'+(src?src.innerHTML:''));
 });
 root.querySelector('.ae-tribute').addEventListener('click',()=>openModal('<h2>LEGAL KIM</h2><p>Our little tribute to two unforgettable legal-and-crime dramas.</p><p><em>Inspired by the shows we love.</em><br><strong>Built for contracts we actually use.</strong></p>'));
 root.querySelector('.ae-talk').addEventListener('click',()=>{location.href='mailto:Kim.Br35Ba56@gmail.com?subject=%5B%E5%85%8D%E8%B2%BB%E5%88%9D%E6%AD%A5%E8%AB%AE%E8%A9%A2%5D%20%E5%85%B6%E4%BB%96%E6%B3%95%E5%BE%8B%E9%9C%80%E6%B1%82'});
 root.querySelector('.ae-lamp').addEventListener('click',()=>root.classList.toggle('lamp-off'));
 root.querySelector('.ae-typewriter').addEventListener('click',e=>{const seq=['§','§ K','§ KI','§ KIM'];let i=+e.currentTarget.dataset.i||0;const value=seq[i];e.currentTarget.dataset.i=(i+1)%seq.length;e.currentTarget.setAttribute('aria-label','打字機 '+value);status.textContent=value;const paper=root.querySelector('.ae-type-paper');paper.textContent=value;paper.classList.add('is-visible')});
 root.querySelector('.ae-cat').addEventListener('click',e=>{catState++;const belly=catState%2===1;e.currentTarget.classList.toggle('is-belly',belly);status.textContent=belly?'地瓜翻肚 ♡':'喵～';try{const AC=window.AudioContext||window.webkitAudioContext;if(AC){const ac=new AC(),o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.setValueAtTime(520,ac.currentTime);o.frequency.exponentialRampToValueAtTime(330,ac.currentTime+.16);g.gain.setValueAtTime(.025,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.18);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.18);}}catch(_){}});
 root.querySelector('.ae-p2-open').addEventListener('click',()=>{
  const panels=[...document.querySelectorAll('#about .team-photo-panel')];
  openModal('<div class="ae-credentials">'+panels.map(p=>'<article class="ae-credential">'+p.innerHTML+'</article>').join('')+'</div>');
 });
 root.querySelectorAll('.ae-p3-open,.ae-p3-hint').forEach(el=>el.addEventListener('click',()=>p3Close.classList.add('is-open'))); p3Close.addEventListener('click',()=>p3Close.classList.remove('is-open'));
})();