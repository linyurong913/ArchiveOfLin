import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export const SITE='https://linyurong913.github.io/ArchiveOfLin/';
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=s=>JSON.stringify(s).replace(/</g,'\\u003c');
export function documentPath(id){if(!/^LB-[A-Z0-9]+$/.test(id))throw Error('Invalid public document ID');return `documents/${id}.html`;}
export function publicPaths(data){return ['index.html','style.css','app.js','favicon.svg','linbiao-white.svg','catalog.json','catalogue.html','sitemap.xml','googlecafbab5c34e387e5.html',...data.items.map(i=>documentPath(i.id))];}
function head(title,description,url,base,schema){return `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${url}"><meta name="robots" content="index,follow"><meta property="og:type" content="website"><meta property="og:locale" content="zh_CN"><meta property="og:site_name" content="林办档案馆"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${url}"><link rel="icon" href="${base}favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="${base}style.css"><script type="application/ld+json">${json(schema)}</script>`;}
function shell(title,description,url,base,body,schema){return `<!doctype html><html lang="zh-CN"><head>${head(title,description,url,base,schema)}</head><body><header class="seo-header"><a class="brand" href="${base}"><span class="seal" aria-hidden="true"><img src="${base}linbiao-white.svg" alt="" width="365" height="794"></span><span class="brand-wordmark"><strong>林办档案馆</strong><small>ARCHIVE OF LIN BIAO</small></span></a><a href="${base}catalogue.html">完整书目索引</a></header><main class="seo-main">${body}</main><footer class="seo-footer"><span>非营利历史资料整理项目，仅供学术交流。收录不代表维护者的政治立场。</span><a href="${base}#disclaimer">免责声明与版权联系</a><a href="${base}">返回检索首页</a></footer></body></html>`;}
export function exportSeo(target,data){
  const e=escapeHtml;
  mkdirSync(join(target,'documents'),{recursive:true});
  const groups=new Map();
  for(const i of data.items){const category=i.category||'未分类';if(!groups.has(category))groups.set(category,[]);groups.get(category).push(i);}
  const description='林办档案馆（Archive of Lin Biao）整理林彪相关文献、九一三事件史料、人物传记、个人回忆录及四野军事史资料，提供书目检索与 Proton Drive 原文访问入口。';
  const website={'@context':'https://schema.org','@type':'WebSite',name:'林办档案馆',alternateName:'Archive of Lin Biao',url:SITE,description,inLanguage:'zh-CN'};
  let home=readFileSync(join(target,'index.html'),'utf8');
  home=home.replace(/<title>[^<]*<\/title>/,'<title>林办档案馆｜林彪文献、九一三史料与人物回忆录</title>')
    .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${description}">`)
    .replace('</head>',`<link rel="canonical" href="${SITE}"><meta name="robots" content="index,follow"><meta property="og:title" content="林办档案馆｜林彪文献目录"><meta property="og:description" content="${description}"><meta property="og:url" content="${SITE}"><meta property="og:type" content="website"><meta property="og:locale" content="zh_CN"><script type="application/ld+json">${json(website)}</script></head>`)
    .replace('<h1 id="heading">全部文献</h1>','<h1 id="heading">林办档案馆 · 文献目录</h1>')
    .replace('在文献之间寻找线索。',`${data.items.length} 份文献，${data.categories.length} 个分类。`)
    .replace('<section id="results" aria-label="文献结果"></section>',`<section id="results" aria-label="文献结果">${data.items.slice(0,10).map(i=>`<article class="record"><div class="file-icon ${e(i.format?.toLowerCase())}">${e(i.format)}</div><div><p class="record-meta">${e(i.id)} · ${e(i.category)}</p><h2><a href="${documentPath(i.id)}">${e(i.title)}</a></h2><p class="author">${e(i.author||'作者待核')}</p><p class="path">${e(i.source_path)}</p></div></article>`).join('')}</section>`);
  home=home.replace('<section class="search-panel"', '<p class="seo-summary">林彪文献、九一三事件史料、人物传记与四野军事史资料。<a href="catalogue.html">浏览完整书目索引 ↗</a></p><section class="search-panel"');
  writeFileSync(join(target,'index.html'),home);
  const indexBody=`<p class="eyebrow">CATALOGUE / 书目索引</p><h1>林办档案馆完整书目</h1><p class="seo-lead">${description}</p><p>共 ${data.items.length} 份公开文献。书名和作者请以原件核对为准。<a href="./">返回首页搜索、筛选与分页浏览</a>。</p>${[...groups].map(([name,items])=>`<section class="seo-section"><h2>${e(name)} <small>（${items.length}）</small></h2><ul class="seo-list">${items.map(i=>`<li><a href="${documentPath(i.id)}">${e(i.title)}</a><span>${e(i.author||'作者待核')} · ${e(i.format)} · ${e(i.id)}</span></li>`).join('')}</ul></section>`).join('')}`;
  writeFileSync(join(target,'catalogue.html'),shell('完整书目索引｜林办档案馆',description,SITE+'catalogue.html','./',indexBody,{'@context':'https://schema.org','@type':'CollectionPage',name:'林办档案馆完整书目',url:SITE+'catalogue.html',isPartOf:{'@type':'WebSite',url:SITE,name:'林办档案馆'}}));
  for(const i of data.items){
    const path=documentPath(i.id),url=SITE+path;
    const desc=`《${i.title}》${i.author?'，'+i.author:''}。林办档案馆收录的${i.category||'历史'}资料，${i.format||'文献'}格式。提供书目信息、来源路径与 Proton 原文入口。`;
    const schema={'@context':'https://schema.org','@type':'CreativeWork',name:i.title,identifier:i.id,url,isPartOf:{'@type':'CollectionPage',url:SITE+'catalogue.html',name:'林办档案馆完整书目'}};
    if(i.author)schema.author={'@type':'Person',name:i.author};
    let proton='';try{const u=new URL(i.proton_url);if(i.link_scope==='file'&&u.protocol==='https:'&&u.hostname==='drive.proton.me'&&i.proton_url!==data.meta.source_url)proton=u.href;}catch{}
    const rows=[['编号',i.id],['作者',i.author||'待核'],['年代',i.year||'待核'],['分类',i.category||'未分类'],['格式',i.format],['原文件名',i.original_name],['来源路径',i.source_path]];
    const body=`<p class="eyebrow">DOCUMENT / 文献书目</p><h1>${e(i.title)}</h1><dl>${rows.map(([k,v])=>`<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl>${i.description?`<p class="seo-lead">${e(i.description)}</p>`:''}<p class="notice">本站提供文献目录，不托管原件。书目信息可能来自文件名，研究和引用请核对原件。${proton?'如 Proton 要求密码：抗大校训八个字的拼音首字母，全小写。':''}</p><div class="dialog-actions">${proton?`<a class="primary" href="${e(proton)}" target="_blank" rel="noopener noreferrer">打开此文件的 Proton 下载页 ↗</a>`:''}<a class="secondary" href="../#item/${i.id}">在检索目录中查看</a></div>`;
    writeFileSync(join(target,path),shell(`${i.title}｜林办档案馆`,desc,url,'../',body,schema));
  }
  const urls=[SITE,SITE+'catalogue.html',...data.items.map(i=>SITE+documentPath(i.id))];
  writeFileSync(join(target,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(url=>`<url><loc>${e(url)}</loc></url>`).join('')+'</urlset>\n');
}
