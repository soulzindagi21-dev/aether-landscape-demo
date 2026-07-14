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
      <div id="wipe"></div>
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
    el.className='scene'+(s.layout?' layout-'+s.layout:''); el.dataset.i=i; el.setAttribute('role','tabpanel');
    if(s.bg) el.style.background=s.bg;
    /* media layer: poster plate always, loop video lazily attached */
    let media='';
    if(s.poster||s.loop){
      media=`<div class="scene-media">
        <div class="plate" ${s.poster?`style="background-image:url('${s.poster}')"`:''}></div>
        <div class="tint"></div></div>`;
    }
    const spots=(s.hotspots||[]).map(h=>
      `<button class="hotspot" style="left:${h.x};top:${h.y}" data-modal="${h.modal}" aria-label="${h.label}">
         <span class="ring"></span><span class="dot"></span><span class="lbl">${h.label}</span></button>`).join('');
    const ctas=(s.ctas||[]).map(c=>{
      const cls='btn'+(c.style==='solid'?' solid':'');
      const attr=c.href?`data-href="${c.href}"`:c.modal?`data-modal="${c.modal}"`:`data-go="${c.go}"`;
      return `<button class="${cls}" ${attr}>${c.label}<span class="arr">→</span></button>`;
    }).join('');
    const titleHtml = s.titleImage
      ? `<div class="title-img rise d2"><img src="${s.titleImage}" alt="${(s.titleAlt||s.title||'').replace(/<[^>]*>/g,'')}"></div>`
      : `<h1 class="title${s.titleClass?' '+s.titleClass:''} rise d2">${s.title||''}</h1>`;
    el.innerHTML=`${media}${spots}<div class="wrap">
      <div class="eyebrow rise d1">${s.eyebrow||''}</div>
      ${titleHtml}
      <p class="lede rise d3">${s.lede||''}</p>
      <div class="cta-row rise d4">${ctas}</div></div>`;
    stage.appendChild(el);
    const d=document.createElement('button'); d.setAttribute('role','tab');
    d.setAttribute('aria-label','Scene '+(i+1)); d.onclick=()=>goTo(i); dotsEl.appendChild(d);
  });
  const scenes=[...document.querySelectorAll('.scene')];

  /* ---------- loop video manager: one active decoder at a time ---------- */
  const reducedMotion = matchMedia('(prefers-reduced-motion:reduce)').matches;
  let activeVideoScene = 0; /* which scene's video should currently be playing */
  function tryPlay(v){
    if(!v) return;
    const p=v.play();
    if(p && p.catch) p.catch(err=>{ console.warn("video play() blocked:",err && err.name, err && err.message); });
  }
  function ensureLoopVideo(i){
    const s=SCENES[i]; if(!s||!s.loop) return null;
    const holder=scenes[i].querySelector('.scene-media'); if(!holder) return null;
    let v=holder.querySelector('video');
    if(!v){
      v=document.createElement('video');
      /* muted MUST be set as attribute for desktop Chrome autoplay policy */
      v.muted=true; v.defaultMuted=true; v.setAttribute('muted','');
      v.loop=true; v.playsInline=true; v.setAttribute('playsinline','');
      v.setAttribute('autoplay','');
      v.preload='auto'; v.src=s.loop;
      if(s.poster) v.poster=s.poster;
      v.addEventListener('canplay',()=>{
        v.classList.add('ready');
        if(i===activeVideoScene) tryPlay(v);
      });
      v.addEventListener('loadeddata',()=>{
        if(i===activeVideoScene) tryPlay(v); /* second retry point */
      });
      v.addEventListener('error',()=>{ v.remove(); },{once:true}); /* plate stays */
      holder.insertBefore(v, holder.querySelector('.tint'));
    }
    /* if this video is already buffered (e.g. warmed earlier), don't wait on an
       event that may already have fired — try immediately */
    if(v.readyState>=3){ v.classList.add('ready'); if(i===activeVideoScene) tryPlay(v); }
    return v;
  }
  function playScene(i){
    activeVideoScene = i;
    scenes.forEach((sc,j)=>{
      const v=sc.querySelector('.scene-media video');
      if(v && j!==i){ v.pause(); }
    });
    tryPlay(ensureLoopVideo(i));
    /* warm the next scene's video so the swap is instant */
    if(SCENES[i+1]&&SCENES[i+1].loop) ensureLoopVideo(i+1);
  }
  /* desktop fallback: if autoplay was blocked, the first click/keypress resumes it */
  function resumeActiveVideo(){
    const v=scenes[activeVideoScene]?.querySelector('.scene-media video');
    if(v && v.paused) tryPlay(v);
  }
  document.addEventListener('click', resumeActiveVideo);
  document.addEventListener('keydown', resumeActiveVideo);

  /* ---------- wipe transition layer ---------- */
  const wipeEl=document.getElementById('wipe');
  const WIPES=(DEMO.wipes||[]).slice();
  let wipeIdx=0, wipeVideos=[];
  function prepWipes(){
    /* wipes are fast full-screen video overlays — unlike the ambient
       background loop, this is the kind of abrupt motion prefers-reduced-motion
       is meant to guard against, so it stays gated. Plain CSS transitions
       still run underneath as the fallback. */
    if(reducedMotion) return;
    WIPES.forEach(src=>{
      const v=document.createElement('video');
      v.muted=true; v.defaultMuted=true; v.setAttribute('muted','');
      v.playsInline=true; v.setAttribute('playsinline','');
      v.preload='auto'; v.src=src; v.style.display='none';
      v.addEventListener('error',()=>{ const k=wipeVideos.indexOf(v); if(k>-1)wipeVideos.splice(k,1); v.remove(); },{once:true});
      wipeEl.appendChild(v); wipeVideos.push(v);
    });
  }
  /* plays a wipe over the swap; calls midpoint() when the frame is covered */
  function runWipe(midpoint){
    if(!wipeVideos.length||reducedMotion){ midpoint(); return; }
    const v=wipeVideos[wipeIdx%wipeVideos.length]; wipeIdx++;
    wipeVideos.forEach(x=>x.style.display='none');
    v.style.display='block'; v.currentTime=0;
    wipeEl.classList.add('play');
    let fired=false;
    const mid=()=>{ if(!fired){fired=true; midpoint();} };
    /* fire midpoint at 40% of the clip (opaque moment), end overlay on 'ended' */
    const onTime=()=>{ if(v.duration && v.currentTime>=v.duration*0.4) { mid(); v.removeEventListener('timeupdate',onTime);} };
    v.addEventListener('timeupdate',onTime);
    v.addEventListener('ended',()=>{ wipeEl.classList.remove('play'); },{once:true});
    const p=v.play();
    if(p) p.catch(()=>{ wipeEl.classList.remove('play'); mid(); });
    /* safety: never strand the overlay */
    setTimeout(()=>{ mid(); wipeEl.classList.remove('play'); }, 2500);
  }

  function goTo(n){
    if(busy||n===current||n<0||n>=scenes.length)return;
    busy=true;
    const doSwap=()=>{
      const from=scenes[current], to=scenes[n], t=SCENES[n].trans||'zoom';
      from.classList.add('leave-'+t); to.classList.add('enter-'+t);
      void to.offsetWidth;
      to.classList.add('active'); from.classList.remove('active');
      updateHUD(n); playScene(n);
      setTimeout(()=>{
        from.className='scene'+(SCENES[+from.dataset.i].layout?' layout-'+SCENES[+from.dataset.i].layout:'');
        to.querySelectorAll('.rise').forEach(r=>{r.style.animation='none';void r.offsetWidth;r.style.animation='';});
        to.classList.remove('enter-'+t);
        current=n; busy=false;
      },1000);
    };
    runWipe(doSwap);
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
    updateHUD(0); checkOrient(); prepWipes(); playScene(0);
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
