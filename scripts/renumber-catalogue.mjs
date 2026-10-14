import {DatabaseSync} from 'node:sqlite';
import {copyFileSync,existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=process.env.LIBRARY_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dbPath=join(root,'data','library.sqlite');
const statePath=join(root,'data','proton-sync','state.json');
const backupDir=join(root,'data','backups');
const timestamp=new Date().toISOString().replace(/[:.]/g,'-');
if(!existsSync(dbPath))throw Error('找不到馆藏数据库。');

mkdirSync(backupDir,{recursive:true});
const backupPath=join(backupDir,`pre-renumber-${timestamp}.sqlite`);
if(existsSync(statePath))copyFileSync(statePath,join(backupDir,`pre-renumber-proton-state-${timestamp}.json`));

const db=new DatabaseSync(dbPath);
db.prepare('VACUUM INTO ?').run(backupPath);
const rows=db.prepare('SELECT id,created_at FROM items ORDER BY created_at ASC,id ASC').all();
const mapping=new Map(rows.map((row,index)=>[row.id,`LB-${String(index+1).padStart(5,'0')}`]));
const changed=[...mapping].filter(([from,to])=>from!==to);
if(!changed.length){console.log(`编号已连续，无需迁移（${rows.length} 条）。`);db.close();process.exit(0);}

const temporary=new Map(changed.map(([from],index)=>[from,`__REN_${String(index+1).padStart(6,'0')}__`]));
db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE;');
try{
  for(const [from,temp] of temporary){
    for(const table of ['files','revisions','sync_jobs'])db.prepare(`UPDATE ${table} SET item_id=? WHERE item_id=?`).run(temp,from);
    db.prepare('UPDATE items SET id=? WHERE id=?').run(temp,from);
  }
  for(const [from,temp] of temporary){
    const to=mapping.get(from);
    db.prepare('UPDATE items SET id=? WHERE id=?').run(to,temp);
    for(const table of ['files','revisions','sync_jobs'])db.prepare(`UPDATE ${table} SET item_id=? WHERE item_id=?`).run(to,temp);
  }
  for(const row of db.prepare('SELECT id,snapshot FROM revisions').all()){
    let snapshot;try{snapshot=JSON.parse(row.snapshot);}catch{continue;}
    const replacement=mapping.get(snapshot.id);
    if(replacement){snapshot.id=replacement;db.prepare('UPDATE revisions SET snapshot=? WHERE id=?').run(JSON.stringify(snapshot),row.id);}
  }
  db.exec('COMMIT; PRAGMA foreign_keys=ON;');
}catch(error){db.exec('ROLLBACK; PRAGMA foreign_keys=ON;');db.close();throw error;}
const violations=db.prepare('PRAGMA foreign_key_check').all();
db.close();
if(violations.length)throw Error('迁移后外键校验失败；请从备份恢复。');

if(existsSync(statePath)){
  const state=JSON.parse(readFileSync(statePath,'utf8'));
  for(const node of Object.values(state.nodes||{}))if(mapping.has(node.itemId))node.itemId=mapping.get(node.itemId);
  const temporaryPath=statePath+'.tmp';writeFileSync(temporaryPath,JSON.stringify(state,null,2)+'\n');renameSync(temporaryPath,statePath);
}
console.log(`已重新编号 ${rows.length} 条书目；变更 ${changed.length} 条。数据库备份：${backupPath}`);
