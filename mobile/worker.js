// worker.js - performs search over provided datasets (runs in Web Worker)
function parseQuery(q){
  q = (q||'').trim();
  if(/^\/.+\/[a-z]*$/i.test(q)){
    const m = q.match(/^\/(.+)\/([a-z]*)$/i);
    try{
      return { type: 'regex', re: new RegExp(m[1], m[2]) };
    }catch(e){ /* fallthrough */ }
  }
  const toks = q.split(/\s+/).filter(Boolean);
  return { type: 'tokens', tokens: toks };
}

function escapeRegExp(s){
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text, query){
  if(!text) return text || '';
  if(!query) return text;
  if(query.type === 'regex'){
    try{
      return text.replace(query.re, (m)=>('<mark>'+m+'</mark>'));
    }catch(e){ return text; }
  }else if(query.type === 'tokens'){
    let out = text;
    // for multiple tokens, avoid nested marks by applying sequentially with simple approach
    for(const tk of query.tokens){
      if(!tk) continue;
      try{
        const re = new RegExp(escapeRegExp(tk), 'gi');
        out = out.replace(re, (m)=>('<mark>'+m+'</mark>'));
      }catch(e){ /* ignore bad token */ }
    }
    return out;
  }
  return text;
}

onmessage = function(e){
  const { type, payload } = e.data || {};
  if(type === 'search'){
    const { query: q, datasets, suraNames } = payload || {};
    try{
      const qobj = parseQuery(q||'');
      const out = [];
      // total for progress
      let total = 0;
      for(const ds of datasets || []){ total += (ds.data && ds.data.length) || 0; }
      let processed = 0;
      const PROGRESS_INTERVAL = Math.max(500, Math.floor(total/100) );
      for(const ds of datasets || []){
        const dsArr = ds.data || [];
        const dsName = ds.name || ds.key || '未知';
        for(const rec of dsArr){
          processed++;
          if(processed % PROGRESS_INTERVAL === 0){
            postMessage({ type:'progress', payload:{ loaded: processed, total } });
          }
          const text = rec.text || '';
          let matched = false;
          if(qobj.type === 'regex'){
            try{ matched = qobj.re.test(text); }catch(e){ matched = false; }
          }else if(qobj.type === 'tokens'){
            matched = qobj.tokens.every(tk => {
              if(!tk) return true;
              try { return new RegExp(escapeRegExp(tk), 'i').test(text); }
              catch(e){ return false; }
            });
          }
          if(matched){
            out.push({
              sura: rec.sura,
              aya: rec.aya,
              translator: rec.translator || dsName,
              highlighted: highlightText(text, qobj),
              text: rec.text
            });
          }
        }
      }
      postMessage({ type:'done', payload:{ records: out, query: q, suraNames } });
    }catch(err){
      postMessage({ type:'error', payload: err.message || String(err) });
    }
  }
};