
/* Quran Offline Search (pure HTML+CSS+JS, file:// ready)
   - Loads JSON via <script> data wrappers (window.QDATA)
   - Optional: attempts fetch from /data/*.json (works if served)
   - Features:
     * Left 1..114 surah navigation
     * Keyword AND search, regex mode
     * Translator filters (checkboxes)
     * Highlight matches, loading overlay
     * Single-row 5-card layout with horizontal scroll
*/

const TRANSLATORS = [
  { key: 'mazhonggang', label: '马仲刚' },
  { key: 'majinpeng', label: '马金鹏' },
  { key: 'tongdaozhang', label: '仝道章' },
  { key: 'wangjingzhai', label: '王静斋' },
  { key: 'majian', label: '马坚' },
];

const state = {
  data: {},        // { key: [ {sura,aya,text,translator}, ... ] }
  loaded: false,
  filters: new Set(TRANSLATORS.map(t => t.key)),
  regexMode: false,
  query: '',
  activeSura: null,
};

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

function showLoading(on=true) {
  const overlay = $('.loading');
  overlay.classList.toggle('show', on);
}

async function maybeFetchJSON(key) {
  // Try fetch if running with http(s); file:// may fail due to CORS.
  const url = `data/${key}.json`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('HTTP '+resp.status);
    const json = await resp.json();
    return json;
  } catch (err) {
    // Fallback to preloaded window.QDATA
    if (window.QDATA && window.QDATA[key]) return window.QDATA[key];
    console.warn('Fetch failed for', key, 'falling back to QDATA. Reason:', err.message);
    return [];
  }
}

async function loadAll() {
  showLoading(true);
  // Load in parallel
  const results = await Promise.all(TRANSLATORS.map(async t => {
    const arr = await maybeFetchJSON(t.key);
    return [t.key, arr];
  }));
  for (const [k, arr] of results) state.data[k] = arr;
  state.loaded = true;
  showLoading(false);
}

function buildSidebar() {
  const ul = $('.slist');
  const frag = document.createDocumentFragment();
  for (let s = 1; s <= 114; s++) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = 'sbtn';
    btn.textContent = `第 ${s} 章`;
    btn.addEventListener('click', () => {
      $$('.sbtn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeSura = s;
      renderSura(s);
    });
    li.appendChild(btn);
    frag.appendChild(li);
  }
  ul.appendChild(frag);
}

function getFilteredDataForSura(s) {
  // returns array of rows [{sura,aya, perTranslator:{key:rec}}]
  const keys = Array.from(state.filters);
  // Build per translator maps for quick merge
  const maps = {};
  let maxAya = 0;
  for (const k of keys) {
    const list = state.data[k] || [];
    const filtered = list.filter(r => r.sura === s);
    const mapByAya = new Map(filtered.map(r => [r.aya, r]));
    maps[k] = mapByAya;
    for (const a of mapByAya.keys()) maxAya = Math.max(maxAya, a);
  }
  // For ayas from 1..maxAya, collect
  const rows = [];
  for (let a = 1; a <= maxAya; a++) {
    const per = {};
    for (const k of keys) { per[k] = maps[k].get(a) || null; }
    rows.push({ sura: s, aya: a, perTranslator: per });
  }
  return rows;
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function makeMatcher(query, regexMode) {
  if (!query.trim()) return () => true;
  if (regexMode) {
    try {
      const rx = new RegExp(query, 'i');
      return txt => rx.test(txt);
    } catch {
      // invalid regex, fallback to literal
      const safe = escapeRegExp(query);
      const rx2 = new RegExp(safe, 'i');
      return txt => rx2.test(txt);
    }
  } else {
    const tokens = query.split(/\s+/).filter(Boolean).map(t => t.trim());
    return txt => tokens.every(t => txt.toLowerCase().includes(t.toLowerCase()));
  }
}

function highlight(text, query, regexMode) {
  if (!query.trim()) return text;
  if (regexMode) {
    try {
      const rx = new RegExp(query, 'gi');
      return text.replace(rx, m => `<mark class="hl">${m}</mark>`);
    } catch {
      // invalid regex fallback
      const safe = escapeRegExp(query);
      const rx2 = new RegExp(safe, 'gi');
      return text.replace(rx2, m => `<mark class="hl">${m}</mark>`);
    }
  } else {
    const tokens = query.split(/\s+/).filter(Boolean);
    let out = text;
    for (const t of tokens) {
      const rx = new RegExp(escapeRegExp(t), 'gi');
      out = out.replace(rx, m => `<mark class="hl">${m}</mark>`);
    }
    return out;
  }
}

function renderSura(s) {
  const results = $('.results');
  results.innerHTML = '';
  if (!state.loaded) return;
  const rows = getFilteredDataForSura(s);
  if (!rows.length) {
    results.innerHTML = `<div class="empty">本章暂无数据（请检查数据文件）。</div>`;
    return;
  }
  const matcher = makeMatcher(state.query, state.regexMode);
  for (const row of rows) {
    // If query present, only render rows where ANY translator text matches
    if (state.query.trim()) {
      const anyMatch = Object.values(row.perTranslator).some(rec => {
        if (!rec) return false;
        return matcher(rec.text || '');
      });
      if (!anyMatch) continue;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'verse-row';
    for (const t of TRANSLATORS) {
      if (!state.filters.has(t.key)) continue;
      const rec = row.perTranslator[t.key];
      const card = document.createElement('div');
      card.className = 'tcard';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<span>第 ${row.sura}:${row.aya}</span><span class="name">${t.label}</span>`;
      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      const txt = rec && rec.text ? rec.text : '—';
      textDiv.innerHTML = highlight(txt, state.query, state.regexMode);
      card.appendChild(meta);
      card.appendChild(textDiv);
      wrapper.appendChild(card);
    }
    results.appendChild(wrapper);
  }
  if (!results.children.length) {
    results.innerHTML = `<div class="empty">没有匹配结果。尝试更换关键词或取消勾选“正则表达式”。</div>`;
  }
}

function renderSearchResults() {
  // Search across all suras: group by (sura,aya)
  const results = $('.results');
  results.innerHTML = '';
  if (!state.loaded) return;
  const matcher = makeMatcher(state.query, state.regexMode);
  const selected = Array.from(state.filters);
  // Build index per translator
  const perKey = selected.map(k => [k, state.data[k] || []]);
  const grouped = new Map(); // key "s:a" -> {sura,aya, perTranslator:{}}
  for (const [k, arr] of perKey) {
    for (const rec of arr) {
      if (!matcher(rec.text || '')) continue;
      const gid = `${rec.sura}:${rec.aya}`;
      if (!grouped.has(gid)) grouped.set(gid, { sura: rec.sura, aya: rec.aya, perTranslator: {} });
      grouped.get(gid).perTranslator[k] = rec;
    }
  }
  const rows = Array.from(grouped.values()).sort((a,b)=> (a.sura-b.sura)|| (a.aya-b.aya));
  if (!rows.length) {
    results.innerHTML = `<div class="empty">没有匹配结果。</div>`;
    return;
  }
  for (const row of rows) {
    const wrapper = document.createElement('div');
    wrapper.className = 'verse-row';
    for (const t of TRANSLATORS) {
      if (!state.filters.has(t.key)) continue;
      const rec = row.perTranslator[t.key];
      const card = document.createElement('div');
      card.className = 'tcard';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<span>第 ${row.sura}:${row.aya}</span><span class="name">${t.label}</span>`;
      const textDiv = document.createElement('div');
      textDiv.className = 'text';
      const txt = rec && rec.text ? rec.text : '—';
      textDiv.innerHTML = highlight(txt, state.query, state.regexMode);
      card.appendChild(meta);
      card.appendChild(textDiv);
      wrapper.appendChild(card);
    }
    results.appendChild(wrapper);
  }
}

function bindUI() {
  // Filters
  const filterWrap = $('#filter-translators');
  for (const t of TRANSLATORS) {
    const id = `flt-${t.key}`;
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" id="${id}" checked> ${t.label}`;
    filterWrap.appendChild(label);
    $('#'+id).addEventListener('change', (e) => {
      if (e.target.checked) state.filters.add(t.key);
      else state.filters.delete(t.key);
      state.activeSura ? renderSura(state.activeSura) : renderSearchResults();
    });
  }
  // Regex toggle
  $('#regex').addEventListener('change', (e) => {
    state.regexMode = e.target.checked;
    state.activeSura ? renderSura(state.activeSura) : renderSearchResults();
  });
  // Search input and button
  const input = $('#q');
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#go').click();
  });
  $('#go').addEventListener('click', () => {
    state.query = input.value || '';
    state.activeSura = null; // go to search mode
    // Clear active highlight in sidebar
    $$('.sbtn').forEach(b => b.classList.remove('active'));
    renderSearchResults();
  });
}

function init() {
  buildSidebar();
  bindUI();
  loadAll().then(() => {
    // initial render empty
  });
}

document.addEventListener('DOMContentLoaded', init);
