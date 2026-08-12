import assert from'node:assert/strict';import test from'node:test';import{exportSnapshot,previewImport,applyImport,undoLastImport}from'../../src/snapshots/snapshot-manager.js';
test('snapshot selection excludes sensitive grants',()=>{const state={activeEvent:{id:'e'},foreshadowing:[],historySummary:'h',cast:{members:[]},preference:{consequencePermissions:{death:'authorized'}},sceneSafety:{cncEnabled:true,safewords:['x'],hardLimits:['y']}};const x=exportSnapshot(state,{eventFramework:true,safety:true});assert.deepEqual(x.data.sceneSafety,{safewords:['x'],hardLimits:['y']});assert.equal(JSON.stringify(x).includes('authorized'),false);assert.equal(JSON.stringify(x).includes('cncEnabled'),false);});
test('import can discard personality inference and undo',()=>{const target={historySummary:'old',cast:{members:[{id:'new'}]}};const snap={version:1,data:{historySummary:'new',cast:{members:[{id:'old',inference:['x']}]}}};const p=previewImport(snap,target,{history:true,personality:false});const applied=applyImport(p);assert.equal(applied.historySummary,'new');assert.deepEqual(applied.cast,target.cast);assert.deepEqual(undoLastImport(),target);});

test('snapshot preview supports migration modes and preserves target identity', () => {
 const target={chatKey:'target',characterFingerprint:'new',activeEvent:null,foreshadowing:[],cast:{members:[]},historySummary:''};
 const snap={version:1,data:{activeEvent:{id:'e'},foreshadowing:[{id:'f'}],cast:{members:[{id:'old'}]},historySummary:'h'}};
 const adapted=previewImport(snap,target,{mode:'adapt',eventFramework:true,personality:true,history:true});
 assert.equal(adapted.after.chatKey,'target');
 assert.equal(adapted.after.characterFingerprint,'new');
 assert.equal(adapted.after.activeEvent.id,'e');
 assert.ok(adapted.warnings.length);
});
