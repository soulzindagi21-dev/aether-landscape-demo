/* =====================================================================
   AETHER ENGINE  (shared by band.html, product.html, model.html)
   Reads a global `DEMO` object: { brand, entryTagline, homeHref,
   scenes:[...], modals:{...} }. Injects the shell markup, then runs
   the scene/transition/modal/fullscreen system. Do not edit per theme
   — theme content lives in each page's DEMO config.
   ===================================================================== */
(function(){
  const DEMO = window.DEMO || {};
  const BRAND = DEMO.brand || "AETHER";
  const SCENES = DEMO.scenes || [];
  const MODALS = DEMO.modals || {};
  const HOME_HREF = DEMO.homeHref || "index.html";

  /* ---------- inject shared shell markup ---------- */
  document.body.insertAdjacentHTML('afterbegin', `
    <div id="loader"><div style="text-align:center">
      <div class="load-mark" id="loadMark">${BRAND}</div>
      <div class="load-bar"><i></i></div>
    </div></div>

    <div id="entry"><div class="entry-inner">
      <div class="eyebrow" style="text-align:center">${DEMO.entryTagline||'A Cinematic Presentation'}</div>
      <div class="entry-mark">${BRAND}</div>
      <button class="btn solid" id="enterBtn">Enter Experience<span class="arr">→</span></button>
      <p class="entry-hint">Best experienced in landscape &amp; fullscreen</p>
    </div></div>

    <div id="rotate"><div class="rot-inner">
      <div class="phone"></div>
      <h2>ROTATE YOUR DEVICE</h2>
      <p>This experience is composed for landscape. Turn your phone sideways to begin.</p>
      <button class="rot-skip" id="skipPortrait">Continue anyway</button>
    </div></div>

    <div id="app" aria-label="Cinematic experience">
      <div class="env">
        <div class="orb a"></div><div class="orb b"></div><div class="orb c"></div>
        <div class="grain"></div><div class="vignette"></div>
      </div>
      <div class="stage" id="stage"></div>
      <div id="modal" role="dialog" aria-modal="true"><div class="card">
        <div class="card-head"><h3 id="mTitle">Detail</h3>
          <button class="card-close" id="mClose" aria-label="Close">&times;</button></div>
        <div class="tabs" id="mTabs"></div>
        <div class="tab-body" id="mBody"></div>
      </div></div>
      <div class="hud brand-tag" id="brandTag">${BRAND}</div>
      <div class="hud dots" id="dots" role="tablist" aria-label="Scenes"></div>
      <div class="hud ctrls">
        <button class="ic" id="backBtn" aria-label="Back to demos" title="Back to demos">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
        <button class="ic off" id="soundBtn" aria-label="Toggle sound">
          <svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path class="on-path" d="M16 8a5 5 0 0 1 0 8"/><path class="on-path" d="M19 5a9 9 0 0 1 0 14"/></svg></button>
        <button class="ic" id="homeBtn" aria-label="Home"><svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg></button>
      </div>
      <div class="hud scene-count" id="sceneCount"><b>01</b> / 04</div>
    </div>
  `);

  /* ---------- engine ---------- */
  const stage=document.getElementById('stage'), dotsEl=document.getElementById('dots'),
    modal=document.getElementById('modal'), mTitle=document.getElementById('mTitle'),
    mTabs=document.getElementById('mTabs'), mBody=document.getElementById('mBody'),
    countEl=document.getElementById('sceneCount');
  let current=0, busy=false, soundOn=false, audio=null;

  SCENES.forEach((s,i)=>{
    const el=document.createElement('section');
    el.className='scene'; el.dataset.i=i; el.setAttribute('role','tabpanel');
    if(s.bg) el.style.background=s.bg;
    const spots=(s.hotspots||[]).map(h=>
      `<button class="hotspot" style="left:${h.x};top:${h.y}" data-modal="${h.modal}" aria-label="${h.label}">
         <span class="ring"></span><span class="dot"></span><span class="lbl">${h.label}</span></button>`).join('');
    const ctas=(s.ctas||[]).map(c=>{
      const cls='btn'+(c.style==='solid'?' solid':'');
      const attr=c.href?`data-href="${c.href}"`:c.modal?`data-modal="${c.modal}"`:`data-go="${c.go}"`;
      return `<button class="${cls}" ${attr}>${c.label}<span class="arr">→</span></button>`;
    }).join('');
    el.innerHTML=`${spots}<div class="wrap">
      <div class="eyebrow rise d1">${s.eyebrow||''}</div>
      <h1 class="title rise d2">${s.title||''}</h1>
      <p class="lede rise d3">${s.lede||''}</p>
      <div class="cta-row rise d4">${ctas}</div></div>`;
    stage.appendChild(el);
    const d=document.createElement('button'); d.setAttribute('role','tab');
    d.setAttribute('aria-label','Scene '+(i+1)); d.onclick=()=>goTo(i); dotsEl.appendChild(d);
  });
  const scenes=[...document.querySelectorAll('.scene')];

  function goTo(n){
    if(busy||n===current||n<0||n>=scenes.length)return;
    busy=true;
    const from=scenes[current], to=scenes[n], t=SCENES[n].trans||'zoom';
    from.classList.add('leave-'+t); to.classList.add('enter-'+t);
    void to.offsetWidth;
    to.classList.add('active'); from.classList.remove('active');
    updateHUD(n);
    setTimeout(()=>{
      from.className='scene';
      to.querySelectorAll('.rise').forEach(r=>{r.style.animation='none';void r.offsetWidth;r.style.animation='';});
      to.classList.remove('enter-'+t);
      current=n; busy=false;
    },1000);
  }
  function updateHUD(n){
    [...dotsEl.children].forEach((d,i)=>d.classList.toggle('on',i===n));
    countEl.innerHTML=`<b>${String(n+1).padStart(2,'0')}</b> / ${String(scenes.length).padStart(2,'0')}`;
  }

  document.getElementById('app').addEventListener('click',e=>{
    const b=e.target.closest('[data-go],[data-modal],[data-href]'); if(!b)return;
    if(b.dataset.go!==undefined) goTo(+b.dataset.go);
    else if(b.dataset.modal) openModal(b.dataset.modal);
    else if(b.dataset.href){ const h=b.dataset.href;
      if(h.startsWith('http')) window.open(h,'_blank','noopener'); }
  });

  function openModal(key){
    const m=MODALS[key]; if(!m)return;
    mTitle.textContent=m.title;
    mTabs.innerHTML=m.tabs.map((t,i)=>`<button class="tab${i?'':' active'}" data-t="${i}">${t.name}</button>`).join('');
    mBody.innerHTML=m.tabs.map((t,i)=>`<div class="panel${i?'':' active'}" data-p="${i}">${t.html}</div>`).join('');
    modal.classList.add('show');
  }
  function closeModal(){modal.classList.remove('show');}
  mTabs.addEventListener('click',e=>{const t=e.target.closest('.tab');if(!t)return;
    const i=t.dataset.t;
    mTabs.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===t));
    mBody.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.dataset.p===i));});
  document.getElementById('mClose').onclick=closeModal;
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});

  document.getElementById('homeBtn').onclick=()=>{closeModal();goTo(0);};
  document.getElementById('backBtn').onclick=()=>{ location.href=HOME_HREF; };
  const soundBtn=document.getElementById('soundBtn');
  soundBtn.onclick=()=>{soundOn=!soundOn;soundBtn.classList.toggle('off',!soundOn);
    /* hook real audio here: if(soundOn) audio.play(); else audio.pause(); */};

  addEventListener('keydown',e=>{
    if(e.key==='Escape'){modal.classList.contains('show')?closeModal():goTo(0);}
    else if(e.key==='ArrowRight'||e.key==='ArrowDown')goTo(current+1);
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')goTo(current-1);
  });
  let sx=0,sy=0;
  stage.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY;},{passive:true});
  stage.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)) goTo(current+(dx<0?1:-1));
  },{passive:true});

  const rotate=document.getElementById('rotate');
  let portraitDismissed=false;
  function checkOrient(){
    const portrait=matchMedia('(orientation:portrait)').matches && innerWidth<820;
    if(portrait && !portraitDismissed) rotate.classList.add('show');
    else rotate.classList.remove('show');
  }
  matchMedia('(orientation:portrait)').addEventListener('change',checkOrient);
  addEventListener('resize',checkOrient);
  document.getElementById('skipPortrait').onclick=()=>{portraitDismissed=true;rotate.classList.remove('show');};

  async function requestAppFullscreen(){
    const element=document.documentElement;
    try{
      if(element.requestFullscreen){ await element.requestFullscreen({navigationUI:"hide"}); }
      else if(element.webkitRequestFullscreen){ element.webkitRequestFullscreen(); }
    }catch(error){ console.warn("Fullscreen request failed:",error); }
  }
  function hideEntryOverlay(){ document.getElementById('entry').classList.add('hide'); }
  function startExperience(){
    scenes[0].classList.add('active','enter-zoom');
    void scenes[0].offsetWidth; scenes[0].classList.remove('enter-zoom');
    updateHUD(0); checkOrient();
  }
  document.getElementById('enterBtn').addEventListener("click", async ()=>{
    await requestAppFullscreen();
    try{ await screen.orientation?.lock?.("landscape"); }
    catch(error){ console.warn("Orientation lock unavailable:",error); }
    hideEntryOverlay(); startExperience();
  });
  document.addEventListener("fullscreenchange",()=>{ console.log("fullscreenchange:",document.fullscreenElement); });
  document.addEventListener("fullscreenerror",e=>{ console.warn("fullscreenerror:",e); });

  window.addEventListener('load',()=>{
    setTimeout(()=>{ document.getElementById('loader').classList.add('hide'); },1100);
  });
})();
