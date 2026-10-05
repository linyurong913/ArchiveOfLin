import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearch} from '../public/search.mjs';

const items=[
  {id:'LB-00001',title:'林彪傳',author:'舒雲',category:'传记',original_name:'林彪傳.pdf',source_path:'传记/林彪傳.pdf',description:''},
  {id:'LB-00002',title:'九一三事件史实与辨析',author:'余汝信',category:'913相关史学',original_name:'913回望.pdf',source_path:'913相关史学/回望.pdf',description:''},
  {id:'LB-00003',title:'东北战场资料选编',author:'编者待核',category:'军事史',original_name:'资料.pdf',source_path:'人物/林彪/资料.pdf',description:''}
];

test('繁简体查询能命中书名',()=>{
  assert.equal(createSearch(items)('林彪传')[0].id,'LB-00001');
});

test('多个词必须同时命中',()=>{
  assert.deepEqual(createSearch(items)('九一三 辨析').map(item=>item.id),['LB-00002']);
});

test('书名命中优先于仅路径命中',()=>{
  assert.equal(createSearch(items)('林彪')[0].id,'LB-00001');
});
