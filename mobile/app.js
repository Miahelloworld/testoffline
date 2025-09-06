// app.js - Mobile offline app (no fetch). Uses window.QDATA (from data/*.data.js) and window.SURA_NAMES (from sura-names.js)
const TRANSLATORS = [
  { key: 'mazhonggang', name: '马仲刚' },
  { key: 'majinpeng', name: '马金鹏' },
  { key: 'tongdaozhang', name: '仝道章' },
  { key: 'wangjingzhai', name: '王静斋' },
  { key: 'majian', name: '马坚' },
];

const STATE = {
  selectedTr: new Set(TRANSLATORS.map(t=>t.key)),
  suraNames: window.SURA_NAMES || {},
  q: '',
  currentSura: null
};

function $(sel){ return document.querySelector(sel); }
function $all(sel){ return Array.from(document.querySelectorAll(sel)); }
function show(el){ if(!el) return; el.hidden = false; el.style.display='block'; }
function hide(el){ if(!el) return; el.hidden = true; el.style.display='none'; }
function setStatus(msg){ const s = $('#status'); if(!msg){ hide(s); s.textContent=''; return;} s.textContent = msg; show(s); }

let worker;
function ensureWorker(){
  if(worker) return;
  worker = new Worker('./worker.js');
  worker.onmessage = (ev)=>{
    const { type, payload } = ev.data;
    if(type === 'progress'){
      const ld = $('#loading'); show(ld); ld.textContent = `加载中… ${payload.loaded}/${payload.total}`;
    }else if(type === 'done'){
      hide($('#loading'));
      renderSearchResults(payload.records, payload.query, payload.suraNames);
    }else if(type === 'error'){
      hide($('#loading'));
      setStatus('搜索出错：' + payload);
    }
  };
}

function collectSelectedData(){
  const out = [];
  for(const t of TRANSLATORS){
    if(!STATE.selectedTr.has(t.key)) continue;
    const arr = (window.QDATA && window.QDATA[t.key]) || [];
    out.push({ name: t.name, key: t.key, data: arr });
  }
  return out;
}

function renderSearchResults(records, query, suraNames){
  const results = $('#results');
  results.innerHTML = '';
  if(!records || records.length===0){
    results.innerHTML = '<div class="aya-row"><div class="aya-meta">未找到匹配结果</div></div>';
    return;
  }
  // group by sura->aya and then show cards horizontally
  const map = new Map();
  for(const r of records){
    const k = `${r.sura}:${r.aya}`;
    if(!map.has(k)) map.set(k, {sura:r.sura, aya:r.aya, items:[]});
    map.get(k).items.push(r);
  }
  for(const [k, group] of map){
    const tpl = document.getElementById('tpl-aya');
    const node = tpl.content.cloneNode(true);
    const row = node.querySelector('.aya-row');
    row.querySelector('.sura-num').textContent = group.sura;
    row.querySelector('.aya-num').textContent = group.aya;
    row.querySelector('.aya-name').textContent = (STATE.suraNames && STATE.suraNames[String(group.sura)]) || '';
    const cards = row.querySelector('.cards');
    // For each translator, show its card (maintain order of TRANSLATORS)
    for(const t of TRANSLATORS){
      // find matching item in group.items for this translator
      const rec = group.items.find(it => (it.translator || t.name) === t.name);
      const card = document.createElement('div'); card.className='card';
      const tr = document.createElement('div'); tr.className='tr';
      tr.textContent = t.name;
      const txt = document.createElement('div'); txt.className='txt';
      if(rec){
        txt.innerHTML = rec.highlighted || escapeHTML(rec.text || '');
      }else{
        txt.textContent = '[此章节在此译本中未找到]';
      }
      card.appendChild(tr); card.appendChild(txt);
      cards.appendChild(card);
    }
    results.appendChild(node);
  }
  // smooth scroll to top of results
  results.scrollIntoView({behavior:'smooth'});
}

function escapeHTML(s){
  return (s||'').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
}

async function search(){
  const q = $('#q').value.trim();
  if(!q){ setStatus('请输入关键词'); return; }
  setStatus('');
  const datasets = collectSelectedData();
  if(datasets.length === 0){
    setStatus('请至少选择一个译本');
    return;
  }
  ensureWorker();
  show($('#loading')); $('#loading').textContent = '加载中…';
  const payload = { query: q, datasets, suraNames: STATE.suraNames };
  worker.postMessage({ type:'search', payload });
}

function buildSuraList(){
  const container = $('#sura-list');
  container.innerHTML = '';
  for(let i=1;i<=114;i++){
    const item = document.createElement('div');
    item.className = 'sura-item';
    item.dataset.sura = String(i);
    const num = document.createElement('div'); num.className='num'; num.textContent = i;
    const name = document.createElement('div'); name.className='name'; name.textContent = STATE.suraNames[String(i)] || '';
    item.appendChild(num); item.appendChild(name);
    item.addEventListener('click', async ()=>{
      closeDrawer();
      renderSura(i);
    });
    container.appendChild(item);
  }
}

function renderSura(sura){
  STATE.currentSura = sura;
  STATE.q = '';
  const results = $('#results');
  results.innerHTML = '';
  // build map aya -> [items]
  const map = new Map();
  for(const t of TRANSLATORS){
    if(!STATE.selectedTr.has(t.key)) continue;
    const arr = (window.QDATA && window.QDATA[t.key]) || [];
    for(const rec of arr){
      if(rec.sura !== sura) continue;
      const k = rec.aya;
      if(!map.has(k)) map.set(k, {aya:k, items:[]});
      map.get(k).items.push({ translator: t.name, text: rec.text });
    }
  }
  // iterate ayas in order
  const ayas = Array.from(map.keys()).sort((a,b)=>a-b);
  if(ayas.length === 0){
    results.innerHTML = '<div class="aya-row"><div class="aya-meta">本章在选中译本中未找到经文</div></div>';
    return;
  }
  for(const aya of ayas){
    const tpl = document.getElementById('tpl-aya');
    const node = tpl.content.cloneNode(true);
    const row = node.querySelector('.aya-row');
    row.querySelector('.sura-num').textContent = sura;
    row.querySelector('.aya-num').textContent = aya;
    row.querySelector('.aya-name').textContent = (STATE.suraNames && STATE.suraNames[String(sura)]) || '';
    const cards = row.querySelector('.cards');
    for(const t of TRANSLATORS){
      const found = map.get(aya).items.find(it=>it.translator===t.name);
      const card = document.createElement('div'); card.className='card';
      const tr = document.createElement('div'); tr.className='tr'; tr.textContent = t.name;
      const txt = document.createElement('div'); txt.className='txt';
      if(found) txt.textContent = found.text; else txt.textContent='[无]';
      card.appendChild(tr); card.appendChild(txt);
      cards.appendChild(card);
    }
    results.appendChild(node);
  }
  results.scrollIntoView({behavior:'smooth'});
}

function openDrawer(){ $('#drawer').classList.add('open'); $('#backdrop').hidden=false; $('#drawer').setAttribute('aria-hidden','false'); }
function closeDrawer(){ $('#drawer').classList.remove('open'); $('#backdrop').hidden=true; $('#drawer').setAttribute('aria-hidden','true'); }

function bindUI(){
  $('#btn-drawer').addEventListener('click', openDrawer);
  $('#btn-drawer-close').addEventListener('click', closeDrawer);
  $('#backdrop').addEventListener('click', closeDrawer);
  $('#btn-search').addEventListener('click', search);
  $('#q').addEventListener('keydown', (e)=>{ if(e.key==='Enter') search(); });

  // checkboxes sync with tiles
  $all('.tr-cb').forEach(cb=>{
    cb.addEventListener('change', (e)=>{
      const key = cb.dataset.key;
      if(cb.checked) STATE.selectedTr.add(key); else STATE.selectedTr.delete(key);
      // sync tile active state
      const tile = document.querySelector(`.tile[data-key="${key}"]`);
      if(tile) tile.classList.toggle('active', cb.checked);
    });
  });
  $all('.tile').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = btn.dataset.key;
      const cb = document.querySelector(`.tr-cb[data-key="${key}"]`);
      const now = !btn.classList.contains('active');
      btn.classList.toggle('active', now);
      if(cb){ cb.checked = now; cb.dispatchEvent(new Event('change')); }
    });
  });
}

(function init(){
  // ensure QDATA exists
  if(!window.QDATA){
    setStatus('数据未找到：请确保 data/*.data.js 已正确包含。');
    return;
  }
  // build sura list and bind UI
  buildSuraList();
  bindUI();
  // initial hint
  setTimeout(()=>{ openDrawer(); }, 200);
})();
