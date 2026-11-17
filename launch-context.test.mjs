import test from 'node:test';
import assert from 'node:assert/strict';
import {readLaunchContext,publishHostView} from './launch-context.mjs';
test('Standalone and existing list links keep the full interface',()=>{
 for(const query of ['', '?shoplist=one','?from=other'])assert.equal(readLaunchContext('https://example.org/'+query).compact,false);
});
test('Sharon presentation supports collection and safe return without accepting arbitrary destinations',()=>{
 const c=readLaunchContext('https://example.org/?from=sharon&view=collect&return=https://evil.example');
 assert.equal(c.compact,true);assert.equal(c.view,'home');assert.equal(c.returnUrl,'https://stefan-van-dijk.github.io/sharon/');
 assert.equal(readLaunchContext('https://example.org/?from=sharon&view=unknown').view,'lists');
});

test('Embedded collection and check modes are announced only to the trusted Sharon host',()=>{
 const sent=[],win={location:{href:'https://stefan-van-dijk.github.io/shop/?from=sharon'},parent:{postMessage:(data,origin)=>sent.push({data,origin})}};
 assert.equal(publishHostView('home',win),true);assert.equal(publishHostView('lists',win),true);
 assert.deepEqual(sent,[{data:{type:'shop:view',view:'collect'},origin:'https://stefan-van-dijk.github.io'},{data:{type:'shop:view',view:'check'},origin:'https://stefan-van-dijk.github.io'}]);
 assert.equal(publishHostView('manage',win),false);assert.equal(sent.length,2);
});
test('Standalone Shop and unrelated embedding do not publish their current view',()=>{
 const sent=[],win={location:{href:'https://stefan-van-dijk.github.io/shop/?from=sharon'},postMessage:data=>sent.push(data)};win.parent=win;
 assert.equal(publishHostView('home',win),false);
 win.parent={postMessage:data=>sent.push(data)};win.location.href='https://stefan-van-dijk.github.io/shop/';
 assert.equal(publishHostView('lists',win),false);assert.deepEqual(sent,[]);
 assert.equal(readLaunchContext('https://stefan-van-dijk.github.io/shop/?from=sharon&view=check').view,'lists');
});
