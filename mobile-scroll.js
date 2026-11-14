// GastroSky mobile-only quick navigation: tap to jump to the opposite end.
// Deliberately no tracking, external dependencies or persisted state.
(() => {
  'use strict';
  const style=document.createElement('style');
  style.textContent=`
    .gs-mobile-jump {
      display:none;
      position:fixed;
      right:max(14px,env(safe-area-inset-right));
      bottom:calc(16px + env(safe-area-inset-bottom));
      z-index:20;
      width:46px;height:46px;
      align-items:center;justify-content:center;
      border:1px solid #b98d49;
      border-radius:13px;
      background:#142b42;
      color:#f3cc86;
      box-shadow:0 5px 18px rgba(10,26,41,.35);
      padding:0;
      cursor:pointer;
      -webkit-tap-highlight-color:transparent;
      touch-action:manipulation;
    }
    .gs-mobile-jump svg {width:20px;height:20px;pointer-events:none}
    .gs-mobile-jump:focus-visible {outline:3px solid #e6b565;outline-offset:3px}
    @media (max-width:760px) {
      .gs-mobile-jump[data-visible="true"] {display:flex}
    }
  `;
  document.head.append(style);
  const button=document.createElement('button');
  button.type='button';
  button.className='gs-mobile-jump';
  button.id='gsMobileJump';
  button.dataset.visible='false';
  button.setAttribute('aria-label','Ugrás az oldal aljára');
  button.setAttribute('title','Ugrás az oldal aljára');
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.setAttribute('viewBox','0 0 24 24');
  icon.setAttribute('fill','none');
  icon.setAttribute('stroke','currentColor');
  icon.setAttribute('stroke-width','2.5');
  icon.setAttribute('stroke-linecap','round');
  icon.setAttribute('stroke-linejoin','round');
  icon.setAttribute('aria-hidden','true');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  icon.append(path);button.append(icon);document.body.append(button);

  let destination='bottom';
  const update=()=>{
    const maxScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    button.dataset.visible=maxScroll>120?'true':'false';
    // Below the midpoint, up is the most useful one-tap navigation.
    destination=window.scrollY>=maxScroll/2&&maxScroll>0?'top':'bottom';
    const label=destination==='top'?'Ugrás az oldal tetejére':'Ugrás az oldal aljára';
    button.setAttribute('aria-label',label);
    button.title=label;
    path.setAttribute('d',destination==='top'?'M6 14l6-6 6 6':'M6 10l6 6 6-6');
  };
  let scheduled=false;
  const schedule=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;update()});
  };
  button.addEventListener('click',()=>{
    const maxScroll=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
    window.scrollTo({top:destination==='top'?0:maxScroll,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  });
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  if('ResizeObserver' in window)new ResizeObserver(schedule).observe(document.body);
  update();
})();
