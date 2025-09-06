
/* Adapter: Convert legacy QURAN_DATA structure to QDATA expected by app.js */
(function(){
  if (typeof window === 'undefined') return;
  if (!window.QURAN_DATA) return;
  window.QDATA = window.QDATA || {};
  const map = {
    "马仲刚": "mazhonggang",
    "马金鹏": "majinpeng",
    "仝道章": "tongdaozhang",
    "王静斋": "wangjingzhai",
    "马坚":   "majian",
  };
  for (const cname in map) {
    const k = map[cname];
    const arr = window.QURAN_DATA[cname] || [];
    // Ensure each record conforms to {sura, aya, text, translator}
    window.QDATA[k] = arr.map(r => ({
      sura: Number(r.sura),
      aya: Number(r.aya),
      text: String(r.text || ""),
      translator: r.translator || cname
    }));
  }
})();
