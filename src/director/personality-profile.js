function text(value) {
  return String(value ?? '').trim();
}

export function buildPersonalityProfile(card, worldInfoEntries = [], options = {}) {
  if (!card) return { name: '', lines: [], sources: [] };
  const lines = [];
  const sources = [];
  const fields = [
    ['角色描述', options.card === false ? '' : card.description],
    ['人格特征', options.card === false ? '' : card.personality],
    ['当前场景', options.card === false ? '' : card.scenario],
    ['创作者备注', options.card === false ? '' : (card.creator_notes ?? card.creatorcomment)],
    ['示例对白', options.exampleDialogue === false ? '' : card.mes_example],
  ];
  for (const [label, value] of fields) {
    if (text(value)) {
      lines.push(`${label}：${text(value)}`);
      sources.push(label);
    }
  }
  for (const entry of worldInfoEntries) {
    if (text(entry.content)) {
      lines.push(`世界书·${text(entry.name) || text(entry.id)}：${text(entry.content)}`);
      sources.push(`世界书·${text(entry.name) || text(entry.id)}`);
    }
  }
  return { name: text(card.name), lines, sources };
}
