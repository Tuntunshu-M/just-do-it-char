import { el, field, runAction } from '../dom.js';

export function renderSingleCastSelection({ doc, cast, services }) {
  const candidates = cast.multiMembers?.length ? cast.multiMembers : cast.members ?? [];
  const select = el(doc, 'select', { 'aria-label': '当前主角色' });
  for (const member of candidates) {
    const option = el(doc, 'option', { value: member.id }, member.name || member.id);
    option.selected = member.id === cast.singleSelection?.id;
    select.append(option);
  }
  select.value = cast.singleSelection?.id ?? candidates[0]?.id ?? '';
  select.disabled = candidates.length === 0;
  select.onchange = () => runAction(() => services.setSingleCastMember?.(select.value), services.notice);
  return field(doc, '当前主角色', select);
}
