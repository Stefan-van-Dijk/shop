import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharonLogoMarkup} from './brand.mjs';
test('header and return logos have independent, complete clipping references',()=>{
 const header=readFileSync(new URL('./index.html',import.meta.url),'utf8');
 const marks=[header,...Array.from({length:3},()=>sharonLogoMarkup())];
 const seen=new Set();
 for(const mark of marks){
  const ids=[...mark.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
  for(const id of ids){assert.ok(!seen.has(id),`duplicate ${id}`);seen.add(id);}
  for(const [,ref] of mark.matchAll(/url\(#([^)]+)\)/g))assert.ok(ids.includes(ref),`missing ${ref}`);
 }
});
test('animated logo stays vector-only',()=>{
 const mark=sharonLogoMarkup();
 assert.doesNotMatch(mark,/<(?:image|mask|filter)\b/);
 assert.match(mark,/aria-hidden="true"/);
});
