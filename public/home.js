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
    $('admin-link').hidden=!['127.0.0.1','localhost'].includes(location.hostname);
  }catch{}
}
init();
// Keep the landing page's sticky motto in step with the catalogue page.
const topbar=document.querySelector('.topbar');
const measureTopbar=()=>document.documentElement.style.setProperty('--topbar-height',topbar.getBoundingClientRect().height+'px');
new ResizeObserver(measureTopbar).observe(topbar);measureTopbar();
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
