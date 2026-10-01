// Publish only the explicit static-file allowlist, through GitHub's Git API.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const repo='linyurong913/ArchiveOfLin';
function api(path,body){
  const args=['api',`repos/${repo}/${path}`];if(body)args.push('--method','POST','--input','-');
  try{return JSON.parse(execFileSync('gh',args,{input:body?JSON.stringify(body):undefined,encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']}));}
  catch{throw Error('GitHub publication failed. Check gh authentication and repository access.');}
}
const data=JSON.parse(readFileSync(join(root,'dist','catalog.json'),'utf8'));
if(data.items.some(i=>i.files?.length))throw Error('Refusing to publish local file references.');
const refs=api('git/matching-refs/heads/gh-pages');
const head=refs.find(r=>r.ref==='refs/heads/gh-pages')?.object.sha;
const parent=head?api(`git/commits/${head}`):null;
const tree=[];
for(const name of ['index.html','style.css','app.js','favicon.svg','linbiao-white.svg','catalog.json']){
  const content=readFileSync(join(root,'dist',name));
  const blob=api('git/blobs',{content:content.toString('base64'),encoding:'base64'});
  tree.push({path:name,mode:'100644',type:'blob',sha:blob.sha});
}
tree.push({path:'.nojekyll',mode:'100644',type:'blob',content:''});
const built=api('git/trees',{tree});
if(parent?.tree.sha===built.sha){console.log('PAGES_UNCHANGED');process.exit(0);}
const identity={name:'Archive Maintainer',email:'archive@local.invalid'};
const commit=api('git/commits',{message:'Update public Proton catalogue',tree:built.sha,parents:head?[head]:[],author:identity,committer:identity});
if(head){
  // Non-forced update rejects concurrent conflicting publications.
  try{execFileSync('gh',['api',`repos/${repo}/git/refs/heads/gh-pages`,'--method','PATCH','--input','-'],{input:JSON.stringify({sha:commit.sha,force:false}),encoding:'utf8',windowsHide:true,stdio:['pipe','pipe','pipe']});}catch{throw Error('Concurrent publication or permission failure; retry safely.');}
}else api('git/refs',{ref:'refs/heads/gh-pages',sha:commit.sha});
console.log(`PAGES_PUBLISHED ${commit.sha}`);
