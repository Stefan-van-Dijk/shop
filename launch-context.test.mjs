import test from 'node:test';
import assert from 'node:assert/strict';
import {readLaunchContext} from './launch-context.mjs';
test('Standalone and existing list links keep the full interface',()=>{
 for(const query of ['', '?shoplist=one','?from=other'])assert.equal(readLaunchContext('https://example.org/'+query).compact,false);
});
test('Sharon presentation supports collection and safe return without accepting arbitrary destinations',()=>{
 const c=readLaunchContext('https://example.org/?from=sharon&view=collect&return=https://evil.example');
 assert.equal(c.compact,true);assert.equal(c.view,'home');assert.equal(c.returnUrl,'https://stefan-van-dijk.github.io/sharon/');
 assert.equal(readLaunchContext('https://example.org/?from=sharon&view=unknown').view,'lists');
});
