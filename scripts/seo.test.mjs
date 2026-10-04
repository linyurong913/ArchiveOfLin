import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,resolve,basename} from 'node:path';
import {exportSeo,publicPaths,documentPath,SITE} from './seo.mjs';

test('SEO export exposes crawlable published records, escapes metadata and excludes stale/private paths',t=>{
  const dir=mkdtempSync(join(tmpdir(),'archive-seo-'));
  t.after(()=>{assert.equal(dirname(resolve(dir)),resolve(tmpdir()));assert.ok(basename(dir).startsWith('archive-seo-'));rmSync(dir,{recursive:true,force:true});});
  const template=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const item={id:'LB-00001',title:'研究 </script><script>alert(1)</script>',author:'甲 & 乙',format:'PDF',category:'历史',source_path:'资料 / 文献.pdf',original_name:'文献.pdf',proton_url:'https://drive.proton.me/urls/EXAMPLE#key',link_scope:'file'};
  const data={items:[item],categories:[{name:'历史'}],meta:{source_url:'https://drive.proton.me/urls/FOLDER#key'}};
  writeFileSync(join(dir,'index.html'),template);exportSeo(dir,data);
  const page=readFileSync(join(dir,documentPath(item.id)),'utf8');
  assert.ok(page.includes('研究 &lt;/script&gt;'));
  assert.ok(!page.includes('<script>alert(1)</script>'));
  assert.ok(page.includes('甲 &amp; 乙'));
  assert.ok(page.includes('https://drive.proton.me/urls/EXAMPLE#key'));
  assert.equal(JSON.parse(page.match(/application\/ld\+json">([^]*?)<\/script>/)[1]).name,item.title);
  const home=readFileSync(join(dir,'index.html'),'utf8');
  assert.ok(home.includes(`href="${SITE}"`));assert.ok(home.includes('href="catalogue.html"'));
  assert.ok(home.includes('href="documents/LB-00001.html"'));
  const sitemap=readFileSync(join(dir,'sitemap.xml'),'utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,3);
  assert.ok(sitemap.includes(SITE+'documents/LB-00001.html'));assert.ok(!sitemap.includes('drive.proton.me'));
  assert.ok(!publicPaths(data).some(p=>/admin|sqlite|storage|proton-sync/.test(p)));
  assert.throws(()=>documentPath('../secret'));
  // The publisher builds a fresh allowlist, so archived pages disappear remotely.
  writeFileSync(join(dir,'index.html'),template);const empty={...data,items:[]};exportSeo(dir,empty);
  assert.ok(!publicPaths(empty).includes(documentPath(item.id)));
  assert.ok(!readFileSync(join(dir,'sitemap.xml'),'utf8').includes(item.id));
});
