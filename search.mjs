import Fuse from './vendor/fuse.min.mjs';

const variants={傳:'传',雲:'云',與:'与',語:'语',書:'书',國:'国',軍:'军',黨:'党',憶:'忆',錄:'录',親:'亲',歷:'历',動:'动',亂:'乱',選:'选',圖:'图',論:'论',華:'华',學:'学'};
const normalize=value=>String(value||'').toLowerCase().normalize('NFKC').replace(/[傳雲彪與語書國軍黨憶錄親歷動亂選圖論華學]/g,char=>variants[char]||char);

export function createSearch(items){
  const records=items.map(item=>({item,id:normalize(item.id),title:normalize(item.title),author:normalize(item.author),category:normalize(item.category),originalName:normalize(item.original_name),sourcePath:normalize(item.source_path),description:normalize(item.description)}));
  const fuse=new Fuse(records,{includeScore:true,threshold:.38,ignoreLocation:true,keys:[{name:'title',weight:.56},{name:'author',weight:.22},{name:'category',weight:.09},{name:'originalName',weight:.07},{name:'sourcePath',weight:.04},{name:'description',weight:.015},{name:'id',weight:.005}]});
  return query=>{
    const terms=normalize(query).split(/\s+/).filter(Boolean);
    if(!terms.length)return items.slice();
    const candidates=new Map();
    for(const term of terms)for(const hit of fuse.search(term)){
      const id=hit.item.item.id,candidate=candidates.get(id)||{item:hit.item.item,matched:0,score:0};
      candidate.matched+=1;candidate.score+=hit.score??1;candidates.set(id,candidate);
    }
    return [...candidates.values()].filter(candidate=>candidate.matched===terms.length).sort((a,b)=>a.score-b.score||a.item.id.localeCompare(b.item.id,'en')).map(candidate=>candidate.item);
  };
}
