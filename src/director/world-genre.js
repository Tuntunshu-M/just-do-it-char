const GENRE_PATTERNS = {
  reality: /现实|日常|都市|校园|职场|现代|real(?:ity|istic)|modern/i,
  fantasy: /奇幻|魔法|精灵|龙族|剑与魔法|fantasy|magic/i,
  'sci-fi': /科幻|星际|太空|赛博|机器人|sci[ -]?fi|cyberpunk/i,
  'infinite-flow': /无限流|副本|轮回空间|主神|闯关|instance world/i,
  supernatural: /鬼怪|灵异|规则怪谈|诡异|幽灵|闹鬼|supernatural|haunt|ghost/i,
  apocalypse: /末日|灾变|丧尸|废土|apocalypse|zombie|wasteland/i,
};

function flattenText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenText).join('\n');
  if (typeof value === 'object') return Object.values(value).map(flattenText).join('\n');
  return String(value);
}

export function detectGenreHints(card = {}, messages = []) {
  const text = `${flattenText(card)}\n${flattenText(messages)}`;
  return Object.entries(GENRE_PATTERNS)
    .filter(([, pattern]) => pattern.test(text))
    .map(([genre]) => genre);
}

export function resolveGenre(genreSettings = {}, card = {}, messages = []) {
  if (genreSettings.mode === 'custom') {
    return { mode: 'custom', custom: genreSettings.custom ?? '', hints: [] };
  }
  if (genreSettings.mode && genreSettings.mode !== 'auto') {
    return { mode: genreSettings.mode, custom: '', hints: [genreSettings.mode] };
  }
  const hints = detectGenreHints(card, messages);
  return { mode: 'auto', custom: '', hints: hints.length ? hints : ['reality'] };
}
