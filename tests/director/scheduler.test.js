import assert from 'node:assert/strict'; import test from 'node:test';
import { createScheduler } from '../../src/director/scheduler.js';
test('scheduler supports every-turn, fixed-turn and cooldown', () => {
 const s=createScheduler({random:()=>0}); const state={counters:{turns:4,eventsToday:0},cooldowns:{lastTurn:1}};
 assert.equal(s.shouldTrigger(state,{mode:'every',cooldownTurns:2,dailyLimit:5}),true);
 assert.equal(s.shouldTrigger(state,{mode:'fixed',fixedTurns:3,cooldownTurns:0,dailyLimit:5}),false);
 state.counters.turns=6; assert.equal(s.shouldTrigger(state,{mode:'fixed',fixedTurns:3,cooldownTurns:0,dailyLimit:5}),true);
});
