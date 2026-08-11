import assert from 'node:assert/strict'; import test from 'node:test';
import { createDirectorPipeline } from '../../src/director/pipeline.js';
test('pipeline injects, generates, clears prompt and commits in order', async()=>{
 const order=[]; const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(_v)=>order.push(_v?'inject':'clear'),generateReply:async()=>order.push('generate')},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:null,feedback:{classification:'neutral'},actions:[],branches:[],risks:[],foreshadowing:[],ruleLedgerUpdate:{},injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>order.push('stage'),commit:async()=>order.push('commit'),rollback:async()=>order.push('rollback')},collector:async()=>({})});
 await pipeline.handleUserMessage('hi'); assert.deepEqual(order,['stage','inject','generate','clear','commit']);
});
test('pipeline clears injection and rolls back when main generation fails', async()=>{
 const order=[]; const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(v)=>order.push(v?'inject':'clear'),generateReply:async()=>{throw new Error('main failed');}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:null,foreshadowing:[],injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>order.push('stage'),commit:async()=>order.push('commit'),rollback:async()=>order.push('rollback')},collector:async()=>({})});
 await assert.rejects(pipeline.handleUserMessage('hi'),/main failed/); assert.deepEqual(order,['stage','inject','rollback','clear']);
});
