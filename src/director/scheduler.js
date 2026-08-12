function minutesOfDay(value) {
 const date=new Date(value); return date.getHours()*60+date.getMinutes();
}
function parseTime(value) { const [hours,minutes]=String(value).split(':').map(Number); return hours*60+minutes; }
function withinWindow(now,[start,end]) { const value=minutesOfDay(now),from=parseTime(start),to=parseTime(end); return from<=to?value>=from&&value<=to:value>=from||value<=to; }
export function createScheduler({ clock=Date.now, random=Math.random }={}) {
 return { shouldTrigger(state,settings,environment={}) {
  if(environment.hidden||environment.userTyping) return false;
  if(settings.allowedWindows?.length&&!settings.allowedWindows.some((window)=>withinWindow(environment.now??clock(),window))) return false;
  const turns=state.counters?.turns??0, last=state.cooldowns?.lastTurn??-Infinity;
  if(turns-last < (settings.cooldownTurns??0)) return false;
  if((state.counters?.eventsToday??0)>=(settings.dailyLimit??Infinity)) return false;
  if(settings.mode==='every') return true;
  if(settings.mode==='fixed') return turns>0&&turns%(settings.fixedTurns??4)===0;
  if(settings.mode==='hybrid') return random() < Math.min(.8,.15+turns*.03);
  if(settings.mode==='idle') return Boolean(settings.idleEnabled);
  return false;
 }, clock };
}
