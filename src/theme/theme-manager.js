const ROOT='#st-proactive-director';
const DEFAULT_THEME={mode:'night',enabled:false,allowGlobalCss:false,variables:{},css:''};
export function themeModeClass(mode){return mode==='day'?'stpd-theme-day':'stpd-theme-night';}
export function createCssTemplate(){return `/* 导演时间 CSS 美化模板
 * 所有规则默认限制在插件内。按需删除注释并修改颜色或尺寸。
 */
#st-proactive-director {
  --stpd-bg: #000000;
  --stpd-panel: #111111;
  --stpd-text: #ffffff;
  --stpd-muted: #d6d6d6;
  --stpd-border: rgb(255 255 255 / 28%);
  --stpd-accent: #e06c52;
  --stpd-success: #62a875;
  --stpd-warning: #d8a64b;
  --stpd-danger: #d75b62;
  --stpd-radius: 6px;
  --stpd-gap: 10px;
}

/* 主面板 */
.stpd-modal { background: var(--stpd-bg); }
.stpd-header { background: var(--stpd-panel); }

/* 顶部标签 */
.stpd-tabs button,
.stpd-settings-nav button { color: var(--stpd-muted); }
.stpd-tabs button[aria-selected="true"],
.stpd-settings-nav button[aria-selected="true"] { color: var(--stpd-text); }

/* 操作按钮 */
.stpd-actions button,
.stpd-modal-body > button {
  color: var(--stpd-bg);
  background: var(--stpd-text);
}

/* 输入控件 */
input,
select,
textarea {
  color: var(--stpd-text);
  background: var(--stpd-panel);
  border-color: var(--stpd-border);
}

/* 状态、列表和诊断记录 */
.stpd-status { color: var(--stpd-muted); }
.stpd-world-book,
.stpd-diagnostic-record,
.stpd-diagnostic-check { border-color: var(--stpd-border); }

/* 剧本库与运行控制 */
.stpd-script-toolbar {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  overflow-x: auto;
}
.stpd-script-toolbar button { flex: 0 0 auto; white-space: nowrap; }
.stpd-script-layout {
  display: grid;
  grid-template-columns: minmax(150px, 210px) minmax(0, 1fr);
  gap: var(--stpd-gap);
  min-width: 0;
  min-height: 0;
}
.stpd-script-list,
.stpd-script-detail {
  min-width: 0;
  overflow-y: auto;
}
.stpd-script-list { display: grid; align-content: start; gap: 6px; }
.stpd-script-list-item { width: 100%; min-width: 0; border-radius: 4px; }
.stpd-script-time { color: var(--stpd-muted); font-size: 12px; }
.stpd-script-stage-summary { color: var(--stpd-text); font-size: 12px; overflow-wrap: anywhere; }
.stpd-script-detail-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 8px; border-bottom: 1px solid var(--stpd-border); }
.stpd-script-editor { display: grid; gap: 8px; min-width: 0; padding: 10px; background: var(--stpd-panel); border: 1px solid var(--stpd-border); border-radius: 4px; }
.stpd-script-editor input,
.stpd-script-editor textarea { width: 100%; min-width: 0; resize: vertical; }
.stpd-script-detail,
.stpd-script-section,
.stpd-script-items { min-width: 0; overflow-wrap: anywhere; }
.stpd-script-field { display: grid; grid-template-columns: minmax(100px, 0.35fr) minmax(0, 1fr); gap: 6px; min-width: 0; }
.stpd-script-stage,
.stpd-script-clue { display: grid; gap: 6px; min-width: 0; padding: 8px; border: 1px solid var(--stpd-border); border-radius: 4px; }
.stpd-revision-summary { color: var(--stpd-muted); font-size: 12px; overflow-wrap: anywhere; }

/* 单人/多人模式与人物编辑 */
.stpd-cast-mode {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.stpd-cast-members { display: grid; gap: 6px; min-width: 0; }
.stpd-cast-member {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
  border-radius: 4px;
}
.stpd-cast-dialog-overlay { position: absolute; inset: 0; display: grid; place-items: center; padding: 16px; background: rgb(0 0 0 / 58%); }
.stpd-cast-dialog { display: grid; gap: 10px; width: min(520px, 100%); max-height: min(720px, calc(100dvh - 64px)); padding: 14px; overflow: auto; color: var(--stpd-text); background: var(--stpd-bg); border: 1px solid var(--stpd-border); border-radius: 6px; }
.stpd-cast-dialog-header { display: grid; grid-template-columns: minmax(0, 1fr) 36px; align-items: center; gap: 8px; }
.stpd-cast-dialog-close { inline-size: 36px; block-size: 36px; padding: 0; }
.stpd-cast-dialog-actions { justify-content: flex-end; }

@media (max-width: 520px) {
  .stpd-script-layout { grid-template-columns: 1fr; }
  .stpd-script-list { max-height: 150px; }
  .stpd-cast-member { grid-template-columns: minmax(0, 1fr) auto; }
  .stpd-cast-dialog-overlay { padding: 8px; }
  .stpd-cast-dialog { max-height: calc(100dvh - 32px); }
}
`;}
function matchingBrace(text,start){let depth=0;for(let i=start;i<text.length;i+=1){if(text[i]==='{')depth+=1;else if(text[i]==='}'&&--depth===0)return i;}return text.length-1;}
function scopeSelector(selector){const leading=selector.match(/^\s*/)[0];const trimmed=selector.trim();return trimmed.startsWith(ROOT)?`${leading}${trimmed}`:`${leading}${ROOT} ${trimmed}`;}
function scopeBlock(css,inKeyframes=false){let output='',cursor=0;while(cursor<css.length){const open=css.indexOf('{',cursor);if(open<0){output+=css.slice(cursor);break;}const header=css.slice(cursor,open);const close=matchingBrace(css,open);const body=css.slice(open+1,close);const trimmed=header.trim();if(trimmed.startsWith('@keyframes')||trimmed.startsWith('@-webkit-keyframes'))output+=`${header}{${body}}`;else if(trimmed.startsWith('@'))output+=`${header}{${scopeBlock(body,false)}}`;else if(inKeyframes)output+=`${header}{${body}}`;else output+=`${header.replace(/([^,]+)/g,scopeSelector)}{${body}}`;cursor=close+1;}return output;}
export function scopeCss(css){return scopeBlock(String(css??''));}
export function createThemeManager(documentRef,settingsStore){let current=structuredClone(DEFAULT_THEME),saved=structuredClone(current),style=documentRef.createElement('style');style.id='stpd-custom-theme';documentRef.head.append(style);
 function render(){if(!current.enabled){style.textContent='';return;}const vars=Object.entries(current.variables??{}).map(([k,v])=>`${k}:${v};`).join('');style.textContent=`${ROOT}{${vars}}\n${current.allowGlobalCss?current.css:scopeCss(current.css)}`;}
 return{load(t){current={...current,...structuredClone(t)};saved=structuredClone(current);render();return structuredClone(current);},preview(t){current={...current,...structuredClone(t)};render();},async save(){saved=structuredClone(current);await settingsStore.save?.(saved);return saved;},disable(){current.enabled=false;render();},reset(){current=structuredClone(DEFAULT_THEME);render();},rollback(){current=structuredClone(saved);render();return structuredClone(current);},importTheme(t){if(t?.version!==1)throw new Error('Unsupported theme version');current={...current,...structuredClone(t.theme)};render();},exportTheme(){return{version:1,theme:structuredClone(current)};},destroy(){style.remove();}};
}
