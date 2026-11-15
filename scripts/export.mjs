import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {mkdirSync,copyFileSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {openLibrary,exportCatalogue} from '../db.mjs';
import {exportSeo} from './seo.mjs';
const codeRoot=join(dirname(fileURLToPath(import.meta.url)),'..');const root=process.env.LIBRARY_ROOT||codeRoot;const db=openLibrary(root);
const target=join(root,'dist');mkdirSync(target,{recursive:true});
for(const name of ['index.html','catalogue.html','style.css','home.js','app.js','search.mjs','favicon.svg','linbiao-white.svg','googlecafbab5c34e387e5.html'])copyFileSync(join(codeRoot,'public',name),join(target,name));
mkdirSync(join(target,'vendor'),{recursive:true});for(const name of ['fuse.min.mjs','FUSE-LICENSE.txt'])copyFileSync(join(codeRoot,'public','vendor',name),join(target,'vendor',name));
const data=exportCatalogue(db,join(target,'catalog.json'));
exportSeo(target,data);
// Version page assets with the exported catalogue so stale scripts are not reused.
for(const [page,script] of [['index.html','home.js'],['catalogue.html','app.js']]){
  const version=createHash('sha256').update(JSON.stringify(data)).update(readFileSync(join(target,script))).digest('hex').slice(0,16);
  let html=readFileSync(join(target,page),'utf8').replace(`src="${script}"`,`src="${script}?v=${version}"`);
  if(page==='index.html'){
    html=html.replace(/(id="item-count">)\d+/,`$1${data.items.length}`).replace(/(id="category-count">)\d+/,`$1${data.categories.length}`);
  }
  writeFileSync(join(target,page),html);
}
writeFileSync(join(target,'_headers'),"/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'\n");
db.close();console.log(`已导出 ${data.items.length} 份公开书目到 dist。未导出管理页、数据库、密码或本机文件。`);
