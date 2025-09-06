
const TRANSLATORS = [
  { key: 'mazhonggang', name: '马仲刚' },
  { key: 'majinpeng', name: '马金鹏' },
  { key: 'tongdaozhang', name: '仝道章' },
  { key: 'wangjingzhai', name: '王静斋' },
  { key: 'majian', name: '马坚' },
];
const DATA_DIR = './data';
const STATE = {
  loaded: {},      // key -> Array<{sura,aya,text,translator}>
  selectedTr: new Set(TRANSLATORS.map(t=>t.name)),
  suraNames: {},   // '1' -> '开端(法谛海)'
  currentSura: null,
  query: ''
};

// File-picker fallback function to read data from a user-selected folder (webkitdirectory) or files
async function promptToPickDataDir(){
  const input = document.getElementById("file-picker");
  if(!input) throw new Error('file-picker element not found');
  return new Promise((resolve,reject)=>{
    input.onchange = async (e)=>{
      try{
        const files = Array.from(e.target.files || []);
        for(const file of files){
          const name = file.name.toLowerCase();
          try{
            const text = await file.text();
            const data = JSON.parse(text);
            if(name.includes('sura-names')){
              // if file contains mapping object or array, normalize
              STATE.suraNames = data;
            }
            for(const t of TRANSLATORS){
              if(name.includes(t.key) || name.includes(t.name.replace(/[\u4e00-\u9fa5]/g,'')) || name.includes(t.name)){
                // assume file matches translator
                STATE.loaded[t.key] = Array.isArray(data) ? data : (data[t.key] || []);
              }
            }
          }catch(err){
            console.warn('Failed parse file', file.name, err);
          }
        }
        // Also try to detect plain translator filenames like mazhonggang.json etc
        resolve();
      }catch(err){
        reject(err);
      }
    };
    // trigger picker
    input.click();
  });
}

// --- UI Helpers ---
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const show = (el) => el.removeAttribute('hidden');
const hide = (el) => el.setAttribute('hidden','');

function setStatus(msg, type='warn'){
  const box = $('#status');
  if(!msg){ hide(box); box.textContent=''; return; }
  box.innerHTML = msg;
  box.style.display = 'block';
  show(box);
}

// Drawer
function openDrawer(){ $('#drawer').classList.add('open'); $('#backdrop').hidden=false; $('#drawer').setAttribute('aria-hidden','false'); }
function closeDrawer(){ $('#drawer').classList.remove('open'); $('#backdrop').hidden=true; $('#drawer').setAttribute('aria-hidden','true'); }

// Load sura names
async function loadSuraNames(){
  try{
    // If running from file://, fetch may be blocked by browser.
    if(location.protocol === 'file:'){
      throw new Error('file protocol');
    }
    const res = await fetch('./sura-names.json');
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    STATE.suraNames = await res.json();
  }catch(e){
    // fallback to file-picker
    setStatus('无法读取 sura-names.json（自动 fetch 失败）。请点击此提示并选择包含数据的文件夹或单个 JSON 文件。');
    document.getElementById('status').onclick = async ()=>{
      try{
        await promptToPickDataDir();
        setStatus('已从本地目录载入数据。');
        buildSuraList();
      }catch(err){
        setStatus('目录读取失败：' + err.message);
      }
    };
  }
}

// Build drawer list
function buildSuraList(){
  const container = $('#sura-list');
  container.innerHTML = '';
  for(let i=1;i<=114;i++){
    const item = document.createElement('div');
    item.className = 'sura-item';
    item.dataset.sura = String(i);
    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = i;
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = STATE.suraNames[String(i)] || ('第 ' + i + ' 章');
    item.append(num, name);
    container.appendChild(item);
  }
  container.addEventListener('click', async (e)=>{
    const row = e.target.closest('.sura-item');
    if(!row) return;
    const sura = Number(row.dataset.sura);
    closeDrawer();
    await ensureAllSelectedLoaded();
    renderSura(sura);
  });
}

// Translator selection sync (checkbox <-> grid)
function syncTranslatorUI(){
  const names = STATE.selectedTr;
  $$('.translator').forEach(cb=>{ cb.checked = names.has(cb.value); });
  $$('#grid-toggles .grid-btn').forEach(btn=>{
    if(names.has(btn.dataset.tr)) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function bindTranslatorControls(){
  // checkbox
  $$('.translator').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      if(cb.checked) STATE.selectedTr.add(cb.value);
      else STATE.selectedTr.delete(cb.value);
      syncTranslatorUI();
      if(STATE.currentSura) renderSura(STATE.currentSura);
      else if(STATE.query) search();
    });
  });
  // grid buttons
  $$('#grid-toggles .grid-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const name = btn.dataset.tr;
      if(STATE.selectedTr.has(name)) STATE.selectedTr.delete(name);
      else STATE.selectedTr.add(name);
      syncTranslatorUI();
      if(STATE.currentSura) renderSura(STATE.currentSura);
      else if(STATE.query) search();
    });
  });
}

// Lazy load one translator file
async function loadTranslator(key, name){
  if(STATE.loaded[key]) return STATE.loaded[key];
  try{
    show($('#loading'));
    // If running from file://, fetch may be blocked. Try fetch but fall back to file-picker
    if(location.protocol === 'file:'){
      throw new Error('file protocol');
    }
    const res = await fetch(`${DATA_DIR}/${key}.json`);
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error('数据不是数组');
    STATE.loaded[key] = data;
    return data;
  }catch(e){
    // Fallback to file-picker (for file:// env or other fetch failures)
    setStatus(`无法读取 ${name} 数据（${key}.json）：${e.message}。请点击此处并选择 data 文件夹或 JSON 文件。`);
    document.getElementById('status').onclick = async ()=>{
      try{
        await promptToPickDataDir();
        setStatus('已从本地目录载入数据。');
      }catch(err){
        setStatus('目录读取失败：' + err.message);
      }
    };
    hide($('#loading'));
    throw e;
  }finally{
    hide($('#loading'));
  }
}

async function ensureAllSelectedLoaded(){
  const need = TRANSLATORS.filter(t=>STATE.selectedTr.has(t.name));
  for(const t of need){
    if(!STATE.loaded[t.key]){
      await loadTranslator(t.key, t.name);
    }
  }
}

// Render a sura
function renderSura(sura){
  STATE.currentSura = sura;
  STATE.query = '';
  const results = $('#results');
  results.innerHTML = '';
  const tpl = $('#tpl-aya');
  // Build combined map: aya -> { aya, items: [ {tr, text} ] }
  const map = new Map();
  for(const t of TRANSLATORS){
    if(!STATE.selectedTr.has(t.name)) continue;
    const arr = STATE.loaded[t.key] || [];
    for(const rec of arr){
      if(rec.sura === sura){
        const key = rec.aya;
        if(!map.has(key)) map.set(key, {aya: key, items: []});
        map.get(key).items.push({ tr: rec.translator || t.name, text: rec.text || '' });
      }
    }
  }
  const sorted = Array.from(map.values()).sort((a,b)=>a.aya-b.aya);
  for(const row of sorted){
    const node = tpl.content.firstElementChild.cloneNode(true);
    $('.aya-meta', node).textContent = `第 ${sura} 章（${STATE.suraNames[String(sura)] || ''}） · 第 ${row.aya} 节`;
    const cards = $('.cards', node);
    for(const item of row.items){
      const card = document.createElement('div');
      card.className = 'card';
      const tr = document.createElement('div');
      tr.className = 'tr';
      tr.textContent = item.tr;
      const txt = document.createElement('div');
      txt.className = 'txt';
      txt.innerHTML = escapeHTML(item.text);
      card.append(tr, txt);
      cards.appendChild(card);
    }
    results.appendChild(node);
  }
}

function escapeHTML(s){
  return (s||'').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
}

// --- Search ---
let worker;
function ensureWorker(){
  if(!worker){
    worker = new Worker('./worker.js');
    worker.onmessage = (ev)=>{
      const { type, payload } = ev.data;
      if(type === 'progress'){
        $('#loading').textContent = `加载中… ${payload.loaded}/${payload.total}`;
      }else if(type === 'done'){
        hide($('#loading'));
        renderSearchResults(payload.records, payload.query, payload.suraNames);
      }else if(type === 'error'){
        hide($('#loading'));
        setStatus('搜索出错：' + payload);
      }
    };
  }
}

function collectSelectedData(){
  const out = [];
  for(const t of TRANSLATORS){
    if(!STATE.selectedTr.has(t.name)) continue;
    const arr = STATE.loaded[t.key] || [];
    out.push({ key: t.key, name: t.name, data: arr });
  }
  return out;
}

function renderSearchResults(recs, query, suraNames){
  STATE.currentSura = null;
  STATE.query = query;
  const results = $('#results');
  results.innerHTML = '';
  const tpl = $('#tpl-aya');

  // group by (sura, aya)
  const groups = new Map();
  for(const r of recs){
    const gk = `${r.sura}:${r.aya}`;
    if(!groups.has(gk)) groups.set(gk, []);
    groups.get(gk).push(r);
  }

  const ordered = Array.from(groups.entries()).sort((a,b)=>{
    const [sa,aa] = a[0].split(':').map(Number);
    const [sb,ab] = b[0].split(':').map(Number);
    return sa-sb || aa-ab;
  });

  for(const [gk, items] of ordered){
    const [sura, aya] = gk.split(':').map(Number);
    const node = tpl.content.firstElementChild.cloneNode(true);
    $('.aya-meta', node).textContent = `第 ${sura} 章（${suraNames[String(sura)] || ''}） · 第 ${aya} 节`;
    const cards = $('.cards', node);
    // ensure order by translators for consistency
    for(const t of TRANSLATORS){
      const item = items.find(x=>x.translator===t.name);
      if(!item) continue;
      const card = document.createElement('div');
      card.className = 'card';
      const tr = document.createElement('div');
      tr.className = 'tr';
      tr.textContent = t.name;
      const txt = document.createElement('div');
      txt.className = 'txt';
      txt.innerHTML = item.highlighted;
      card.append(tr, txt);
      cards.appendChild(card);
    }
    results.appendChild(node);
  }
}

async function search(){
  const q = $('#q').value.trim();
  if(!q){ setStatus('请输入关键词'); return; }
  await ensureAllSelectedLoaded();
  ensureWorker();
  show($('#loading')); $('#loading').textContent = '加载中…';
  setStatus('');
  const payload = {
    query: q,
    selected: Array.from(STATE.selectedTr),
    datasets: collectSelectedData(),
    suraNames: STATE.suraNames
  };
  worker.postMessage({ type: 'search', payload });
}

function bindSearch(){
  $('#btn-search').addEventListener('click', search);
  $('#q').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') search();
  });
}

// Boot
(async function(){
  // Drawer bindings
  $('#btn-drawer').addEventListener('click', openDrawer);
  $('#btn-drawer-close').addEventListener('click', closeDrawer);
  $('#backdrop').addEventListener('click', closeDrawer);

  bindTranslatorControls();
  syncTranslatorUI();
  await loadSuraNames();
  buildSuraList();
  bindSearch();

  // Optional: auto open drawer on first load for discoverability
  setTimeout(openDrawer, 200);
})();
