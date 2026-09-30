import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname,join,extname,resolve } from 'node:path';
import { mkdirSync,statSync,createReadStream,createWriteStream,existsSync,unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID,createHash } from 'node:crypto';
import { openLibrary,catalogue,saveItem } from './db.mjs';
import {createAdminAuth} from './auth.mjs';
const root=process.env.LIBRARY_ROOT||dirname(fileURLToPath(import.meta.url));
const publicRoot=join(dirname(fileURLToPath(import.meta.url)),'public');
const db=openLibrary(root);mkdirSync(join(root,'storage'),{recursive:true});
const auth=createAdminAuth(root);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
async function readJson(req){let n=0;const chunks=[];for await(const c of req){n+=c.length;if(n>1024*1024)throw new Error('提交内容过大。');chunks.push(c);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function serveFile(req,res,path,mime,extra={}){
  const st=statSync(path),range=req.headers.range;let start=0,end=st.size-1,status=200;
  if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2])){res.writeHead(416,{'Content-Range':`bytes */${st.size}`});return res.end();}start=m[1]?Number(m[1]):Math.max(0,st.size-Number(m[2]));end=m[1]&&m[2]?Math.min(Number(m[2]),st.size-1):st.size-1;if(start>end||start>=st.size){res.writeHead(416,{'Content-Range':`bytes */${st.size}`});return res.end();}status=206;extra['Content-Range']=`bytes ${start}-${end}/${st.size}`;}
  res.writeHead(status,{'Content-Type':mime,'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes',...extra});if(req.method==='HEAD'||!st.size)return res.end();createReadStream(path,{start,end}).pipe(res);
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  let url;try{url=new URL(req.url,'http://127.0.0.1');}catch{return send(res,400,{error:'无效地址'});}
  const host=req.headers.host||'';if(!/^127\.0\.0\.1:\d+$/.test(host)&&!/^localhost:\d+$/.test(host))return send(res,403,{error:'仅允许本机访问。'});
  const admin=url.pathname.startsWith('/api/admin/');
  try{
    if(url.pathname==='/api/auth/login'&&req.method==='POST'){
      if(req.headers.origin!==`http://${host}`||!(req.headers['content-type']||'').startsWith('application/json'))return send(res,403,{error:'请从本机登录页面登录。'});
      const {key}=await readJson(req),result=auth.login(key,host);
      if(result.cookie)res.setHeader('Set-Cookie',result.cookie);
      if(result.retryAfter)res.setHeader('Retry-After',String(result.retryAfter));
      return send(res,result.status,result.error?{error:result.error}:{authenticated:true});
    }
    const session=admin?auth.session(req):null;
    if(admin&&!session)return send(res,401,{error:'请先登录管理员后台。'});
    if(admin&&!['GET','HEAD'].includes(req.method)&&(req.headers.origin!==`http://${host}`||req.headers['x-library-token']!==session.token))return send(res,403,{error:'管理会话无效，请重新登录。'});
    if(url.pathname==='/api/admin/logout'&&req.method==='POST'){res.setHeader('Set-Cookie',auth.logout(req));return send(res,200,{authenticated:false});}
    if(url.pathname==='/api/catalog'&&req.method==='GET')return send(res,200,catalogue(db));
    if(url.pathname==='/api/admin/session'&&req.method==='GET')return send(res,200,{token:session.token,local_only:true,expires_at:session.expires});
    if(url.pathname==='/api/admin/catalog'&&req.method==='GET')return send(res,200,catalogue(db,true));
    if(url.pathname==='/api/admin/items'&&req.method==='POST'){
      const data=await readJson(req);db.exec('BEGIN');try{const row=saveItem(db,data);db.exec('COMMIT');return send(res,200,row);}catch(e){db.exec('ROLLBACK');throw e;}
    }
    if(url.pathname==='/api/admin/history'&&req.method==='GET')return send(res,200,db.prepare('SELECT revision,snapshot,created_at FROM revisions WHERE item_id=? ORDER BY revision DESC').all(url.searchParams.get('id')));
    if(url.pathname==='/api/admin/upload'&&req.method==='POST'){
      const id=url.searchParams.get('id');if(!db.prepare('SELECT id FROM items WHERE id=?').get(id))return send(res,404,{error:'请先保存书目。'});
      const name=(url.searchParams.get('name')||'document').replace(/[\\/\x00-\x1f]/g,'_').slice(0,240);const ext=extname(name).toLowerCase();
      const allow={'.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.epub':'application/epub+zip','.zip':'application/zip','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
      if(!allow[ext])return send(res,400,{error:'支持 PDF、TXT、EPUB、ZIP 和 DOCX。'});
      const fileId=randomUUID(),storageKey=fileId+ext,path=join(root,'storage',storageKey);let bytes=0;const hash=createHash('sha256');
      const counter=new Transform({transform(chunk,enc,cb){bytes+=chunk.length;if(bytes>512*1024*1024)return cb(new Error('单个文件不能超过 512 MB。'));hash.update(chunk);cb(null,chunk);}});
      try{await pipeline(req,counter,createWriteStream(path));if(!bytes)throw new Error('不能上传空文件。');const sha=hash.digest('hex');const same=db.prepare('SELECT id FROM files WHERE item_id=? AND sha256=?').get(id,sha);if(same){unlinkSync(path);return send(res,200,{id:same.id,duplicate:true,message:'该文件已存在，无需重复保存。'});}const now=new Date().toISOString();db.exec('BEGIN');try{db.prepare('INSERT INTO files VALUES(?,?,?,?,?,?,?,?)').run(fileId,id,sha,storageKey,name,bytes,allow[ext],now);saveItem(db,{id});db.prepare('INSERT INTO sync_jobs VALUES(?,?,?,?,?,?)').run(randomUUID(),id,'upload','not_connected','文件已保存到本机；尚未连接 Proton 账户。',now);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}return send(res,201,{id:fileId,sha256:sha,bytes,message:'文件已保存到本机，尚未上传 Proton。'});}catch(e){if(existsSync(path))unlinkSync(path);throw e;}
    }
    if(url.pathname==='/api/admin/sync'&&req.method==='GET')return send(res,200,{connected:false,message:'共享链接不能提供账户级双向同步授权。',jobs:db.prepare('SELECT * FROM sync_jobs ORDER BY created_at DESC').all()});
    if(url.pathname.startsWith('/files/')&&['GET','HEAD'].includes(req.method)){
      const f=db.prepare("SELECT f.* FROM files f JOIN items i ON i.id=f.item_id WHERE f.id=? AND i.status='published'").get(url.pathname.slice(7));if(!f)return send(res,404,{error:'文件未发布或不存在。'});
      const inline=f.mime==='application/pdf'||f.mime.startsWith('text/plain');return serveFile(req,res,join(root,'storage',f.storage_key),f.mime,{'Content-Disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(f.original_name)}`});
    }
    if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'不支持此操作。'});
    if(url.pathname.startsWith('/api/'))return send(res,404,{error:'接口不存在。'});
    const relative=url.pathname==='/'?'index.html':url.pathname==='/admin'?'admin.html':url.pathname==='/login'?'login.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if(relative.includes(':')||relative.includes('\0')||relative.split(/[\\/]/).some(part=>/[. ]$/.test(part)))return send(res,404,{error:'页面不存在。'});
    const path=resolve(publicRoot,relative);if(!path.startsWith(resolve(publicRoot)+ '/')&&!path.startsWith(resolve(publicRoot)+'\\'))return send(res,403,{error:'禁止访问。'});
    if(path.toLowerCase()===resolve(publicRoot,'admin.html').toLowerCase()&&!auth.session(req)){res.writeHead(303,{Location:'/login'});return res.end();}
    if(!existsSync(path)||!statSync(path).isFile())return send(res,404,{error:'页面不存在。'});return serveFile(req,res,path,types[extname(path)]||'application/octet-stream');
  }catch(e){if(!res.headersSent&&!res.destroyed)send(res,400,{error:e.message||'操作失败'});}
});
server.listen(Number(process.env.PORT||8787),'127.0.0.1',()=>console.log(`LIBRARY_READY http://127.0.0.1:${server.address().port}`));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已占用。可设置 PORT 后重新启动。':e.message);process.exitCode=1;});
process.on('SIGTERM',()=>server.close(()=>{db.close();process.exit(0);}));
