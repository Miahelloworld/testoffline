
# 古兰经中文翻译搜索工具（离线版）

- 双击 `index.html` 即可在浏览器离线使用（无需服务器、无需安装环境或字体）。
- 左侧为 114 章导航；顶部为“搜索 + 过滤器”；结果区域采用**单行并列 5 卡片**（小屏横向滚动）。
- 支持：**多关键词（空格分隔，且逻辑）**、**正则表达式**、**按译者筛选**、**关键词高亮**、**加载中提示**。

## 目录结构

```
quran_offline_site/
├─ index.html
├─ assets/
│  ├─ styles.css
│  ├─ app.js
│  └─ icons/
│     └─ logo.svg
└─ data/
   ├─ mazhonggang.json
   ├─ majinpeng.json
   ├─ tongdaozhang.json
   ├─ wangjingzhai.json
   ├─ majian.json
   ├─ mazhonggang.data.js
   ├─ majinpeng.data.js
   ├─ tongdaozhang.data.js
   ├─ wangjingzhai.data.js
   └─ majian.data.js
```

> 说明：`.json` 为原始数据（满足你给定的标准结构）。`.data.js` 是**预加载包装**，将 JSON 写入 `window.QDATA[...]`，让 `file://` 协议无需 `fetch()` 也能工作。若未来改为通过服务器访问，`app.js` 会优先尝试 `fetch('data/*.json')`，失败再回退到 `QDATA`。

## 译者与文件对应

{
  "mazhonggang": null,
  "majinpeng": null,
  "tongdaozhang": null,
  "wangjingzhai": null,
  "majian": null
}

## 数据量统计（仅供参考）
{
  "mazhonggang": 0,
  "majinpeng": 0,
  "tongdaozhang": 0,
  "wangjingzhai": 0,
  "majian": 0
}

## 手机适配
- 使用系统字体族，适配 iPhone 14/15/16 全系、Google Pixel 与三星主流机型。
- 译本卡片 `min-width: 260px`，在任何屏幕上**始终保持单行并列**，不足宽度时**横向滚动**。

## 二次开发建议（可扩展到 100+ 译本 / 大数据）
- 将 `TRANSLATORS` 配置与数据加载拆分为模块，按需/懒加载译本数据。
- 引入 Web Worker 做倒排索引（像 lunr.js / MiniSearch 的思路），避免主线程卡顿。

- 后续若部署到本地服务器或 PWA，可使用 Service Worker 的 Cache Storage 实现离线缓存。

