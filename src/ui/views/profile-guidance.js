import { el, field } from '../dom.js';

export function renderProfileGuidanceView({ body, settings, saveSettings }) {
  const doc = body.ownerDocument;
  settings.profileGuidance ??= { gemini: false, claude: false };
  for (const [key, label] of [
    ['gemini', 'Gemini 角色塑造特化'],
    ['claude', 'Claude 主动表达特化'],
  ]) {
    const input = el(doc, 'input', { type: 'checkbox', checked: settings.profileGuidance[key] === true });
    input.onchange = () => {
      settings.profileGuidance[key] = input.checked;
      saveSettings();
    };
    body.append(field(doc, label, input));
  }
}
