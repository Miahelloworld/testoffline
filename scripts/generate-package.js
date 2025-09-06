#!/usr/bin/env node
/**
 * generate-package.js
 *
 * 用途：
 *  - 从 quran_offline_refactor (2)/mobile/data 下读取五个译本的原始 JSON（文件名严格为：majian.json, mazhonggang.json, majinpeng.json, tongdaozhang.json, wangjingzhai.json）
 *  - 按 sura 字段拆分为 114 个分片文件：<translator>.sNNN.js（NNN 为 001..114）
 *  - 生成 mobile/ 的静态文件（index.html, css/mobile.css, js/app.js, js/data-loader.js, data/sura-names.data.js）
 *  - 同时保留原始 .json（不删除）
 *  - 将生成后的 mobile/ 与 pc/（如果存在）打包为 output/quran_mobile_package.zip
 *
 * 使用方法（在 GitHub Actions 或本地）：
 *  1. 在项目根目录运行：npm install archiver mkdirp
 *  2. 运行：node scripts/generate-package.js
 *
 * 生成文件将放在 ./output/quran_mobile_package.zip，脚本也会在 ./dist/mobile/ 生成未压缩的文件。
 */

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const archiver = require('archiver');

const ROOT = process.cwd();
// NOTE: use the repository's actual path that contains the JSON files (contains a space and parentheses)
const SRC_DATA_DIR = path.join(ROOT, 'quran_offline_refactor (2)', 'mobile', 'data');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_MOBILE = path.join(DIST_DIR, 'mobile');
const OUTPUT_ZIP = path.join(ROOT, 'output', 'quran_mobile_package.zip');

const translators = [
  { key: 'majian', name: '马坚' },
  { key: 'mazhonggang', name: '马仲刚' },
  { key: 'majinpeng', name: '马金鹏' },
  { key: 'tongdaozhang', name: '仝道章' },
  { key: 'wangjingzhai', name: '王静斋' }
];

// Sura 名称数组（1..114）
const SURA_NAMES = [
"开端(法谛海)","黄牛(巴格勒)","仪姆兰的家属(阿黎仪姆兰)","妇女(尼萨仪)","筵席(马以代)","牲畜(艾奈阿姆)","高处(艾耳拉弗)","战利品(安法勒)","忏悔(讨白)","优努斯",
"呼德","优素福","雷霆(赖尔得)","易卜拉欣","石谷(希只尔)","蜜蜂(奈哈勒)","夜行(伊斯拉)","山洞(凯海府)",
"麦尔彦","塔哈","众先知(安比雅)","朝觐(哈只)","信士(慕米歌)","光明(努尔)","准则(弗尔干)",
"众诗人(抒尔拉)","蚂蚁(奈木勒)","故事(改赛素)","蜘蛛(安凯逋特)","罗马人(鲁姆)",
"鲁格曼","叩头(赛直德)","同盟军(艾哈萨布)","赛伯邑","创造者(法颓尔)","雅辛","列班者(萨法特)","萨德",
"队伍(助迈尔)","赦宥者(阿斐尔)","奉绥来特","协商(舒拉)","金饰(助赫鲁弗)","烟雾(睹罕)","屈膝(查西叶)","沙丘(艾哈嘎弗)",
"穆罕默德","胜利(费特哈)","寝室(侯主拉特)","戛弗","播种者 (达理雅特)","山岳(突尔)","星宿(奈智姆 )","月亮(改买尔)",
"至仁主(安赖哈曼)","大事(瓦格尔)","铁(哈迪德)","辩诉者(姆查衣赖)","放逐(哈什尔)","受考验的妇人(慕姆太哈奈)",
"列阵(蒜弗)","聚礼(主麻)","伪信者(莫拿非恭)","相欺(台昂卜尼)","离婚(特拉格)","禁戒(台哈列姆)","国权(姆勒克)","笔(改赖姆)",
"真灾(哈盖)","天梯(买阿列支)","努哈","精灵(精尼)","披衣的人(孟赞密鲁)","盖被的人(孟荡西尔)","复活(格雅迈)","人(印萨尼)",
"天使(姆尔赛拉特)","消息(奈白易)","急掣的(那寂阿特)","皱眉(阿百塞)","黯黜 (太克威尔)","破裂(引斐塔尔)","称量不公(太颓斐弗)",
"绽裂(引史卡格)","十二宫(补鲁智)","启明星(塔里格)","至尊(艾尔拉)","大灾(阿史叶)","黎明(史智尔)","地方(白赖德)",
"太阳(晒姆斯)","黑夜(赖以里)","上午 (堵哈)","开拓(晒尔哈)","无花果(梯尼)","血块(阿赖格)","高贵(盖德尔)","明证(半以奈)",
"地震(齐勒萨里)","奔驰的马队(阿底雅特)","大难(葛里尔)","竞赛富庶(太卡素尔)","时光(阿斯尔)","诽谤者(胡买宰)","象(斐里)","古来氏",
"什物(马欧尼)","多福(考赛尔)","不通道的人们(卡斐伦)","援助(奈斯尔)","火焰(赖海卜)","忠诚(以赫拉斯)","曙光(法赖格)","世人(拿斯)"
];

function pad(n){ return String(n).padStart(3, '0'); }

function fileExists(p){ try{ fs.accessSync(p); return true;}catch(e){return false;} }

async function run(){
  console.log('prepare output dirs...');
  mkdirp.sync(DIST_MOBILE);
  mkdirp.sync(path.join(DIST_MOBILE, 'data'));
  mkdirp.sync(path.join(DIST_MOBILE, 'css'));
  mkdirp.sync(path.join(DIST_MOBILE, 'js'));
  mkdirp.sync(path.join(ROOT, 'output'));

  // 1. 读取并拆分 JSON
  for(const t of translators){
    const jsonPath = path.join(SRC_DATA_DIR, `${t.key}.json`);
    if(!fileExists(jsonPath)){
      console.warn(`警告：找不到 ${jsonPath}，请确认路径与文件名（大小写敏感）后重试。`);
      continue;
    }
    console.log(`读取 ${jsonPath} ...`);
    const raw = fs.readFileSync(jsonPath, 'utf8');
    let arr;
    try{ arr = JSON.parse(raw); }catch(e){ console.error(`解析 ${jsonPath} 失败:`, e); continue; }

    // 按 sura 分组
    const groups = {};
    arr.forEach(rec=>{
      const s = Number(rec.sura) || 0;
      if(s<1 || s>114) return;
      groups[s] = groups[s] || [];
      groups[s].push(rec);
    });

    // 为每一章生成 sNNN.js
    for(let s=1;s<=114;s++){ 
      const idx = pad(s);
      const outName = `${t.key}.s${idx}.js`;
      const outPath = path.join(DIST_MOBILE, 'data', outName);
      const data = groups[s] || [];
      const windowKey = `DATA_${t.key.toUpperCase()}_S${idx}`;
      const content = `// generated from ${t.key}.json\nwindow.${windowKey} = ${JSON.stringify(data, null, 2)};\n`;
      fs.writeFileSync(outPath, content, 'utf8');
    }

    // 另外复制原始 JSON 到 dist (保留备份)
    const copyJsonPath = path.join(DIST_MOBILE, 'data', `${t.key}.json`);
    fs.writeFileSync(copyJsonPath, JSON.stringify(arr, null, 2), 'utf8');
    console.log(`完成 ${t.key} 的分片生成（s001..s114）`);
  }

  // 2. 写入 sura-names.data.js
  const suraNamesPath = path.join(DIST_MOBILE, 'data', 'sura-names.data.js');
  fs.writeFileSync(suraNamesPath, `window.SURA_NAMES = ${JSON.stringify(SURA_NAMES, null, 2)};\n`, 'utf8');

  // 3. 写入示例 index.html、css、js（简化模板）
  const indexHtml = `<!doctype html>\n<html lang="zh-CN">\n<head>\n  <meta charset="utf-8" />\n  <meta name="viewport" content="width=device-width,initial-scale=1" />\n  <title>古兰经翻译查询 — 手机端</title>\n  <link rel="stylesheet" href="./css/mobile.css">\n</head>\n<body>\n  <div id="app" class="app">\n    <header class="topbar">\n      <button id="menuBtn" class="side-icon" aria-label="章节导航">☰</button>\n      <div class="title">古兰经翻译查询</div>\n    </header>\n    <aside id="suraNav" class="sura-nav hidden" aria-hidden="true">\n      <div class="sura-list" id="suraList"></div>\n    </aside>\n    <main class="main-content">\n      <section class="search-panel">\n        <input id="searchInput" placeholder="输入关键词或正则（示例：清洁 或 /^清洁/）" />\n        <button id="searchBtn">搜索</button>\n        <a class="desc">古兰经翻译查询工具</a>\n        <div class="translator-checkboxes">\n          <label><input type="checkbox" value="mazhonggang" checked>马仲刚</label>\n          <label><input type="checkbox" value="majinpeng" checked>马金鹏</label>\n          <label><input type="checkbox" value="tongdaozhang" checked>仝道章</label>\n          <label><input type="checkbox" value="wangjingzhai" checked>王静斋</label>\n          <label><input type="checkbox" value="majian" checked>���坚</label>\n        </div>\n      </section>\n      <section id="results" class="results"></section>\n    </main>\n  </div>\n\n  <script src="./data/sura-names.data.js"></script>\n  <!-- 仅预加载第1章五个译本 -->\n  <script src="./data/mazhonggang.s001.js"></script>\n  <script src="./data/majinpeng.s001.js"></script>\n  <script src="./data/tongdaozhang.s001.js"></script>\n  <script src="./data/wangjingzhai.s001.js"></script>\n  <script src="./data/majian.s001.js"></script>\n\n  <script src="./js/data-loader.js"></script>\n  <script src="./js/app.js"></script>\n</body>\n</html>`;
  fs.writeFileSync(path.join(DIST_MOBILE, 'index.html'), indexHtml, 'utf8');

  // css
  const css = `body{font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial;}\n.topbar{background:#0b3d91;color:#fff;padding:10px}\n.title{font-weight:700}\n`;
  fs.writeFileSync(path.join(DIST_MOBILE, 'css', 'mobile.css'), css, 'utf8');

  // js: data-loader.js (simple dynamic loader for additional sura files)
  const dataLoader = `(function(){\\n  window.loadSura = function(translator, sura){\\n    var idx = String(sura).padStart(3, '0');\\n    var name = './data/' + translator + '.s' + idx + '.js';\\n    return new Promise(function(resolve, reject){\\n      var s = document.createElement('script'); s.src = name; s.onload = resolve; s.onerror = reject; document.body.appendChild(s);\\n    });\\n  };\\n})();\\n`;
  fs.writeFileSync(path.join(DIST_MOBILE, 'js', 'data-loader.js'), dataLoader, 'utf8');

  // js: app.js (very small glue)
  const appJs = `(function(){\\n  function $(id){return document.getElementById(id)}\\n  var suraList = $('suraList');\\n  if(window.SURA_NAMES && suraList){\\n    SURA_NAMES.forEach(function(name,i){\\n      var d = document.createElement('div'); d.textContent = (i+1)+'. '+name; d.dataset.sura = i+1; d.onclick = function(){\\n        // load first translator's sura as demo\\n        loadSura('mazhonggang', i+1).then(function(){\\n          var key = 'DATA_MAZHONGGANG_S'+String(i+1).padStart(3,'0');\\n          var data = window[key] || [];\\n          $('results').innerHTML = data.map(function(r){return '<p><b>'+r.aya+'</b> '+(Array.isArray(r.text)?r.text.join(' '):r.text)+'</p>'}).join('');\\n        });\\n      };\\n      suraList.appendChild(d);\\n    });\\n  }\\n})();\\n`;
  fs.writeFileSync(path.join(DIST_MOBILE, 'js', 'app.js'), appJs, 'utf8');

  // 4. 复制 pc/（如果存在）到 dist/pc
  const PC_SRC = path.join(ROOT, 'pc');
  const PC_DST = path.join(DIST_DIR, 'pc');
  if(fileExists(PC_SRC)){
    // shallow copy of pc directory
    try{
      mkdirp.sync(PC_DST);
      const items = fs.readdirSync(PC_SRC);
      items.forEach(it=>{
        const s = path.join(PC_SRC, it); const d = path.join(PC_DST, it);
        if(fs.statSync(s).isFile()) fs.copyFileSync(s,d);
      });
    }catch(e){ console.warn('复制 pc/ 失败：', e); }
  }

  // 5. 打包 dist/ 为 zip
  try{
    const output = fs.createWriteStream(OUTPUT_ZIP);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', function(){ console.log('打包完成，字节：'+archive.pointer()); });
    archive.on('warning', function(err){ if(err.code === 'ENOENT') console.warn(err); else throw err; });
    archive.on('error', function(err){ throw err; });
    archive.pipe(output);
    if(fileExists(DIST_DIR)) archive.directory(DIST_DIR, false);
    archive.finalize();
  }catch(e){ console.error('打包失败：', e); }

  console.log('生成脚本执行完毕');
}

run().catch(e=>{ console.error('执行失败：', e); process.exit(1); };
