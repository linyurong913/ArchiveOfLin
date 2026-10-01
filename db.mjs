import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
export function openLibrary(root) {
  mkdirSync(join(root,'data'),{recursive:true});
  const db = new DatabaseSync(join(root,'data','library.sqlite'));
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS categories(id TEXT PRIMARY KEY,name TEXT NOT NULL,coverage TEXT NOT NULL DEFAULT 'pending');
    CREATE TABLE IF NOT EXISTS items(id TEXT PRIMARY KEY,title TEXT NOT NULL,author TEXT NOT NULL DEFAULT '',year TEXT NOT NULL DEFAULT '',category_id TEXT REFERENCES categories(id),source_path TEXT NOT NULL DEFAULT '',original_name TEXT NOT NULL DEFAULT '',format TEXT NOT NULL DEFAULT '',size_label TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',proton_url TEXT NOT NULL DEFAULT '',link_scope TEXT NOT NULL DEFAULT 'folder',status TEXT NOT NULL DEFAULT 'draft',metadata_basis TEXT NOT NULL DEFAULT 'manual',revision INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id),sha256 TEXT NOT NULL,storage_key TEXT NOT NULL,original_name TEXT NOT NULL,bytes INTEGER NOT NULL,mime TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY,item_id TEXT NOT NULL REFERENCES items(id),revision INTEGER NOT NULL,snapshot TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_jobs(id TEXT PRIMARY KEY,item_id TEXT REFERENCES items(id),direction TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'not_connected',detail TEXT NOT NULL,created_at TEXT NOT NULL);
  `);
  if (!db.prepare("SELECT value FROM meta WHERE key='seeded'").get()) {
    const seed=JSON.parse(readFileSync(join(root,'data','seed.json'),'utf8'));
    db.exec('BEGIN');
    try {
      for(const c of seed.categories) db.prepare('INSERT INTO categories VALUES(?,?,?)').run(c.id,c.name,c.coverage);
      for(const [key,value] of Object.entries(seed.meta)) db.prepare('INSERT INTO meta VALUES(?,?)').run(key,JSON.stringify(value));
      for(const item of seed.items) saveItem(db,item);
      db.prepare('INSERT INTO meta VALUES(?,?)').run('seeded','true');
      db.exec('COMMIT');
    } catch(e){db.exec('ROLLBACK');throw e;}
  }
  return db;
}
export function saveItem(db,input) {
  const id=input.id || 'LB-'+randomUUID().slice(0,8).toUpperCase();
  const old=db.prepare('SELECT * FROM items WHERE id=?').get(id);
  const now=new Date().toISOString();
  const defaults={title:'',author:'',year:'',category_id:null,source_path:'',original_name:'',format:'',size_label:'',description:'',proton_url:'',link_scope:'folder',status:'draft',metadata_basis:'manual'};
  const row={...defaults,...old};
  for(const key of Object.keys(defaults)) if(Object.hasOwn(input,key)) row[key]=input[key];
  row.id=id; row.title=String(row.title).trim();
  if(!row.title || row.title.length>500) throw new Error('标题不能为空，且最多 500 字。');
  if(!['draft','published','archived'].includes(row.status)) throw new Error('无效的发布状态。');
  if(!['folder','file'].includes(row.link_scope)) throw new Error('无效的链接类型。');
  if(row.proton_url){let u;try{u=new URL(row.proton_url);}catch{throw new Error('请输入完整的 Proton 链接。');}if(u.protocol!=='https:'||u.hostname!=='drive.proton.me'||u.username||u.password)throw new Error('只接受 drive.proton.me 的 HTTPS 分享链接。');}
  for(const key of Object.keys(defaults)) if(key!=='category_id'&&(typeof row[key]!=='string'||row[key].length>10000)) throw new Error('字段格式或长度不正确。');
  row.revision=(old?.revision||0)+1;row.created_at=old?.created_at||now;row.updated_at=now;
  const keys=Object.keys(row);
  db.prepare(`INSERT INTO items (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${keys.filter(k=>k!=='id').map(k=>`${k}=excluded.${k}`).join(',')}`).run(...keys.map(k=>row[k]));
  db.prepare('INSERT INTO revisions(item_id,revision,snapshot,created_at) VALUES(?,?,?,?)').run(id,row.revision,JSON.stringify(row),now);
  return row;
}
export function catalogue(db,admin=false) {
  const meta=Object.fromEntries(db.prepare("SELECT * FROM meta WHERE key!='seeded'").all().map(r=>[r.key,JSON.parse(r.value)]));
  const items=db.prepare(`SELECT i.*,c.name AS category FROM items i LEFT JOIN categories c ON c.id=i.category_id ${admin?'':"WHERE i.status='published'"} ORDER BY i.id`).all();
  for(const item of items){item.files=db.prepare('SELECT id,original_name,bytes,mime,sha256,created_at FROM files WHERE item_id=? ORDER BY created_at DESC').all(item.id);}
  return {schema_version:1,meta,categories:db.prepare(`SELECT * FROM categories ${admin?'':"WHERE coverage!='retired'"} ORDER BY id`).all(),items};
}
export function exportCatalogue(db,path) {
  const data=catalogue(db);for(const item of data.items)item.files=[];
  writeFileSync(path,JSON.stringify(data,null,2)+'\n');return data;
}
