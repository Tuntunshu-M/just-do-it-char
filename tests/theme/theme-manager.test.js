import assert from'node:assert/strict';import test from'node:test';import{createThemeManager,scopeCss}from'../../src/theme/theme-manager.js';
test('css scopes ordinary selectors but preserves at-rules',()=>{const css=scopeCss('.x, button {color:red}@media (max-width:600px){.x{color:blue}}');assert.match(css,/#st-proactive-director \.x/);assert.match(css,/@media/);});
test('theme export contains appearance only',()=>{const nodes=[];const doc={head:{append:n=>nodes.push(n)},createElement:()=>({remove(){this.removed=true;}})};const m=createThemeManager(doc,{save:async()=>{}});m.preview({enabled:true,css:'.x{}',variables:{'--stpd-accent':'#fff'}});const out=m.exportTheme();assert.equal(JSON.stringify(out).includes('apiKey'),false);m.destroy();assert.equal(nodes[0].removed,true);});

test('theme scoping handles supports and keyframes without prefixing at-rule bodies', () => {
 const css=scopeCss('@supports (display:grid){.x{display:grid}}@keyframes pulse{from{opacity:0}to{opacity:1}}');
 assert.match(css, /@supports/);
 assert.match(css, /#st-proactive-director \.x/);
 assert.match(css, /@keyframes pulse/);
 assert.doesNotMatch(css, /#st-proactive-director from/);
});

test('theme rollback returns the restored theme for settings synchronization', async () => {
 const nodes=[];
 const doc={head:{append:nodes.push.bind(nodes)},createElement:()=>({textContent:'',remove(){}})};
 const m=createThemeManager(doc,{save:async()=>{}});
 m.preview({enabled:true,css:'.a { color: red; }'});
 await m.save();
 m.preview({enabled:true,css:'.a { color: blue; }'});
 assert.deepEqual(m.rollback(),{enabled:true,allowGlobalCss:false,variables:{},css:'.a { color: red; }'});
});

test('theme load establishes the persisted rollback baseline', () => {
 const nodes=[];
 const doc={head:{append:nodes.push.bind(nodes)},createElement:()=>({textContent:'',remove(){}})};
 const m=createThemeManager(doc,{save:async()=>{}});
 m.load({enabled:true,allowGlobalCss:false,variables:{},css:'.saved { color: green; }'});
 m.preview({enabled:true,css:'.preview { color: blue; }'});
 assert.deepEqual(m.rollback(),{enabled:true,allowGlobalCss:false,variables:{},css:'.saved { color: green; }'});
});
