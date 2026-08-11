import { evaluatePolicy as defaultPolicy } from './policy.js';
import { EXTENSION_PROMPT_KEY } from '../constants.js';
export function createDirectorPipeline({adapter,store,client,policy,engine,collector,scheduler,onProgress}) {
 let generation=0;
  async function run(userText,intent={type:'advance'}) {
  const token=++generation, settings=store.loadGlobal(); if(!settings.enabled) return {skipped:true};
  const chatKey=adapter.getCurrentChatKey(), state=store.loadChat(chatKey);
  if(scheduler&&!scheduler.shouldTrigger(state,settings.trigger)) return {skipped:true};
  state.generation = { phase: 'collecting', startedAt: new Date().toISOString(), finishedAt: null, error: '' }; onProgress?.(state);
  await store.saveChat?.(state);
  let context;
  let result;
  try {
    context=await collector(adapter,state,settings); state.generation.phase = 'generating'; await store.saveChat?.(state); onProgress?.(state);
    result=await client.requestDirector({context,intent},settings.connection,(update) => { state.generation.phase = update.phase; onProgress?.(state); });
  } catch (error) {
    state.generation = { ...state.generation, phase: 'failed', finishedAt: new Date().toISOString(), error: error.message };
    await store.saveChat?.(state);
    onProgress?.(state);
    throw error;
  }
  if(token!==generation||adapter.getCurrentChatKey()!==chatKey) {
    state.generation = { ...state.generation, phase: 'idle', finishedAt: new Date().toISOString() };
    await store.saveChat?.(state);
    onProgress?.(state);
    return {cancelled:true};
  }
  await store.saveGlobal?.(settings);
  const check=(policy.evaluatePolicy??defaultPolicy)({proposal:result.event??{category:'daily'},state,settings,userText});
  if(!check.allowed) {
    state.generation = { ...state.generation, phase: 'idle', finishedAt: new Date().toISOString(), error: check.reason ?? '' };
    await store.saveChat?.(state);
    onProgress?.(state);
    return check;
  }
  await engine.stage(chatKey,state.characterFingerprint,{foreshadowing:result.foreshadowing});
  try { state.generation.phase = 'injecting'; await store.saveChat?.(state); onProgress?.(state); await adapter.injectPrompt(EXTENSION_PROMPT_KEY,result.injection); await adapter.generateReply(); }
  catch(error){ state.generation = { ...state.generation, phase: 'failed', finishedAt: new Date().toISOString(), error: error.message }; await store.saveChat?.(state); onProgress?.(state); await engine.rollback(chatKey,state.characterFingerprint); throw error; }
  finally { await adapter.injectPrompt(EXTENSION_PROMPT_KEY,''); }
  await engine.commit(chatKey,state.characterFingerprint); state.generation = { ...state.generation, phase: 'completed', finishedAt: new Date().toISOString() }; await store.saveChat?.(state); onProgress?.(state); return result;
 }
 return {handleUserMessage:(text)=>run(text),handleIdle:()=>run('',{type:'idle'}),manualCreate:(text,expand=true)=>run(text,{type:'manual',expand}),cancel(){generation+=1;}};
}
