import { el, runAction } from '../dom.js';
import { showCastMemberDialog } from '../dialogs/cast-member.js';

export function renderCastMembers({ doc, body, cast, services }) {
  const section = el(doc, 'section', { class: 'stpd-cast-members' });
  section.append(el(doc, 'h4', {}, '多角色人物'));
  for (const member of cast.multiMembers ?? cast.members ?? []) {
    const row = el(doc, 'div', { class: 'stpd-cast-member' });
    row.append(el(doc, 'strong', {}, member.name || '未命名人物'));
    const lead = el(doc, 'button', { type: 'button', class: 'stpd-compact', 'aria-pressed': String(cast.leadId === member.id) }, '主推手');
    lead.onclick = () => runAction(() => services.setLeadMember?.(member.id), services.notice);
    const edit = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '编辑');
    edit.onclick = () => showCastMemberDialog(body, member, (value) => runAction(() => services.updateCastMember?.(member.id, value), services.notice));
    const remove = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '移除');
    remove.onclick = () => runAction(() => services.removeCastMember?.(member.id), services.notice);
    row.append(lead, edit, remove);
    section.append(row);
  }
  const add = el(doc, 'button', { type: 'button' }, '添加人物');
  add.onclick = () => showCastMemberDialog(body, {}, (value) => runAction(() => services.addCastMember?.(value), services.notice));
  section.append(add);
  return section;
}
