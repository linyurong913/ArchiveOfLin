import {createSearch} from './search.mjs';
const $=id=>document.getElementById(id);
const state={data:null,search:null,category:'',format:'',query:'',sort:'updated',view:'items',page:1};
const PAGE_SIZE=10;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'&&u.hostname==='drive.proton.me'?u.href:'';}catch{return '';}};
const normalize=s=>String(s||'').toLowerCase().normalize('NFKC').replace(/[傳雲彪與語書國軍黨憶錄親歷動亂選圖論華學]/g,c=>({'傳':'传','雲':'云','與':'与','語':'语','書':'书','國':'国','軍':'军','黨':'党','憶':'忆','錄':'录','親':'亲','歷':'历','動':'动','亂':'乱','選':'选','圖':'图','論':'论','華':'华','學':'学'}[c]||c));
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制，可在原文库中定位。');}catch{toast('复制未成功，请在详情中手动选取文件名。');}}
function categoryName(){return state.data.categories.find(c=>c.id===state.category)?.name||'全部文献';}
function matches(text){return normalize(state.query).split(/\s+/).filter(Boolean).every(t=>normalize(text).includes(t));}
function filtered(){if(!state.search)state.search=createSearch(state.data.items);const allowed=i=>(!state.category||i.category_id===state.category)&&(!state.format||i.format===state.format);let list=(state.query.trim()?state.search(state.query):state.data.items).filter(allowed);if(state.sort==='title')list.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));if(state.sort==='updated')list.sort((a,b)=>b.updated_at.localeCompare(a.updated_at));return list;}
function highlighted(value){const raw=String(value??'');const text=normalize(raw);const ranges=[];for(const term of normalize(state.query).split(/\s+/).filter(Boolean)){let from=0,index;while((index=text.indexOf(term,from))!==-1){ranges.push([index,index+term.length]);from=index+term.length;}}if(!ranges.length)return esc(raw);ranges.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);const merged=[];for(const range of ranges){const previous=merged.at(-1);if(previous&&range[0]<=previous[1])previous[1]=Math.max(previous[1],range[1]);else merged.push(range);}let output='',cursor=0;for(const [start,end] of merged){output+=esc(raw.slice(cursor,start))+`<mark>${esc(raw.slice(start,end))}</mark>`;cursor=end;}return output+esc(raw.slice(cursor));}
function updateLocation(){const u=new URL(location.href);for(const [key,val]of Object.entries({q:state.query,category:state.category,format:state.format,view:state.view==='folders'?'folders':'',sort:state.sort==='updated'?'':state.sort,page:state.view==='items'&&state.page>1?String(state.page):''}))val?u.searchParams.set(key,val):u.searchParams.delete(key);history.replaceState(null,'',u);}
function setCategory(id){state.category=id;state.view='items';state.page=1;render();}
function render(){
  const list=filtered(),cats=state.data.categories;$('heading').textContent=categoryName();
  $('intro').textContent=state.category?'保留目录来源，查阅原文与版本。':`${state.data.items.length} 份已编目资料 · ${cats.length} 个原始分类`;
  $('category-count').textContent=String(cats.length);$('all-count').textContent=state.data.items.length;
  $('all-category').classList.toggle('active',!state.category);
  $('categories').innerHTML=cats.map(c=>{const n=state.data.items.filter(i=>i.category_id===c.id).length;return `<button class="category ${state.category===c.id?'active':''}" data-category="${esc(c.id)}"><span class="category-name">${esc(c.name)}</span><span>${n||'待编目'}</span></button>`;}).join('');
  $('items-tab').classList.toggle('active',state.view==='items');$('folders-tab').classList.toggle('active',state.view==='folders');$('items-tab').setAttribute('aria-selected',state.view==='items');$('folders-tab').setAttribute('aria-selected',state.view==='folders');
  document.querySelectorAll('[data-format]').forEach(b=>{b.classList.toggle('active',b.dataset.format===state.format);b.setAttribute('aria-pressed',String(b.dataset.format===state.format));});
  $('export').hidden=state.view==='folders';
  $('pagination').hidden=state.view==='folders';
  if(state.view==='folders'){
    const rows=cats.filter(c=>matches(c.name));$('result-summary').textContent=`${rows.length} 个目录 · 已编目数量不代表文件夹总量`;
    $('results').innerHTML=`<div class="folder-grid">${rows.map(c=>{const n=state.data.items.filter(i=>i.category_id===c.id).length;return `<article class="folder-card"><span class="folder-symbol">目录 / ${esc(c.id.toUpperCase())}</span><h2>${esc(c.name)}</h2><p>${n?`已编目 ${n} 份资料`:'尚未逐项编目'}${c.coverage==='partial'?' · 仍有子目录待整理':''}</p><div class="folder-actions"><button class="text-button" data-category="${esc(c.id)}">浏览已编目资料</button><button class="text-button" data-copy="${esc(c.name)}">复制目录名</button><a class="text-button" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(state.data.meta.source_url))}">打开原文库</a></div></article>`;}).join('')}</div>`;
  }else{
    const pages=Math.max(1,Math.ceil(list.length/PAGE_SIZE));
    state.page=Math.min(Math.max(1,state.page),pages);
    const start=(state.page-1)*PAGE_SIZE;
    $('result-summary').textContent=`找到 ${list.length} 份资料${list.length?' · 显示 '+(start+1)+'–'+Math.min(start+PAGE_SIZE,list.length)+' 份':''}${state.query?' · 按相关性排序 · 书目检索，不含文件正文':''}`;
    $('pagination').hidden=list.length===0;
    $('page-status').textContent=`第 ${state.page} / ${pages} 页 · 每页 10 篇`;
    $('previous-page').disabled=state.page<=1;
    $('next-page').disabled=state.page>=pages;
    $('results').innerHTML=list.length?list.slice(start,start+PAGE_SIZE).map(i=>`<article class="record"><div class="file-icon ${esc(i.format.toLowerCase())}" aria-hidden="true">${esc(i.format||'FILE')}</div><div><div class="record-meta"><span class="code">${esc(i.id)}</span><span>／</span><span>${esc(i.category||'根目录')}</span></div><h2><button class="title-button" data-item="${esc(i.id)}">${highlighted(i.title)}</button></h2><p class="author">${highlighted(i.author||'作者待核')}${i.year?' · '+esc(i.year):''}</p><p class="path">${esc(i.source_path||'本机录入')}</p></div><div class="record-action"><button data-item="${esc(i.id)}">查看文献</button><span>${esc(i.size_label||i.format)}</span></div></article>`).join(''):`<div class="empty"><h2>${state.category&&!state.query?'此分类尚无符合条件的已编目条目':'没有找到匹配的文献'}</h2><p>可清除筛选，或前往 Proton 原文库查看。<br>未编目不代表原文件夹为空。</p><button class="secondary" id="clear-filters">查看全部书目</button></div>`;
  }
  updateLocation();
}
function detail(id){const i=state.data.items.find(x=>x.id===id);if(!i){toast('该条目尚未发布或不存在。');return;}$('detail-id').textContent=`${i.id} / 第 ${i.revision} 次书目修订`;
  const link=i.link_scope==='file'&&i.proton_url!==state.data.meta.source_url?safeUrl(i.proton_url):'';
  $('detail-content').innerHTML=`<h2>${esc(i.title)}</h2><dl><dt>作者</dt><dd>${esc(i.author||'待核')}</dd><dt>年代</dt><dd>${esc(i.year||'待核')}</dd><dt>馆藏分类</dt><dd>${esc(i.category||'根目录')}</dd><dt>文件格式</dt><dd>${esc(i.format)} · ${esc(i.size_label||'大小待录入')}</dd><dt>原始文件名</dt><dd>${esc(i.original_name||'尚未上传文件')}</dd><dt>定位路径</dt><dd>${esc(i.source_path||'本机录入')}</dd><dt>编目依据</dt><dd>${i.metadata_basis==='filename'?'从共享目录与文件名整理，未核对原书版权页。':'由管理者录入。'}</dd></dl>${i.description?`<div class="detail-body"><p>${esc(i.description)}</p></div>`:''}<div class="notice">${link?'此链接打开该文件的 Proton 密码验证／下载页面。':'此文件的独立分享链接尚待同步，暂不提供下载入口。'} 如 Proton 要求密码：<strong>抗大校训八个字的拼音首字母，全小写。</strong> 网站仅提供密码提示，不保存密码明文。</div><div class="dialog-actions">${link?`<a class="primary" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${i.link_scope==='file'?'打开此文件的 Proton 下载页':'打开 Proton 原文库'}</a>`:''}<button class="secondary" data-copy="${esc(i.original_name||i.title)}">复制文件名</button><button class="secondary" data-copy-link="${esc(i.id)}">复制条目链接</button></div>`;
  if(!$('detail').open)$('detail').showModal();const u=new URL(location.href);u.hash='item/'+encodeURIComponent(id);history.replaceState(null,'',u);
}
function info(){const d=state.data;$('info-content').innerHTML=`<p>目录来源：${esc(d.meta.source_name)}。当前已编目 <strong>${d.items.length}</strong> 份文件，保留 <strong>${d.categories.length}</strong> 个原始分类。${d.meta.sync_mode==='proton'?'已递归同步指定文库，排除维护者指定的不展示目录。':'尚未完成整库递归编目。'}目录数量不等于文件总数。</p><p>书名和作者从文件名初步整理，未知年代不做推断。本站提供书目检索，尚未建立 OCR 正文索引。</p><p>文件继续保存在 Proton Drive。共享链接的密码不会写入网站。当前原文入口仍受 Proton 的分享权限和密码限制。</p><p>目录更新时间：${esc(d.meta.synced_at?new Date(d.meta.synced_at).toLocaleString('zh-CN'):d.meta.captured_on)}。${d.meta.sync_mode==='proton'?'维护者的同步程序运行时会检查新增文件并更新目录，更新可能有延迟。':'自动同步尚未完成配置。'}</p>`;$('info').showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.category)setCategory(b.dataset.category);if(b.dataset.item)detail(b.dataset.item);if(b.dataset.copy)copy(b.dataset.copy);if(b.dataset.copyLink){const u=new URL(location.href);u.search='';u.hash='item/'+encodeURIComponent(b.dataset.copyLink);copy(u.href);}if(b.id==='clear-filters'){state.category='';state.format='';state.query='';state.page=1;$('search').value='';render();}});
$('all-category').onclick=()=>setCategory('');$('search').addEventListener('input',e=>{state.query=e.target.value;state.page=1;render();});$('sort').onchange=e=>{state.sort=e.target.value;state.page=1;render();};$('formats').onclick=e=>{const b=e.target.closest('[data-format]');if(b){state.format=b.dataset.format;state.page=1;render();}};
function turnPage(delta){state.page+=delta;render();$('items-tab').scrollIntoView({block:'start'});$('items-tab').focus({preventScroll:true});}
$('previous-page').onclick=()=>turnPage(-1);$('next-page').onclick=()=>turnPage(1);
$('items-tab').onclick=()=>{state.view='items';render();};$('folders-tab').onclick=()=>{state.view='folders';state.category='';render();};
$('close-detail').onclick=()=>$('detail').close();$('detail').addEventListener('close',()=>{const u=new URL(location.href);u.hash='';history.replaceState(null,'',u);});$('close-info').onclick=()=>$('info').close();$('about').onclick=info;$('coverage-info').onclick=info;
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('search').focus();}});
$('export').onclick=()=>{const keys=['id','title','author','year','category','original_name','format','size_label','source_path','proton_url','link_scope'];const cell=v=>'"'+String(v||'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';const csv='\ufeff'+[keys.join(','),...filtered().map(i=>keys.map(k=>cell(i[k])).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='林办档案馆-书目.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
async function init(){try{let response=await fetch('/api/catalog');if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))response=await fetch('./catalog.json');if(!response.ok)throw new Error('目录加载失败');state.data=await response.json();const q=new URLSearchParams(location.search);state.query=q.get('q')||'';state.category=q.get('category')||'';state.format=q.get('format')||'';state.sort=q.get('sort')||'updated';state.page=/^[1-9]\d*$/.test(q.get('page')||'')?Math.min(Number(q.get('page')),Number.MAX_SAFE_INTEGER):1;state.view=q.get('view')==='folders'?'folders':'items';$('search').value=state.query;$('sort').value=state.sort;$('source-top').href=safeUrl(state.data.meta.source_url);$('snapshot-date').textContent='目录快照 '+state.data.meta.captured_on;$('admin-link').hidden=!['127.0.0.1','localhost'].includes(location.hostname);render();if(location.hash.startsWith('#item/'))detail(decodeURIComponent(location.hash.slice(6)));}catch(e){$('result-summary').textContent='暂时无法加载书目。';$('results').innerHTML='<div class="empty"><h2>目录尚未载入</h2><p>本机版本请通过启动脚本打开；静态部署请确认已导出 catalog.json。</p></div>';}}
// Match the sticky banner to a wrapping navigation bar on every viewport.
const topbar=document.querySelector('.topbar');
const measureTopbar=()=>document.documentElement.style.setProperty('--topbar-height',topbar.getBoundingClientRect().height+'px');
new ResizeObserver(measureTopbar).observe(topbar);measureTopbar();
// Time-based easing stays consistent on both 60 Hz and high-refresh screens.
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
let scrollFrame=0,mottoProgress=Math.min(1,Math.max(0,window.scrollY)/240),lastMottoFrame=0;
function updateMotto(time){
  const target=Math.min(1,Math.max(0,window.scrollY)/240);
  const elapsed=lastMottoFrame?Math.min(64,time-lastMottoFrame):16;
  lastMottoFrame=time;
  mottoProgress=reducedMotion.matches?target:mottoProgress+(target-mottoProgress)*(1-Math.exp(-elapsed/85));
  if(Math.abs(target-mottoProgress)<.0005)mottoProgress=target;
  document.documentElement.style.setProperty('--motto-progress',String(mottoProgress));
  if(mottoProgress!==target)scrollFrame=requestAnimationFrame(updateMotto);
  else{scrollFrame=0;lastMottoFrame=0;}
}
function requestMottoUpdate(){if(!scrollFrame)scrollFrame=requestAnimationFrame(updateMotto);}
window.addEventListener('scroll',requestMottoUpdate,{passive:true});
reducedMotion.addEventListener('change',requestMottoUpdate);
requestMottoUpdate();
init();
