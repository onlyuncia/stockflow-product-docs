(function(){
  'use strict';
  const key='stockflow-theme-v1',root=document.documentElement;
  let theme='dark';
  try{const saved=localStorage.getItem(key);if(saved==='light'||saved==='dark')theme=saved;}catch{}
  const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>';
  const moon='<path d="M20 14A8.5 8.5 0 0 1 10 4 8.5 8.5 0 1 0 20 14Z"/>';
  function apply(next){
    theme=next;root.dataset.theme=theme;root.classList.toggle('dark',theme==='dark');root.classList.toggle('light',theme==='light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='dark'?'#080b12':'#f3f5fa');
    document.querySelectorAll('[data-theme-toggle]').forEach(b=>{
      const label=theme==='dark'?'Светлая':'Тёмная';
      b.innerHTML=`<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true">${theme==='dark'?sun:moon}</svg><span>${label}</span>`;
      b.setAttribute('aria-label',`Включить ${theme==='dark'?'светлую':'тёмную'} тему`);b.title=b.getAttribute('aria-label');
    });
  }
  apply(theme);
  function ready(){
    apply(theme);
    document.addEventListener('click',event=>{if(!event.target.closest('[data-theme-toggle]'))return;apply(theme==='dark'?'light':'dark');try{localStorage.setItem(key,theme);}catch{}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  window.addEventListener('storage',event=>{if(event.key===key)apply(event.newValue==='light'?'light':'dark');});
})();
