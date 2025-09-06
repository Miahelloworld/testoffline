
(async function(){
  try{
    const res = await fetch('./sura-names.json');
    const names = await res.json();
    // Try common selectors; adjust if needed
    const candidates = document.querySelectorAll('[data-sura], .sura, .sura-item, nav a');
    candidates.forEach(el=>{
      let n = el.getAttribute('data-sura') || el.dataset.sura;
      if(!n){
        const m = (el.textContent||'').match(/^\s*(\d{1,3})\s*$/);
        if(m) n = m[1];
      }
      if(n && names[String(n)]){
        if(!/第\s*\d+\s*章/.test(el.textContent)){
          el.textContent = `第 ${n} 章 ${names[String(n)]}`;
        }
      }
    });
  }catch(e){
    console.warn('pc-patch failed:', e);
  }
})();
