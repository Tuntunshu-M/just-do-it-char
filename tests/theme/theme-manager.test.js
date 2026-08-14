import assert from'node:assert/strict';import test from'node:test';import{createCssTemplate,createThemeManager,scopeCss,themeModeClass}from'../../src/theme/theme-manager.js';
test('css scopes ordinary selectors but preserves at-rules',()=>{const css=scopeCss('.x, button {color:red}@media (max-width:600px){.x{color:blue}}');assert.match(css,/#st-proactive-director \.x/);assert.match(css,/@media/);});
test('css keeps selectors that are already scoped to the plugin root',()=>{const css=scopeCss('#st-proactive-director {color:red}\n#st-proactive-director .x, button {color:blue}');assert.doesNotMatch(css,/#st-proactive-director #st-proactive-director/);assert.match(css,/#st-proactive-director\s*\{color:red\}/);assert.match(css,/#st-proactive-director \.x/);assert.match(css,/#st-proactive-director button/);});
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
 assert.deepEqual(m.rollback(),{mode:'night',enabled:true,allowGlobalCss:false,variables:{},css:'.a { color: red; }'});
});

test('theme load establishes the persisted rollback baseline', () => {
 const nodes=[];
 const doc={head:{append:nodes.push.bind(nodes)},createElement:()=>({textContent:'',remove(){}})};
 const m=createThemeManager(doc,{save:async()=>{}});
 m.load({enabled:true,allowGlobalCss:false,variables:{},css:'.saved { color: green; }'});
 m.preview({enabled:true,css:'.preview { color: blue; }'});
 assert.deepEqual(m.rollback(),{mode:'night',enabled:true,allowGlobalCss:false,variables:{},css:'.saved { color: green; }'});
});

test('theme mode maps persisted settings to a stable root class', () => {
 assert.equal(themeModeClass('day'), 'stpd-theme-day');
 assert.equal(themeModeClass('night'), 'stpd-theme-night');
 assert.equal(themeModeClass('unknown'), 'stpd-theme-night');
});

test('css template exposes editable variables and common scoped components without secrets', () => {
 const css=createCssTemplate();
 for(const token of ['--stpd-bg','--stpd-panel','--stpd-text','--stpd-muted','--stpd-accent','.stpd-modal','.stpd-tabs button','.stpd-actions button','input,','textarea'])assert.match(css,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 assert.doesNotMatch(css,/apiKey|Authorization|Bearer|endpoint/i);
});

test('css template includes responsive script library and cast controls', () => {
 const css=createCssTemplate();
 for(const token of ['.stpd-script-layout','.stpd-script-list','.stpd-script-detail','.stpd-script-detail-header','.stpd-script-editor','.stpd-script-toolbar','.stpd-script-time','.stpd-script-stage-summary','.stpd-script-field','.stpd-script-stage','.stpd-script-clue','.stpd-revision-summary','.stpd-cast-mode','.stpd-cast-members','.stpd-cast-member','@media (max-width: 520px)']){
  assert.match(css,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
 }
 assert.match(css,/\.stpd-script-layout\s*\{[^}]*grid-template-columns:\s*minmax\(150px,\s*210px\)\s+minmax\(0,\s*1fr\)/s);
 assert.match(css,/\.stpd-script-toolbar\s*\{[^}]*flex-wrap:\s*nowrap[^}]*overflow-x:\s*auto/s);
 assert.match(css,/@media \(max-width: 520px\)[\s\S]*\.stpd-script-layout\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
