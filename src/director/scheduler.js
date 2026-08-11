export function createScheduler({ clock=Date.now, random=Math.random }={}) {
 return { shouldTrigger(state,settings,environment={}) {
  if(environment.hidden||environment.userTyping) return false;
  const turns=state.counters?.turns??0, last=state.cooldowns?.lastTurn??-Infinity;
  if(turns-last < (settings.cooldownTurns??0)) return false;
  if((state.counters?.eventsToday??0)>=(settings.dailyLimit??Infinity)) return false;
  if(settings.mode==='every') return true;
  if(settings.mode==='fixed') return turns>0&&turns%(settings.fixedTurns??4)===0;
  if(settings.mode==='hybrid') return random() < Math.min(.8,.15+turns*.03);
  return false;
 }, clock };
}
