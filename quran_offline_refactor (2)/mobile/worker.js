
// worker.js
function parseQuery(q){
  q = q.trim();
  if(/^\/.+\/[a-z]*$/i.test(q)){
    const m = q.match(/^\/(.+)\/([a-z]*)$/i);
    try{
      return { type: 'regex', re: new RegExp(m[1], m[2]) };
    }catch(e){ /* fallthrough */ }
  }
  // simple tokens (AND)
  const toks = q.split(/\s+/).filter(Boolean);
  return { type: 'tokens', tokens: toks };
}

function highlight(text, query){
  if(!text) return '';
  if(query.type === 'regex'){
    return text.replace(query.re, m => `<mark>${escape(m)}</mark>`);
  }else{
    // multiple tokens AND: highlight all
    let html = escape(text);
    for(const t of query.tokens){
      const re = new RegExp(escapeRegExp(t), 'gi');
      html = html.replace(re, m=>`<mark>${m}</mark>`);
    }
    return html;
  }
}

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escape(s){ return (s||'').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }

onmessage = function(ev){
  const { type, payload } = ev.data;
  if(type !== 'search') return;
  try{
    const { query, selected, datasets, suraNames } = payload;
    const q = parseQuery(query);
    const out = [];
    let total = datasets.reduce((a,b)=>a + (b.data?b.data.length:0), 0);
    let loaded = 0;
    for(const ds of datasets){
      const arr = ds.data || [];
      for(const rec of arr){
        loaded++; if(loaded % 2000 === 0) postMessage({type:'progress', payload:{loaded, total}});
        // translator filter already applied by datasets
        const text = rec.text || '';
        let ok = false;
        if(q.type === 'regex'){
          ok = q.re.test(text);
        }else{
          ok = q.tokens.every(t => text.toLowerCase().includes(t.toLowerCase()));
        }
        if(ok){
          out.push({
            sura: rec.sura,
            aya: rec.aya,
            translator: rec.translator || ds.name,
            highlighted: highlight(text, q)
          });
        }
      }
    }
    postMessage({ type:'done', payload:{ records: out, query, suraNames } });
  }catch(e){
    postMessage({ type:'error', payload: e.message });
  }
};
