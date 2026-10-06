// Requires the official Proton Drive CLI, authenticated in the current OS account.
// Only metadata and protected share URLs are exported. CLI responses containing
// passwords, account identities and keys must never be written to logs or Git.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,openSync,closeSync,unlinkSync,renameSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {openLibrary,saveItem} from '../db.mjs';

const codeRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=process.env.LIBRARY_ROOT||codeRoot;
const cli=process.env.PROTON_DRIVE_CLI;
const cliPrefix=JSON.parse(process.env.PROTON_DRIVE_CLI_PREFIX||'[]');
if(!cli)throw Error('Set PROTON_DRIVE_CLI to the official executable path.');
const source='/my-files/林办档案馆';
const excluded=new Set(['彪丝创作']);
const privateDir=join(root,'data','proton-sync');mkdirSync(privateDir,{recursive:true});
const lock=join(privateDir,'running.lock');
function staleLockReason(){
  if(!existsSync(lock))return null;
  try{
    const prior=JSON.parse(readFileSync(lock,'utf8'));
    if(!Number.isSafeInteger(prior.pid)||prior.pid<=0)return 'invalid owner';
    try{process.kill(prior.pid,0);return null;}
    catch(error){return error?.code==='ESRCH'?'owner process is gone':null;}
  }catch{return 'invalid contents';}
}
const staleReason=staleLockReason();
if(staleReason){
  const recovered=`${lock}.stale-${Date.now()}`;
  renameSync(lock,recovered);
  console.warn(`Recovered stale sync lock (${staleReason}).`);
}
let handle;
try{handle=openSync(lock,'wx');writeFileSync(handle,JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));}catch{throw Error('Sync already running, or stale lock requires inspection.');}
const statePath=join(privateDir,'state.json');
let state;
const persist=()=>{writeFileSync(statePath+'.tmp',JSON.stringify(state,null,2));renameSync(statePath+'.tmp',statePath);};
function call(args){
  try{return JSON.parse(execFileSync(cli,[...cliPrefix,...args,'--json'],{encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024,windowsHide:true,stdio:['ignore','pipe','pipe']}));}
  catch{throw Error('Proton CLI operation failed; sync stopped without logging sensitive output. Recheck login/network.');}
}
const segment=s=>s.replaceAll('\\','\\\\').replaceAll('/','\\/');
function validateShare(access,password){
  if(!access||access.role!=='viewer'||access.customPassword!==password||access.expirationTime)throw Error('Share password/role/expiry verification failed.');
  const u=new URL(access.url);
  if(u.protocol!=='https:'||u.hostname!=='drive.proton.me'||!u.pathname.startsWith('/urls/')||!u.hash)throw Error('Invalid Proton URL.');
  return u.href;
}
let db;
try{
  state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{nodes:{}};
  const share=call(['sharing','status',source]).urlAccess;
  if(!share?.customPassword)throw Error('The library folder must have a password.');
  // Verify the exact intended public library before making any changes.
  if(share.url!=='https://drive.proton.me/urls/XDMZCZVY5R#bzT7SbWhYrgA')throw Error('Unexpected source library.');
  const password=share.customPassword;
  const passwordTag=createHash('sha256').update(password).digest('hex');
  const files=[];
  const topFolders=new Set();
  function walk(path,parts=[]){
    const children=call(['filesystem','list',path]);
    if(!Array.isArray(children))throw Error('Invalid folder response.');
    for(const n of children){
      if(!n.name?.ok)throw Error('Cannot decrypt a name; refusing an incomplete scan.');
      const name=n.name.value;
      if(parts.length===0&&excluded.has(name))continue;
      if(parts.length===0&&n.type==='folder')topFolders.add(name);
      const childPath=path+'/'+segment(name);
      if(n.type==='folder')walk(childPath,[...parts,name]);
      else if(n.type==='file')files.push({uid:n.uid,name,parts,path:childPath,bytes:n.activeRevision?.claimedSize??n.totalStorageSize,revision:n.activeRevision?.uid||'',shared:n.isSharedByUrl});
    }
    console.log(`Scanned ${parts.length?parts.join('/'):'library root'}`);
  }
  walk(source);
  console.log(`Discovered ${files.length} files (excluded folder omitted).`);
  db=openLibrary(root);
  mkdirSync(join(root,'data','backups'),{recursive:true});
  const backup=join(root,'data','backups',`pre-proton-${new Date().toISOString().slice(0,10)}.sqlite`);
  if(!existsSync(backup))db.prepare('VACUUM INTO ?').run(backup);
  const categories=db.prepare('SELECT * FROM categories').all();
  for(const name of topFolders)if(!categories.some(c=>c.name===name)){
    const c={id:'p'+createHash('sha256').update(name).digest('hex').slice(0,10),name};
    db.prepare('INSERT OR IGNORE INTO categories(id,name,coverage) VALUES(?,?,?)').run(c.id,name,'complete');categories.push(c);
  }
  const initial=db.prepare('SELECT * FROM items').all();
  const claimed=new Set(Object.values(state.nodes).map(n=>n.itemId));
  let changed=0;
  for(const [index,f] of files.entries()){
    let previous=state.nodes[f.uid];
    let access;
    // Recheck permissions daily; immediately repair revoked links and folder-password changes.
    const cached=previous&&f.shared&&previous.passwordTag===passwordTag&&Date.now()-Date.parse(previous.verifiedAt||'1970-01-01')<86400000;
    if(cached)access={url:previous.url,role:'viewer',customPassword:password};
    else if(f.shared)access=call(['sharing','status',f.path]).urlAccess;
    if(!access||access.role!=='viewer'||access.customPassword!==password||access.expirationTime){
      if(access?.expirationTime)throw Error('Existing share expiration needs manual review.');
      access=call(['sharing','set-url','--role','viewer','--password',password,f.path]).urlAccess;
    }
    const url=validateShare(access,password);
    let item=previous?db.prepare('SELECT * FROM items WHERE id=?').get(previous.itemId):null;
    if(!item){
      const matches=initial.filter(i=>!claimed.has(i.id)&&i.original_name===f.name&&(f.parts.length?i.category_id===categories.find(c=>c.name===f.parts[0])?.id:!i.category_id));
      if(matches.length===1)item=matches[0];
    }
    let category=categories.find(c=>c.name===f.parts[0]);
    if(f.parts.length&&!category){category={id:'p'+createHash('sha256').update(f.parts[0]).digest('hex').slice(0,10),name:f.parts[0]};db.prepare('INSERT OR IGNORE INTO categories(id,name,coverage) VALUES(?,?,?)').run(category.id,category.name,'complete');categories.push(category);}
    const id=item?.id||'LB-P'+createHash('sha256').update(f.uid).digest('hex').slice(0,16).toUpperCase();
    const ext=/\.([a-z0-9]+)$/i.exec(f.name)?.[1]?.toUpperCase()||'FILE';
    const update={id,title:item?.title||f.name.replace(/\.[a-z0-9]+$/i,''),original_name:f.name,category_id:category?.id||null,source_path:['林办档案馆',...f.parts,f.name].join(' / '),format:ext,size_label:Number.isFinite(f.bytes)?`${(f.bytes/1000000).toFixed(2)} MB`:'',proton_url:url,link_scope:'file',status:item?.status==='draft'?'draft':'published',metadata_basis:item?.metadata_basis||'filename'};
    // Preserve manually archived records; disappearance archives only sync-owned records.
    if(item?.status==='archived'&&!previous?.missing)update.status='archived';
    db.exec('BEGIN');try{if(!item||Object.entries(update).some(([k,v])=>item[k]!==v)){saveItem(db,update);changed++;}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    claimed.add(id);state.nodes[f.uid]={itemId:id,revision:f.revision,url,missing:false,passwordTag,verifiedAt:cached?previous.verifiedAt:new Date().toISOString()};persist();
    console.log(`Linked ${index+1}/${files.length}: ${id}`);
  }
  const live=new Set(files.map(f=>f.uid));
  for(const [uid,n] of Object.entries(state.nodes))if(!live.has(uid)&&!n.missing){const item=db.prepare('SELECT * FROM items WHERE id=?').get(n.itemId);if(item?.status==='published'){saveItem(db,{id:n.itemId,status:'archived'});n.missing=true;changed++;}}
  const now=new Date().toISOString();
  const meta={coverage:'已同步指定 Proton 文库，排除彪丝创作；不含正文索引。',sync_mode:'proton'};
  if(changed||!state.lastSuccess){meta.captured_on=now.slice(0,10);meta.synced_at=now;}
  for(const [k,v] of Object.entries(meta))db.prepare('INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify(v));
  for(const c of categories){
    if(topFolders.has(c.name))db.prepare("UPDATE categories SET coverage='complete' WHERE id=?").run(c.id);
    else if(!db.prepare("SELECT id FROM items WHERE category_id=? AND status='published' LIMIT 1").get(c.id))db.prepare("UPDATE categories SET coverage='retired' WHERE id=?").run(c.id);
  }
  state.lastSuccess=now;persist();db.close();db=null;
  execFileSync(process.execPath,[join(codeRoot,'scripts','export.mjs')],{cwd:root,stdio:'inherit',windowsHide:true});
  console.log(`SYNC_OK files=${files.length} changed=${changed}`);
}finally{db?.close();if(handle!==undefined){closeSync(handle);unlinkSync(lock);}}
