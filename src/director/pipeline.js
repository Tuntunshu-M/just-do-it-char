import { evaluatePolicy as defaultPolicy } from './policy.js';
import { EXTENSION_PROMPT_KEY } from '../constants.js';
export function createDirectorPipeline({adapter,store,client,policy,engine,collector,scheduler}) {
 let generation=0;
 async function run(userText,intent={type:'advance'}) {
  const token=++generation, settings=store.loadGlobal(); if(!settings.enabled) return {skipped:true};
  const chatKey=adapter.getCurrentChatKey(), state=store.loadChat(chatKey);
  if(scheduler&&!scheduler.shouldTrigger(state,settings.trigger)) return {skipped:true};
  const context=await collector(adapter,state,settings); const result=await client.requestDirector({context,intent},settings.connection);
  if(token!==generation||adapter.getCurrentChatKey()!==chatKey) return {cancelled:true};
  await store.saveGlobal?.(settings);
  const check=(policy.evaluatePolicy??defaultPolicy)({proposal:result.event??{category:'daily'},state,settings,userText});
  if(!check.allowed) return check;
  await engine.stage(chatKey,state.characterFingerprint,{foreshadowing:result.foreshadowing});
  try { await adapter.injectPrompt(EXTENSION_PROMPT_KEY,result.injection); await adapter.generateReply(); }
  catch(error){ await engine.rollback(chatKey,state.characterFingerprint); throw error; }
  finally { await adapter.injectPrompt(EXTENSION_PROMPT_KEY,''); }
  await engine.commit(chatKey,state.characterFingerprint); return result;
 }
 return {handleUserMessage:(text)=>run(text),handleIdle:()=>run('',{type:'idle'}),manualCreate:(text,expand=true)=>run(text,{type:'manual',expand}),cancel(){generation+=1;}};
}
