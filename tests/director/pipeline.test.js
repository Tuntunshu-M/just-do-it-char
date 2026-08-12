import assert from 'node:assert/strict'; import test from 'node:test';
import { createDirectorPipeline } from '../../src/director/pipeline.js';
test('pipeline injects, generates, clears prompt and commits in order', async()=>{
 const order=[]; const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(_key,value)=>order.push(value?'inject':'clear'),generateReply:async()=>order.push('generate')},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:{title:'event',category:'daily'},feedback:{classification:'neutral'},actions:[],branches:[],risks:[],foreshadowing:[],ruleLedgerUpdate:{},injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>order.push('stage'),commit:async()=>order.push('commit'),rollback:async()=>order.push('rollback')},collector:async()=>({})});
 await pipeline.handleUserMessage('hi'); assert.deepEqual(order,['stage','inject','generate','clear','commit']);
});
test('pipeline clears injection and rolls back when main generation fails', async()=>{
 const order=[]; const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(_key,value)=>order.push(value?'inject':'clear'),generateReply:async()=>{throw new Error('main failed');}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:{title:'event',category:'daily'},foreshadowing:[],injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>order.push('stage'),commit:async()=>order.push('commit'),rollback:async()=>order.push('rollback')},collector:async()=>({})});
 await assert.rejects(pipeline.handleUserMessage('hi'),/main failed/); assert.deepEqual(order,['stage','inject','rollback','clear']);
});
test('pipeline persists a changed main API reminder deadline', async()=>{
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const settings={enabled:true,connection:{mode:'main',mainReminderUntil:0},trigger:{mode:'every'},categories:{daily:{enabled:true}}};
 let saved=null;
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async()=>{},generateReply:async()=>{}},store:{loadGlobal:()=>settings,saveGlobal:async(value)=>{saved=value;},loadChat:()=>state},client:{requestDirector:async(_request,connection)=>{connection.mainReminderUntil=123;return{event:{title:'event',category:'daily'},foreshadowing:[],injection:'act'};}},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>{},commit:async()=>{},rollback:async()=>{}},collector:async()=>({})});
 await pipeline.handleUserMessage('hi'); assert.equal(saved.connection.mainReminderUntil,123);
});

test('pipeline coalesces same-chat requests and retries personality validation once', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 let requests=0; let resolveFirst;
 const first=new Promise((resolve)=>{resolveFirst=resolve;});
 const client={requestDirector:async()=>{requests+=1;if(requests===1)await first;return{event:{title:'event',category:'daily'},actions:[],foreshadowing:[],injection:'act'};}};
 let validations=0;
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async()=>{},generateReply:async()=>{}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client,policy:{evaluatePolicy:()=>({allowed:true})},personality:{validate:()=>({allowed:++validations>1})},engine:{stage:async()=>{},commit:async()=>{},rollback:async()=>{}},collector:async()=>({})});
 const one=pipeline.handleUserMessage('one');
 const two=pipeline.handleUserMessage('two');
 resolveFirst();
 await Promise.all([one,two]);
 assert.equal(requests,2);
 assert.equal(validations,2);
});

test('ordinary regeneration reuses prior injection while rejudge calls director', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{},lastInjection:'prior'};
 let directorCalls=0; const injected=[];
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async(_key,value)=>injected.push(value),generateReply:async()=>{}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>{directorCalls+=1;return{event:{title:'event',category:'daily'},foreshadowing:[],injection:'new'};}},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>{},commit:async()=>{},rollback:async()=>{}},collector:async()=>({})});
 await pipeline.regenerate({rejudge:false});
 assert.equal(directorCalls,0); assert.equal(injected[0],'prior');
 await pipeline.regenerate({rejudge:true});
 assert.equal(directorCalls,1);
});

test('manual creation bypasses automatic scheduler and stages rule updates', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 let staged;
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async()=>{},generateReply:async()=>{}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'fixed'},categories:{daily:{enabled:true}}}),loadChat:()=>state},client:{requestDirector:async()=>({event:{title:'手动事件',category:'daily'},foreshadowing:[],ruleLedgerUpdate:{objectives:[{id:'o1'}]},injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async(_c,_f,value)=>{staged=value;},commit:async()=>{},rollback:async()=>{}},collector:async()=>({}),scheduler:{shouldTrigger:()=>false}});
 await pipeline.manualCreate('由 char 策划旅行',true);
 assert.equal(staged.proposal.title,'手动事件');
 assert.deepEqual(staged.ruleLedgerUpdate,{objectives:[{id:'o1'}]});
});

test('automatic messages advance turn and successful events update cooldown counters', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:2,eventsToday:0,dayKey:null},cooldowns:{}};
 const saved=[];
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async()=>{},generateReply:async()=>{}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state,saveChat:async(value)=>saved.push(structuredClone(value))},client:{requestDirector:async()=>({event:{title:'事件',category:'daily'},foreshadowing:[],ruleLedgerUpdate:{},injection:'act'})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>{},commit:async()=>{},rollback:async()=>{}},collector:async()=>({})});
 await pipeline.handleUserMessage('hi');
 assert.equal(state.counters.turns,3);
 assert.equal(state.cooldowns.lastTurn,3);
 assert.equal(state.counters.eventsToday,1);
 assert.ok(state.counters.dayKey);
});

test('collector failure records the collecting stage and emits a failed outcome', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const outcomes=[];
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c'},store:{loadGlobal:()=>({enabled:true,connection:{apiKey:'secret'},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state,saveChat:async()=>{}},client:{},engine:{},collector:async()=>{throw new Error('collector failed with secret');},onOutcome:(value)=>outcomes.push(value)});
 await assert.rejects(pipeline.handleUserMessage('hi'),/collector failed/);
 assert.equal(state.diagnostics.records.at(-1).status,'failed');
 assert.equal(state.diagnostics.records.at(-1).stage,'collecting');
 assert.equal(state.diagnostics.records.at(-1).message.includes('secret'),false);
 assert.deepEqual(outcomes.map(({status,stage,trigger})=>({status,stage,trigger})),[{status:'failed',stage:'collecting',trigger:'advance'}]);
});

test('director request and reply failures report their actual pipeline stages', async () => {
 for (const expectedStage of ['generating','reply']) {
  const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
  const outcomes=[];
  const client={requestDirector:async()=>{if(expectedStage==='generating')throw new Error('director failed');return{event:{title:'event',category:'daily'},foreshadowing:[],ruleLedgerUpdate:{},injection:'act'};}};
  const adapter={getCurrentChatKey:()=> 'c',injectPrompt:async()=>{},generateReply:async()=>{throw new Error('reply failed');}};
  const pipeline=createDirectorPipeline({adapter,store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state,saveChat:async()=>{}},client,policy:{evaluatePolicy:()=>({allowed:true})},engine:{stage:async()=>{},commit:async()=>{},rollback:async()=>{}},collector:async()=>({}),onOutcome:(value)=>outcomes.push(value)});
  await assert.rejects(pipeline.handleUserMessage('hi'));
  assert.equal(state.diagnostics.records.at(-1).stage,expectedStage);
  assert.equal(outcomes.at(-1).stage,expectedStage);
 }
});

test('manual creation without an event reports not-generated and never injects or generates a reply', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 let injected=0; let replies=0; const outcomes=[];
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c',injectPrompt:async()=>{injected+=1;},generateReply:async()=>{replies+=1;}},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state,saveChat:async()=>{}},client:{requestDirector:async()=>({event:null,feedback:{reason:'当前信息不足'},foreshadowing:[],injection:''})},policy:{evaluatePolicy:()=>({allowed:true})},engine:{},collector:async()=>({}),onOutcome:(value)=>outcomes.push(value)});
 const result=await pipeline.manualCreate('create one',true);
 assert.equal(result.status,'not-generated');
 assert.equal(injected,0); assert.equal(replies,0);
 assert.equal(state.diagnostics.records.at(-1).status,'not-generated');
 assert.match(state.diagnostics.records.at(-1).message,/当前信息不足/);
 assert.equal(outcomes.at(-1).trigger,'manual');
});

test('policy refusal is retained and returned as a not-generated outcome', async () => {
 const state={chatKey:'c',characterFingerprint:'f',preference:{},sceneSafety:{},counters:{turns:0},cooldowns:{}};
 const outcomes=[];
 const pipeline=createDirectorPipeline({adapter:{getCurrentChatKey:()=> 'c'},store:{loadGlobal:()=>({enabled:true,connection:{},trigger:{mode:'every'},categories:{daily:{enabled:true}}}),loadChat:()=>state,saveChat:async()=>{}},client:{requestDirector:async()=>({event:{title:'blocked',category:'daily'},foreshadowing:[],injection:'act'})},policy:{evaluatePolicy:()=>({allowed:false,reasons:['hard limit']})},engine:{},collector:async()=>({}),onOutcome:(value)=>outcomes.push(value)});
 const result=await pipeline.manualCreate('blocked',true);
 assert.equal(result.allowed,false);
 assert.equal(state.diagnostics.records.at(-1).stage,'policy');
 assert.equal(state.diagnostics.records.at(-1).status,'not-generated');
 assert.equal(outcomes.at(-1).message,'hard limit');
});
