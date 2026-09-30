import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';

const digest=value=>createHash('sha256').update(value).digest('hex');
export function resetAdminKey(root){
  const dir=join(root,'data');mkdirSync(dir,{recursive:true});
  const key=randomBytes(32).toString('base64url');
  const config=join(dir,'admin-auth.json');
  writeFileSync(join(dir,'admin-access-key.txt'),key+'\n',{mode:0o600});
  writeFileSync(config+'.tmp',JSON.stringify({keyHash:digest(key)})+'\n',{mode:0o600});
  renameSync(config+'.tmp',config);
  return join(dir,'admin-access-key.txt');
}
export function createAdminAuth(root,{now=Date.now}={}){
  const config=join(root,'data','admin-auth.json');
  if(!existsSync(config))resetAdminKey(root);
  const currentHash=()=>{const hash=JSON.parse(readFileSync(config,'utf8')).keyHash;if(!/^[a-f0-9]{64}$/.test(hash))throw new Error('管理员配置无效。');return hash;};
  currentHash();
  const sessions=new Map();let failures=0,blockedUntil=0;
  const ttl=8*60*60*1000,window=15*60*1000;
  const cookie=(id,maxAge)=>`linban_admin=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
  const sessionId=req=>String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('linban_admin='))?.slice(13);
  return {
    login(key,host){
      if(failures>=8&&now()<blockedUntil)return {status:429,error:'尝试次数过多，请 15 分钟后再试。',retryAfter:Math.ceil((blockedUntil-now())/1000)};
      if(now()>=blockedUntil){failures=0;blockedUntil=now()+window;}
      const hash=currentHash();
      if(typeof key!=='string'||key.length>128||!timingSafeEqual(Buffer.from(digest(key.trim()),'hex'),Buffer.from(hash,'hex'))){failures++;return {status:401,error:'管理员密钥不正确。'};}
      failures=0;blockedUntil=0;
      for(const [id,s] of sessions)if(s.expires<=now()||s.keyHash!==hash)sessions.delete(id);
      if(sessions.size>=16)sessions.delete(sessions.keys().next().value);
      const id=randomBytes(32).toString('hex');
      sessions.set(id,{token:randomBytes(32).toString('hex'),expires:now()+ttl,keyHash:hash,host});
      return {status:200,cookie:cookie(id,ttl/1000)};
    },
    session(req){
      const id=sessionId(req),s=sessions.get(id);
      if(!s)return null;
      if(s.expires<=now()||s.keyHash!==currentHash()){sessions.delete(id);return null;}
      return s.host===req.headers.host?s:null;
    },
    logout(req){sessions.delete(sessionId(req));return cookie('',0);}
  };
}
