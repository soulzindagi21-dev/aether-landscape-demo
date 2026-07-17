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
  /* a bare DEMO.audio (no visible player) still works for any theme; DEMO.player
     additionally renders a transport UI, themed per-page via CSS variables */
  const PLAYER = DEMO.player || (DEMO.audio ? {tracks:[{title:BRAND, src:DEMO.audio}]} : null);
  const HAS_AUDIO = !!PLAYER || SCENES.some(s=>s.spatialDemo);
  /* VP9-alpha WebM plays in Chrome/Edge/Firefox/Android but not Safari/iOS —
     gate animated logotypes on it so unsupported browsers keep the static PNG */
  const supportsWebmAlpha=(function(){const v=document.createElement('video');
    return !!(v.canPlayType && v.canPlayType('video/webm; codecs="vp9"'));})();

  /* ---------- inject shared shell markup ---------- */
  document.body.insertAdjacentHTML('afterbegin', `
    <div id="blackout"></div>
    <div id="loader">
      <div class="grain"></div>
      <div class="loader-glow"></div>
      <div class="loader-inner">
        <div class="load-mark" id="loadMark">${BRAND}</div>
        <div class="load-bar"></div>
        <p class="load-status" id="loadStatus">Preparing the experience…</p>
      </div>
    </div>

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
      <canvas id="viz" aria-hidden="true"></canvas>
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
      ${HAS_AUDIO ? `<label class="hud viz-switch" id="vizSwitch" title="Toggle visualizer">
        <input type="checkbox" id="vizToggle" checked><span class="viz-switch-track"></span>
      </label>` : ''}
      ${PLAYER ? `<div class="hud player" id="player">
        <button class="p-play" id="pPlay" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
        <div class="p-body">
          <div class="p-track" id="pTrack"></div>
          <input class="p-seek" id="pSeek" type="range" min="0" max="100" value="0" step="0.1">
        </div>
        <div class="p-time" id="pTime">0:00</div>
      </div>` : ''}
    </div>
  `);

  /* ---------- engine ---------- */
  const stage=document.getElementById('stage'), dotsEl=document.getElementById('dots'),
    modal=document.getElementById('modal'), mTitle=document.getElementById('mTitle'),
    mTabs=document.getElementById('mTabs'), mBody=document.getElementById('mBody');
  let current=0, busy=false, soundOn=false, trackIdx=0;
  const audio = PLAYER ? new Audio(PLAYER.tracks[0].src) : null;
  if(audio){ audio.preload='auto'; if(!PLAYER.tracks || PLAYER.tracks.length<2) audio.loop=true; }

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
    const spinMedia = s.spin && s.spin.video
      ? `<video muted playsinline preload="auto" ${s.spin.poster?`poster="${s.spin.poster}"`:''}></video>`
      : `<img alt="Drag to rotate the product" draggable="false">`;
    const spinBg = (s.spin&&s.spin.bg)||'#000';
    const spinHtml = s.spin
      ? `<div class="spin360" style="background:${spinBg};--spin-bg:${spinBg}"><div class="spin-glow"></div>${spinMedia}<div class="spin-vignette"></div>
         <button class="spin-btn prev" aria-label="Rotate left"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
         <button class="spin-btn next" aria-label="Rotate right"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>
         <div class="spin-hint">Hold an arrow to rotate</div></div>` : '';
    /* decorative wordmark clip (e.g. an animated product name on solid black);
       mix-blend screen in CSS drops the black so only the lettering shows */
    const nameHtml = s.nameVideo
      ? `<div class="name-vid rise d1"><video autoplay muted loop playsinline preload="auto" src="${s.nameVideo}"></video></div>` : '';
    const spatialHtml = s.spatialDemo
      ? `<div class="spatial-demo">
          <button class="sd-play" aria-label="Play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
          <div class="sd-toggle">
            <button class="sd-opt active" data-mode="flat">Flat</button>
            <button class="sd-opt" data-mode="spatial">Spatial</button>
          </div>
        </div>` : '';
    const spots=(s.hotspots||[]).map(h=>
      `<button class="hotspot" style="left:${h.x};top:${h.y}" data-modal="${h.modal}" aria-label="${h.label}">
         <span class="ring"></span><span class="dot"></span><span class="lbl">${h.label}</span></button>`).join('');
    const ctas=(s.ctas||[]).map(c=>{
      const cls='btn'+(c.style==='solid'?' solid':'');
      const attr=c.href?`data-href="${c.href}"`:c.modal?`data-modal="${c.modal}"`:`data-go="${c.go}"`;
      return `<button class="${cls}" ${attr}>${c.label}<span class="arr">→</span></button>`;
    }).join('');
    const useTitleVid = s.titleVideo && supportsWebmAlpha;
    const titleHtml = s.titleImage
      ? `<div class="title-img rise d2${useTitleVid?' has-vid':''}" style="--logo-mask:url('${s.titleImage}')"><img src="${s.titleImage}" alt="${(s.titleAlt||s.title||'').replace(/<[^>]*>/g,'')}">${useTitleVid?`<video class="title-vid" autoplay muted loop playsinline preload="auto"><source src="${s.titleVideo}" type="video/webm"></video>`:''}</div>`
      : `<h1 class="title${s.titleClass?' '+s.titleClass:''} rise d2">${s.title||''}</h1>`;
    el.innerHTML=`${media}${spinHtml}${nameHtml}${spatialHtml}${spots}<div class="wrap">
      <div class="eyebrow rise d1">${s.eyebrow||''}</div>
      ${titleHtml}
      <p class="lede rise d3">${s.lede||''}</p>
      <div class="cta-row rise d4">${ctas}</div></div>`;
    stage.appendChild(el);
    const d=document.createElement('button'); d.setAttribute('role','tab');
    d.setAttribute('aria-label','Scene '+(i+1)); d.onclick=()=>goTo(i); dotsEl.appendChild(d);
  });
  const scenes=[...document.querySelectorAll('.scene')];
  /* start buffering the homepage hero the instant the page loads — not on
     Enter click — so by the time the visitor can click, it's already ready */
  if(SCENES[0]&&SCENES[0].loop) ensureLoopVideo(0);

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
    if(SCENES[i]&&SCENES[i].spin) ensureSpinViewer(i);
    if(SCENES[i]&&SCENES[i].spatialDemo) ensureSpatialDemo(i);
  }

  /* ---------- 360 drag-to-rotate product viewer ---------- */
  function ensureSpinViewer(i){
    const s=SCENES[i]; if(!s||!s.spin) return null;
    const holder=scenes[i].querySelector('.spin360'); if(!holder||holder.dataset.ready) return holder;
    holder.dataset.ready='1';
    return s.spin.video ? ensureSpinVideo(holder,s.spin) : ensureSpinFrames(holder,s.spin);
  }
  /* legacy mode: drag swaps between a numbered sequence of still frames */
  function ensureSpinFrames(holder,cfg){
    const count=cfg.count||0, pad=cfg.pad||2, pxPerFrame=cfg.pxPerFrame||40;
    const frameSrc=(n)=> cfg.frames ? cfg.frames[n] : (cfg.base+String(n+1).padStart(pad,'0')+cfg.ext);
    const img=holder.querySelector('img');
    img.src=cfg.poster||(count?frameSrc(0):'');
    const frames=[];
    for(let n=0;n<count;n++){ const im=new Image(); im.src=frameSrc(n); frames.push(im); }
    let current=0, dragging=false, startX=0, startFrame=0;
    function setFrame(n){
      if(!count) return;
      current=((n%count)+count)%count;
      const f=frames[current];
      if(f && f.complete && f.naturalWidth) img.src=f.src;
    }
    function pos(e){ return e.touches?e.touches[0].clientX:e.clientX; }
    function onDown(e){
      dragging=true; startX=pos(e); startFrame=current;
      holder.classList.add('dragging','hinted');
    }
    function onMove(e){
      if(!dragging) return;
      const dx=pos(e)-startX;
      setFrame(startFrame-Math.round(dx/pxPerFrame));
    }
    function onUp(){ dragging=false; holder.classList.remove('dragging'); }
    holder.addEventListener('pointerdown',onDown);
    holder.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    holder.addEventListener('touchstart',onDown,{passive:true});
    holder.addEventListener('touchmove',onMove,{passive:true});
    holder.addEventListener('touchend',onUp);
    holder.__setFrame=setFrame; /* exposed for testing */
    return holder;
  }
  /* preferred mode: drag scrubs the playhead of a single locked-off rotation
     clip instead of swapping frame images — avoids per-frame motion blur
     entirely since nothing is generated at "fast spin" speed, and there's
     only one asset to manage instead of a numbered frame sequence */
  function ensureSpinVideo(holder,cfg){
    const vid=holder.querySelector('video');
    vid.src=cfg.video;
    const pxPerTurn=cfg.pxPerTurn||600; /* px of drag for one full 360deg turn */
    /* drag→rotation direction. Default: dragging right advances the playhead so
       the product surface tracks the finger. Set spin.invertDrag:true in the
       config to reverse it — no video re-encode needed, this is the single
       source of truth for spin direction. */
    const dragSign=cfg.invertDrag?-1:1;
    let duration=0, current=0, dragging=false, startX=0, startTime=0, pending=null;
    vid.addEventListener('loadedmetadata',()=>{ duration=vid.duration||0; });
    function pos(e){ return e.touches?e.touches[0].clientX:e.clientX; }
    function setTime(t){
      if(!duration) return;
      /* clamp to the clip's bounds — the rotation locks at each end instead of
         wrapping around, so there's no discontinuous jump from last frame back
         to first (the "loop" seam the video showed on wrap) */
      current=Math.max(0,Math.min(duration,t));
      pending=current;
    }
    function onDown(e){
      dragging=true; startX=pos(e); startTime=current;
      holder.classList.add('dragging','hinted');
    }
    function onMove(e){
      if(!dragging||!duration) return;
      const dx=pos(e)-startX;
      setTime(startTime+dragSign*(dx/pxPerTurn)*duration);
    }
    function onUp(){ dragging=false; holder.classList.remove('dragging'); }
    holder.addEventListener('pointerdown',onDown);
    holder.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    holder.addEventListener('touchstart',onDown,{passive:true});
    holder.addEventListener('touchmove',onMove,{passive:true});
    holder.addEventListener('touchend',onUp);
    /* hold-to-rotate buttons — the primary control on touch devices, where
       drag-scrubbing proved clunky (every pointermove queues a seek; slower
       phones drop enough of them that the motion stutters). Holding a button
       advances the playhead at a smooth constant rate instead, using the same
       clamped setTime (locks at the clip ends) and the same rAF seek throttle. */
    const secsPerTurn=cfg.secondsPerTurn||6; /* full 360 takes this long while held */
    let holdDir=0, holdRAF=0, lastTs=0;
    function holdLoop(ts){
      if(!holdDir){ holdRAF=0; return; }
      holdRAF=requestAnimationFrame(holdLoop);
      /* clamp the frame delta: a stalled rAF (tab jank, decoder busy) would
         otherwise deliver one huge dt and make the rotation jump instead of
         glide — cap it so a stall just pauses the turn for that moment */
      const dt=Math.max(0,Math.min(.1,(ts-lastTs)/1000)); lastTs=ts;
      if(duration) setTime(current + holdDir*dt*(duration/secsPerTurn));
    }
    holder.querySelectorAll('.spin-btn').forEach(btn=>{
      const dir=(btn.classList.contains('next')?1:-1)*dragSign; /* invertDrag flips buttons too */
      function start(e){
        e.stopPropagation(); /* don't also start a drag on the holder */
        if(e.cancelable) e.preventDefault(); /* suppress long-press context menu on Android */
        holdDir=dir; btn.classList.add('holding'); holder.classList.add('hinted');
        if(!holdRAF){ lastTs=performance.now(); holdRAF=requestAnimationFrame(holdLoop); }
      }
      function stop(){ holdDir=0; btn.classList.remove('holding'); }
      btn.addEventListener('pointerdown',start);
      btn.addEventListener('pointerup',stop);
      btn.addEventListener('pointercancel',stop);
      btn.addEventListener('pointerleave',stop);
      btn.addEventListener('contextmenu',e=>e.preventDefault());
    });
    /* rAF-throttled seek: writing video.currentTime on every single pointermove
       queues seeks faster than the decoder can drain them, so the scrub visibly
       lags the cursor — cap it to one seek per rendered frame instead */
    (function tick(){
      requestAnimationFrame(tick);
      if(pending===null) return;
      if(Math.abs(vid.currentTime-pending)>0.008) vid.currentTime=pending;
      pending=null;
    })();
    holder.__setTime=setTime; /* exposed for testing */
    holder.__holdLoop=holdLoop; /* exposed for testing */
    return holder;
  }

  /* ---------- flat vs spatial audio A/B demo ---------- */
  function ensureSpatialDemo(i){
    const s=SCENES[i]; if(!s||!s.spatialDemo) return null;
    const holder=scenes[i].querySelector('.spatial-demo'); if(!holder||holder.dataset.ready) return holder;
    holder.dataset.ready='1';
    const cfg=s.spatialDemo;
    const a=new Audio(cfg.flat); a.loop=true; a.preload='auto';
    let mode='flat', playing=false;
    const playBtn=holder.querySelector('.sd-play');
    const opts=[...holder.querySelectorAll('.sd-opt')];
    playBtn.onclick=()=>{
      playing=!playing;
      playBtn.classList.toggle('on',playing);
      if(playing){ vizAttach(a); tryPlay(a); } else { a.pause(); }
      vizSetActive(a,playing);
    };
    opts.forEach(btn=>btn.addEventListener('click',()=>{
      const m=btn.dataset.mode; if(m===mode) return;
      const t=a.currentTime, wasPlaying=!a.paused;
      mode=m; opts.forEach(o=>o.classList.toggle('active',o===btn));
      a.src = m==='flat'?cfg.flat:cfg.spatial;
      a.currentTime=t;
      if(wasPlaying) tryPlay(a);
    }));
    holder.__audio=a; /* exposed for testing */
    return holder;
  }

  /* ---------- audio-reactive visualization (Web Audio analyser -> canvas) ----------
     Lights up whenever a track is actively playing (main player or the spatial
     A/B demo). Entirely client-side; if the Web Audio API is unavailable or a
     source can't be wired, audio playback continues untouched. */
  const vizCanvas=document.getElementById('viz');
  let vizCtx2d=null, audioCtx=null, analyser=null, freqData=null, vizRAF=0, vizRGB=null;
  const vizWired=new WeakSet();
  let vizActiveEl=null, vizEnabled=true;
  const vizToggle=document.getElementById('vizToggle');
  if(vizToggle) vizToggle.addEventListener('change',()=>{
    vizEnabled=vizToggle.checked;
    vizSetActive(vizActiveEl,!!vizActiveEl); /* re-evaluate; CSS opacity transition handles the fade */
  });
  function vizColor(a){
    if(!vizRGB){
      const c=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      const m=c.match(/^#?([0-9a-f]{6})$/i);
      vizRGB=m?[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)]:[201,161,90];
    }
    return 'rgba('+vizRGB[0]+','+vizRGB[1]+','+vizRGB[2]+','+a+')';
  }
  function vizAttach(el){
    if(!el||!vizCanvas) return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC) return;
      if(!audioCtx){
        audioCtx=new AC();
        analyser=audioCtx.createAnalyser();
        analyser.fftSize=128; analyser.smoothingTimeConstant=.82;
        analyser.connect(audioCtx.destination);
        freqData=new Uint8Array(analyser.frequencyBinCount);
      }
      if(!vizWired.has(el)){
        /* reroutes the element through the context — one source per element, ever */
        audioCtx.createMediaElementSource(el).connect(analyser);
        vizWired.add(el);
      }
      if(audioCtx.state==='suspended') audioCtx.resume();
    }catch(err){ console.warn('audio viz unavailable:',err); }
  }
  function vizSetActive(el,on){
    if(on){ vizActiveEl=el; }
    else if(vizActiveEl===el){ vizActiveEl=null; }
    if(vizActiveEl && analyser && vizEnabled){
      vizCanvas.classList.add('on');
      if(!vizRAF) vizRAF=requestAnimationFrame(vizLoop);
    }else{
      vizCanvas.classList.remove('on');
    }
  }
  function vizLoop(){
    if(!vizCanvas.classList.contains('on')){ vizRAF=0; return; }
    vizRAF=requestAnimationFrame(vizLoop);
    if(!vizCtx2d){ vizCtx2d=vizCanvas.getContext&&vizCanvas.getContext('2d');
      if(!vizCtx2d){ cancelAnimationFrame(vizRAF); vizRAF=0; return; } }
    const w=vizCanvas.width=vizCanvas.offsetWidth, h=vizCanvas.height=vizCanvas.offsetHeight;
    if(!w||!h||!analyser) return;
    analyser.getByteFrequencyData(freqData);
    const cx=w/2, bins=Math.min(48,freqData.length);
    let bass=0; for(let k=0;k<6;k++) bass+=freqData[k]; bass/=(6*255);
    /* bass-driven glow rising from the bottom of the frame */
    const rad=Math.max(1,w*.5*(0.35+bass*.5));
    const g=vizCtx2d.createRadialGradient(cx,h,0,cx,h,rad);
    g.addColorStop(0,vizColor(Math.min(.32,.06+bass*.3)));
    g.addColorStop(1,'rgba(0,0,0,0)');
    vizCtx2d.fillStyle=g; vizCtx2d.fillRect(0,0,w,h);
    /* mirrored frequency bars along the bottom edge */
    const bw=(w/2)/bins;
    for(let k=0;k<bins;k++){
      const v=freqData[k]/255, bh=v*v*h*.2;
      if(bh<1) continue;
      vizCtx2d.fillStyle=vizColor(.12+v*.22);
      vizCtx2d.fillRect(cx+k*bw+1,h-bh,Math.max(1,bw-2),bh);
      vizCtx2d.fillRect(cx-(k+1)*bw+1,h-bh,Math.max(1,bw-2),bh);
    }
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

  /* Scene navigation = fade the whole screen to solid black, swap the scene
     instantly while it's hidden behind the black, then fade the black away to
     reveal the new one. Routing through #blackout (not a scene-to-scene
     cross-fade) means (a) it never dips through the crimson ambient background
     mid-transition, and (b) it stays exempt from the reduced-motion rule that
     otherwise crushes CSS transitions to near-instant. */
  const navBlackout=document.getElementById('blackout');
  function goTo(n){
    if(busy||n===current||n<0||n>=scenes.length)return;
    busy=true;
    navBlackout.classList.add('nav');
    navBlackout.classList.add('show'); /* fade to black (~.65s) */
    setTimeout(()=>{
      const from=scenes[current], to=scenes[n];
      /* swap instantly while fully hidden — kill the scene's own opacity
         transition for this frame so the switch happens under the black,
         not as a second visible fade once the black lifts */
      from.style.transition='none'; to.style.transition='none';
      /* reset the incoming scene's text reveal so it replays on this visit */
      to.querySelectorAll('.rise').forEach(r=>{r.style.animation='none';void r.offsetWidth;r.style.animation='';});
      to.classList.add('active'); from.classList.remove('active');
      from.className='scene'+(SCENES[+from.dataset.i].layout?' layout-'+SCENES[+from.dataset.i].layout:'');
      void to.offsetWidth;
      from.style.transition=''; to.style.transition='';
      updateHUD(n); playScene(n);
      current=n;
      navBlackout.classList.remove('show'); /* fade back in (~.8s) */
      setTimeout(()=>{ navBlackout.classList.remove('nav'); busy=false; },900);
    },720); /* hold until fully black before swapping */
  }
  function updateHUD(n){
    [...dotsEl.children].forEach((d,i)=>d.classList.toggle('on',i===n));
  }

  document.getElementById('app').addEventListener('click',e=>{
    const b=e.target.closest('[data-go],[data-modal],[data-href]'); if(!b)return;
    if(b.dataset.go!==undefined) goTo(+b.dataset.go);
    else if(b.dataset.modal) openModal(b.dataset.modal);
    else if(b.dataset.href){ const h=b.dataset.href;
      if(h.startsWith('http')) window.open(h,'_blank','noopener');
      else if(!h.startsWith('#')) location.href=h; /* same-site page link (e.g. merch.html); bare "#anchor" stays a no-op placeholder */ }
  });

  function openModal(key){
    if(key==='tryon' && DEMO.tryOn){ openTryOn(); return; }
    const m=MODALS[key]; if(!m)return;
    mTitle.textContent=m.title;
    mTabs.innerHTML=m.tabs.map((t,i)=>`<button class="tab${i?'':' active'}" data-t="${i}">${t.name}</button>`).join('');
    mBody.innerHTML=m.tabs.map((t,i)=>`<div class="panel${i?'':' active'}" data-p="${i}">${t.html}</div>`).join('');
    modal.classList.add('show');
  }

  /* ---------- Try It On: live camera capture -> AI-generated lifestyle preview ---------- */
  function openTryOn(){
    mTitle.textContent='Try It On';
    mTabs.innerHTML='';
    mBody.innerHTML=`<div class="tryon">
      <p class="tryon-note">Take a live photo of yourself right now to see it on you. We only accept a fresh camera capture, not a photo from your gallery.</p>
      <label class="tryon-upload" id="tryonUploadLabel">
        <input type="file" accept="image/*" capture="user" id="tryonFile">
        <span id="tryonUploadText">Take a Photo</span>
      </label>
      <label class="tryon-consent">
        <input type="checkbox" id="tryonConsent">
        <span>I confirm this is a live photo of myself, taken just now, and I consent to an AI-generated preview image being created from it. This photo is used only to generate this preview and is not stored afterward.</span>
      </label>
      <button class="btn solid tryon-submit" id="tryonSubmit" disabled>Generate My Preview</button>
      <p class="tryon-status" id="tryonStatus"></p>
      <div class="tryon-result" id="tryonResult"></div>
    </div>`;
    modal.classList.add('show');
    const fileInput=document.getElementById('tryonFile');
    const uploadText=document.getElementById('tryonUploadText');
    const consent=document.getElementById('tryonConsent');
    const submitBtn=document.getElementById('tryonSubmit');
    const statusEl=document.getElementById('tryonStatus');
    const resultEl=document.getElementById('tryonResult');
    let photoDataUrl=null;
    function updateSubmit(){ submitBtn.disabled=!(photoDataUrl && consent.checked); }
    fileInput.addEventListener('change',()=>{
      const f=fileInput.files[0]; if(!f) return;
      uploadText.textContent='Photo captured ✓';
      const reader=new FileReader();
      reader.onload=()=>{ photoDataUrl=reader.result; updateSubmit(); };
      reader.readAsDataURL(f);
    });
    consent.addEventListener('change',updateSubmit);
    submitBtn.addEventListener('click',async()=>{
      if(!photoDataUrl) return;
      submitBtn.disabled=true;
      statusEl.textContent='Generating your preview — this can take up to 30 seconds…';
      resultEl.innerHTML='';
      try{
        const r=await fetch(DEMO.tryOn.endpoint,{
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({image:photoDataUrl})
        });
        const data=await r.json();
        if(!r.ok || !data.image) throw new Error(data.error||('Request failed: '+r.status));
        resultEl.innerHTML=`<img src="${data.image}" alt="Your AURA ONE preview">`;
        statusEl.textContent='Here’s your preview.';
      }catch(err){
        console.warn('try-it-on failed:',err);
        statusEl.textContent='Something went wrong generating your preview. Please try again.';
      }
      submitBtn.disabled=false;
    });
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
  function setPlaying(on){
    soundOn=on; soundBtn.classList.toggle('off',!soundOn);
    if(pPlayBtn) pPlayBtn.classList.toggle('paused',soundOn);
    if(pPlayBtn) pPlayBtn.innerHTML = soundOn
      ? '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    if(audio){
      if(soundOn){ vizAttach(audio); tryPlay(audio); } else { audio.pause(); }
      vizSetActive(audio,soundOn);
    }
  }
  soundBtn.onclick=()=>setPlaying(!soundOn);

  /* ---------- basic digital track player (only when PLAYER is configured) ---------- */
  const pPlayBtn=document.getElementById('pPlay'), pTrackEl=document.getElementById('pTrack'),
    pSeek=document.getElementById('pSeek'), pTimeEl=document.getElementById('pTime');
  function fmtTime(s){
    if(!isFinite(s)||s<0) return "0:00";
    const m=Math.floor(s/60), sec=Math.floor(s%60);
    return m+":"+String(sec).padStart(2,'0');
  }
  function loadTrack(i){
    if(!PLAYER) return;
    trackIdx=(i+PLAYER.tracks.length)%PLAYER.tracks.length;
    const t=PLAYER.tracks[trackIdx];
    audio.src=t.src;
    if(pTrackEl) pTrackEl.textContent=t.title||BRAND;
  }
  if(PLAYER){
    loadTrack(0);
    audio.addEventListener('timeupdate',()=>{
      if(pSeek && !pSeek.dataset.dragging) pSeek.value = audio.duration ? (audio.currentTime/audio.duration*100) : 0;
      if(pTimeEl) pTimeEl.textContent = fmtTime(audio.currentTime);
    });
    audio.addEventListener('ended',()=>{
      if(PLAYER.tracks.length>1){ loadTrack(trackIdx+1); if(soundOn) tryPlay(audio); }
    });
    if(pPlayBtn) pPlayBtn.onclick=()=>setPlaying(!soundOn);
    if(pSeek){
      pSeek.addEventListener('input',()=>{ pSeek.dataset.dragging='1'; });
      pSeek.addEventListener('change',()=>{
        if(audio.duration) audio.currentTime=(pSeek.value/100)*audio.duration;
        delete pSeek.dataset.dragging;
      });
    }
  }

  addEventListener('keydown',e=>{
    if(e.key==='Escape'){modal.classList.contains('show')?closeModal():goTo(0);}
    else if(e.key==='ArrowRight'||e.key==='ArrowDown')goTo(current+1);
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')goTo(current-1);
  });
  /* swipe-to-navigate is disabled entirely on any scene that has a 360
     viewer — drag there means "rotate the product", never "change page".
     This must be scene-based, not target-based (e.target.closest('.spin360')):
     the spin scene's text/CTA layer sits above the viewer with its own
     pointer-events, so a drag starting on those elements isn't "inside"
     .spin360 and a target check lets the swipe fire anyway — which is
     exactly the page-jump bug this guards against. Navigation on that scene
     still works via dots, arrows, and CTA buttons. */
  let sx=0,sy=0;
  stage.addEventListener('touchstart',e=>{
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;
  },{passive:true});
  stage.addEventListener('touchend',e=>{
    if(scenes[current]&&scenes[current].querySelector('.spin360')) return;
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
  function hideEntryOverlay(){
    /* entry is already fully hidden behind the opaque blackout at this point —
       letting it run its own 0.8s CSS fade races against the blackout's later
       2s reveal fade, and since entry resolves slower than the blackout takes
       to become see-through, its content (the Enter button) could flash back
       into view briefly. It doesn't need to fade at all here, just vanish. */
    const entry=document.getElementById('entry');
    entry.style.transition='none';
    entry.classList.add('hide');
  }
  function startExperience(){
    scenes[0].classList.add('active','enter-zoom');
    void scenes[0].offsetWidth; scenes[0].classList.remove('enter-zoom');
    updateHUD(0); checkOrient(); playScene(0); /* prepWipes() no longer called — see goTo() */
  }
  /* Freeze the entry gate's rendered layout at click time. The fullscreen
     viewport resize would otherwise reflow the gate's vw/vh-sized text+button
     (the "jerk") — and because we want a smooth fade-to-black (not a hard cut),
     the gate stays partly visible during that resize, so it must not move.
     Locking font metrics to px and pinning the block to its current pixel rect
     makes the resize invisible: the gate holds perfectly still while the black
     fades over it. */
  function freezeEntryGate(){
    const inner=document.querySelector('#entry .entry-inner');
    if(!inner) return;
    [inner,...inner.querySelectorAll('*')].forEach(el=>{
      const cs=getComputedStyle(el);
      el.style.fontSize=cs.fontSize;
      el.style.letterSpacing=cs.letterSpacing;
    });
    const r=inner.getBoundingClientRect();
    inner.style.position='fixed';
    inner.style.top=r.top+'px';
    inner.style.left=r.left+'px';
    inner.style.width=r.width+'px';
    inner.style.margin='0';
    inner.style.transform='none';
  }
  /* Once the visitor has entered on any engine page this session, sibling
     pages of the same experience (band.html -> merch.html and back) must not
     demand a second "Enter Experience" click — the gate exists to capture the
     first gesture, and in-experience navigation should feel continuous. */
  const ENTERED_KEY='aether-entered';
  function markEntered(){ try{ sessionStorage.setItem(ENTERED_KEY,'1'); }catch(err){ console.warn('sessionStorage unavailable:',err); } }
  function wasEntered(){ try{ return sessionStorage.getItem(ENTERED_KEY)==='1'; }catch(err){ return false; } }
  function skipEntryGate(){
    /* arrive already-black, assemble, then run the normal 2s reveal — page-to-
       page moves inside the experience read as one continuous fade through
       black instead of a re-gate */
    const blackout=document.getElementById('blackout');
    blackout.style.transition='none'; blackout.classList.add('show');
    void blackout.offsetWidth; blackout.style.transition='';
    hideEntryOverlay(); startExperience();
    document.getElementById('app').classList.add('revealed');
    if(audio) setPlaying(true); /* may be autoplay-blocked without a gesture — retried below */
    /* fullscreen cannot survive a cross-page navigation (browsers require a
       fresh gesture), so reclaim it — and kick blocked audio — on the first
       tap/click anywhere in the new page */
    document.addEventListener('pointerdown',()=>{
      requestAppFullscreen();
      try{ screen.orientation?.lock?.("landscape"); }
      catch(err){ console.warn("Orientation lock unavailable:",err); }
      if(audio&&!soundOn) setPlaying(true);
    },{once:true});
    setTimeout(()=>blackout.classList.remove('show'),80);
  }
  document.getElementById('enterBtn').addEventListener("click", async ()=>{
    /* Sequence (deliberate, per design): fade the entry gate fully to black
       FIRST, and only then request fullscreen — so the viewport expansion
       (and any reflow it causes) happens entirely behind opaque black and is
       invisible. This knowingly departs from the earlier "fullscreen must be
       the first statement" rule: Chrome's transient-activation window after a
       click is ~5s, so a .9s fade still leaves the gesture valid. If some
       Android build ever refuses fullscreen because of the delay, this
       ordering is the first thing to revisit. Gate layout is still frozen so
       nothing shifts during the fade itself. */
    markEntered();
    freezeEntryGate();
    const blackout=document.getElementById('blackout');
    blackout.classList.add('show'); /* smooth .8s fade to black */
    await new Promise(r=>setTimeout(r,900)); /* fully black before anything moves */
    await requestAppFullscreen();
    try{ await screen.orientation?.lock?.("landscape"); }
    catch(error){ console.warn("Orientation lock unavailable:",error); }
    await new Promise(r=>setTimeout(r,350)); /* let the fullscreen resize settle under black */
    /* cinematic hand-off: assemble the homepage underneath while hidden, then
       fade the black away so everything reveals gracefully rather than
       popping in the instant the entry gate disappears */
    hideEntryOverlay(); startExperience();
    document.getElementById('app').classList.add('revealed');
    if(audio) setPlaying(true);
    await new Promise(r=>setTimeout(r,60));
    blackout.classList.remove('show'); /* slow 2s fade-in from black */
  });
  document.addEventListener("fullscreenchange",()=>{ console.log("fullscreenchange:",document.fullscreenElement); });
  document.addEventListener("fullscreenerror",e=>{ console.warn("fullscreenerror:",e); });

  /* ---------- homepage preload gate ----------
     Waits for scene 0's poster + hero video (and the ambient track, since it
     auto-starts on Enter) to reach "can play through without stalling"
     before letting the visitor past the loader. A hard cap keeps a slow or
     failed request from stranding them on the loader forever — after that,
     it reveals anyway (same failsafe philosophy as the wipe transition). */
  function mediaReady(el){
    return new Promise(res=>{
      if(!el){ res(); return; }
      if(el.readyState>=4){ res(); return; } /* HAVE_ENOUGH_DATA already */
      const done=()=>{ el.removeEventListener('canplaythrough',done); el.removeEventListener('error',done); res(); };
      el.addEventListener('canplaythrough',done);
      el.addEventListener('error',done,{once:true});
    });
  }
  function preloadFirstScene(){
    const s=SCENES[0];
    const tasks=[];
    if(s&&s.poster){
      tasks.push(new Promise(res=>{ const img=new Image(); img.onload=img.onerror=res; img.src=s.poster; }));
    }
    if(s&&s.loop) tasks.push(mediaReady(ensureLoopVideo(0)));
    if(PLAYER) tasks.push(mediaReady(audio));
    if(!tasks.length) return Promise.resolve();
    const cap=new Promise(res=>setTimeout(res,8000));
    return Promise.race([Promise.all(tasks), cap]);
  }
  window.addEventListener('load',()=>{
    preloadFirstScene().then(()=>{
      document.getElementById('loader').classList.add('hide');
      if(wasEntered()) skipEntryGate();
    });
  });
})();
