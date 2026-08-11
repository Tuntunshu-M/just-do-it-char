import assert from 'node:assert/strict'; import test from 'node:test';
import { createDirectorPipeline } from '../../src/director/pipeline.js';
test('pipeline injects, generates, clears prompt and commits in order', async()=>{
 const order=[]; const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(_key,value)=>order.push(value?'inject':'clear'),generateReply:async()=>order.push('generate')},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:null,feedback:{classification:'neutral'},actions:[],branches:[],risks:[],foreshadowing:[],ruleLedgerUpdate:{},injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>order.push('stage'),commit:async()=>order.push('commit'),rollback:async()=>order.push('rollback')},collector:async()=>({})});
 await pipeline.handleUserMessage('hi'); assert.deepEqual(order,['stage','inject','generate','clear','commit']);
});
test('pipeline clears injection and rolls back when main generation fails', async()=>{
 const order=[]; const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(_key,value)=>order.push(value?'inject':'clear'),generateReply:async()=>{throw new Error('main failed');}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:null,foreshadowing:[],injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>order.push('stage'),commit:async()=>order.push('commit'),rollback:async()=>order.push('rollback')},collector:async()=>({})});
 await assert.rejects(pipeline.handleUserMessage('hi'),/main failed/); assert.deepEqual(order,['stage','inject','rollback','clear']);
});
test('pipeline persists a changed main API reminder deadline', async()=>{
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const settings={enabled:true,connection:{mode:'main',mainReminderUntil:0},trigger:{mode:'every'},categories:{daily:{enabled:true}}};
 let saved=null;
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async()=>{},generateReply:async()=>{}},store:{loadGlobal:()=>settings,saveGlobal:async(value)=>{saved=value;},loadChat:()=>state},client:{requestDirector:async(_request,connection)=>{connection.mainReminderUntil=123;return{event:null,foreshadowing:[],injection:'act'};}},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>{},commit:async()=>{},rollback:async()=>{}},collector:async()=>({})});
 await pipeline.handleUserMessage('hi'); assert.equal(saved.connection.mainReminderUntil,123);
});
