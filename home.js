const $=id=>document.getElementById(id);
const safeUrl=value=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='drive.proton.me'?url.href:'';}catch{return '';}};
async function init(){
  try{
    let response=await fetch('/api/catalog');
    if(!response.ok||!(response.headers.get('content-type')||'').includes('application/json'))response=await fetch('./catalog.json');
    if(!response.ok)throw new Error('目录未载入');
    const data=await response.json();
    $('item-count').textContent=String(data.items.length);$('category-count').textContent=String(data.categories.length);
    const source=safeUrl(data.meta.source_url);$('source-top').href=source;$('source-main').href=source;
    const updated=data.meta.synced_at?new Date(data.meta.synced_at).toLocaleString('zh-CN'):data.meta.captured_on;
    $('snapshot-note').textContent=`目录更新时间：${updated}。维护者更新文库后，可通过后台同步发布，网站更新可能有延迟。`;
    $('admin-link').hidden=!['127.0.0.1','localhost'].includes(location.hostname);
  }catch{ $('snapshot-note').textContent='目录快照暂未载入；请稍后刷新页面。'; }
}
init();
