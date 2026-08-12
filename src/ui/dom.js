export function el(doc, tag, attrs = {}, text = '') {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'checked') node.checked = value;
    else if (key === 'disabled') node.disabled = value;
    else node.setAttribute(key, value);
  }
  node.textContent = text;
  return node;
}

export function field(doc, label, input) {
  const wrapper = el(doc, 'label', { class: 'stpd-field' });
  wrapper.append(el(doc, 'span', {}, label), input);
  return wrapper;
}

export function selectField(doc, label, value, options, onChange) {
  const select = el(doc, 'select', { 'aria-label': label });
  for (const [optionValue, text] of options) {
    const option = el(doc, 'option', { value: optionValue }, text);
    option.selected = value === optionValue;
    select.append(option);
  }
  select.onchange = () => onChange(select.value);
  return field(doc, label, select);
}

export function lines(value) {
  return String(value ?? '').split(/[\n,，]/).map((item) => item.trim()).filter(Boolean);
}

export async function runAction(action, notice) {
  try {
    await action();
    return true;
  } catch (error) {
    notice?.(error?.message || '操作失败，请稍后重试。');
    return false;
  }
}
