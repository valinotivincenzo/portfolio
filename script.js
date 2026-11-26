'use strict';
document.addEventListener('DOMContentLoaded', () => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.navigation');
  const submenu = document.querySelector('.has-submenu');
  const subToggle = document.querySelector('.submenu-toggle');
  const closeMenu = () => {
    nav?.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    menu?.setAttribute('aria-label','Apri menu');
    submenu?.classList.remove('open');
    subToggle?.setAttribute('aria-expanded','false');
  };
  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Chiudi menu' : 'Apri menu');
  });
  subToggle?.addEventListener('click', () => {
    const open = submenu.classList.toggle('open');
    subToggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
  nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('pointerdown', e => {
    if (!e.target.closest('.site-header')) closeMenu();
  });

  // A single media manager: a new local or embedded player pauses the previous one.
  let activeEmbed = null;
  const stopEmbeds = () => {
    if (!activeEmbed) return;
    const old = activeEmbed;
    activeEmbed = null;
    old.container.replaceChildren(old.placeholder);
    old.notice?.remove();
  };
  document.addEventListener('play', e => {
    if (!(e.target instanceof HTMLMediaElement)) return;
    document.querySelectorAll('audio,video').forEach(m => { if(m !== e.target && !m.paused) m.pause(); });
    stopEmbeds();
  }, true);

  // The official YouTube API is loaded only on request. Errors from third-party
  // restrictions are handled without losing the thumbnail or external link.
  let ytAPI;
  const getYouTubeAPI = () => {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!ytAPI) ytAPI = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = reject;
      document.head.append(script);
    }).catch(() => null);
    return ytAPI;
  };
  document.addEventListener('click', e => {
    const button = e.target.closest('.activate-embed');
    if (!button) return;
    const box = button.closest('[data-embed]');
    if (!box) return;
    const isYouTube = Boolean(box.dataset.videoId);
    if (box.nextElementSibling?.classList.contains('embed-notice')) box.nextElementSibling.remove();
    document.querySelectorAll('audio,video').forEach(m => m.pause());
    stopEmbeds();
    // file:// does not provide an HTTP origin/referrer for YouTube's player.
    // The poster is a real link and opens the canonical watch page instead.
    if (isYouTube && !['http:', 'https:'].includes(location.protocol)) return;
    if (isYouTube && (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0)) return;
    e.preventDefault();
    const placeholder = box.firstElementChild;
    const frame = document.createElement('iframe');
    const url = new URL(box.dataset.embed);
    if (isYouTube) {
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('origin', location.origin);
    }
    frame.src = url.href;
    frame.title = box.dataset.title || 'Lettore multimediale';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    box.replaceChildren(frame);
    const session = {container: box, placeholder};
    activeEmbed = session;
    if (isYouTube) {
      getYouTubeAPI().then(YT => {
        if (!YT?.Player || activeEmbed !== session) return;
        try {
          new YT.Player(frame, {events: {onError: () => {
            if (activeEmbed !== session) return;
            stopEmbeds();
            const note = document.createElement('p');
            note.className = 'embed-notice';
            note.setAttribute('role', 'status');
            note.textContent = 'Il lettore incorporato non è disponibile. Usa il collegamento “Apri su YouTube”.';
            box.insertAdjacentElement('afterend', note);
          }}});
        } catch (_) { /* The direct link remains available. */ }
      });
    }
  });
  const time = value => {
    let s=Math.max(0,Math.floor(Number(value)||0));
    return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  };
  document.querySelectorAll('[data-player]').forEach(control=>{
    const audio=control.querySelector('audio');
    const play=control.querySelector('.play-button');
    const current=control.querySelector('.current-time');
    const duration=control.querySelector('.duration');
    const seek=control.querySelector('.seek');
    const volume=control.querySelector('.volume');
    const symbol=play.querySelector('.play-symbol');
    const playlist=control.closest('[data-playlist]');
    const rows=playlist?[...playlist.querySelectorAll('.playlist-row')]:[];
    let selected=0;
    let trackTitle=playlist?.querySelector('.now-playing').textContent || control.closest('.track-card')?.querySelector('h4').textContent || 'audio';
    const render=()=>{
      symbol.textContent='';
      play.classList.toggle('is-playing',!audio.paused);
      play.setAttribute('aria-label',(audio.paused?'Riproduci ':'Metti in pausa ')+trackTitle);
      play.setAttribute('aria-pressed',String(!audio.paused));
      current.textContent=time(audio.currentTime);
      if(Number.isFinite(audio.duration)&&audio.duration>0){
        duration.textContent=time(audio.duration);
        seek.value=String(100*audio.currentTime/audio.duration);
      }
    };
    const start=async()=>{
      document.querySelectorAll('audio,video').forEach(m=>{if(m!==audio&&!m.paused)m.pause()});
      stopEmbeds();
      try {await audio.play();} catch(err) {if(err.name!=='AbortError') {play.title='Impossibile riprodurre il file. Riprova.';render();}}
    };
    const select = (index, autoplay=true) => {
      if(!rows.length)return;
      selected=(index+rows.length)%rows.length;
      const row=rows[selected];
      audio.pause();audio.src=row.dataset.src;audio.load();
      rows.forEach((r,i)=>{r.classList.toggle('selected',i===selected);r.setAttribute('aria-current',i===selected?'true':'false')});
      trackTitle=row.dataset.title;
      playlist.querySelector('.now-playing').textContent=trackTitle;
      duration.textContent=row.dataset.duration;current.textContent='00:00';seek.value='0';render();
      if(autoplay)start();
    };
    rows.forEach((row,i)=>{
      row.setAttribute('aria-current',i===0?'true':'false');
      row.addEventListener('click',()=>{if(i===selected){audio.paused?start():audio.pause()}else select(i)});
    });
    control.querySelector('.previous')?.addEventListener('click',()=>select(selected-1));
    control.querySelector('.next')?.addEventListener('click',()=>select(selected+1));
    play.addEventListener('click',()=>{audio.paused?start():audio.pause()});
    seek.addEventListener('input',()=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(seek.value)/100});
    volume?.addEventListener('input',()=>{audio.volume=Number(volume.value)});
    ['play','pause','timeupdate','loadedmetadata','durationchange','ended'].forEach(evt=>audio.addEventListener(evt,render));
    audio.addEventListener('ended',()=>{if(rows.length && selected<rows.length-1)select(selected+1)});
    audio.addEventListener('error',()=>{play.title='File audio non disponibile';render()});
    render();
  });
  // Gallery lightbox, keyboard and touch-friendly controls.
  const dialog=document.querySelector('.lightbox');
  const gallery=[...document.querySelectorAll('.gallery-item')].sort((a,b)=>Number(a.dataset.index)-Number(b.dataset.index));
  if(dialog&&gallery.length){
    const media=dialog.querySelector('.lightbox-media');
    const caption=dialog.querySelector('.lightbox-caption');
    let index=0,previousFocus;
    const show=(i)=>{
      index=(i+gallery.length)%gallery.length;
      const item=gallery[index];
      media.querySelector('video')?.pause();
      const el=document.createElement(item.dataset.kind==='video'?'video':'img');
      el.src=item.dataset.media;
      if(el instanceof HTMLVideoElement){el.controls=true;el.playsInline=true;el.preload='metadata';el.poster=item.querySelector('img').src;}
      else el.alt=item.querySelector('img').alt;
      media.replaceChildren(el);caption.textContent=item.dataset.caption+' · '+(index+1)+'/'+gallery.length;
    };
    gallery.forEach((item,i)=>item.addEventListener('click',()=>{
      previousFocus=item;show(i);dialog.showModal();document.body.style.overflow='hidden';dialog.querySelector('.lightbox-close').focus();
    }));
    dialog.querySelector('.lightbox-close').addEventListener('click',()=>dialog.close());
    dialog.querySelector('.lightbox-prev').addEventListener('click',()=>show(index-1));
    dialog.querySelector('.lightbox-next').addEventListener('click',()=>show(index+1));
    dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(index-1)}if(e.key==='ArrowRight'){e.preventDefault();show(index+1)}});
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
    dialog.addEventListener('close',()=>{media.querySelector('video')?.pause();media.replaceChildren();document.body.style.overflow='';previousFocus?.focus()});
  }
});
