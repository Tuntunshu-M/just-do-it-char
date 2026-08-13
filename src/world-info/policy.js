export function applyWorldSelectionPolicy(settings, previousChatKey, nextChatKey) {
  if (!previousChatKey || !nextChatKey || previousChatKey === nextChatKey) return false;
  if (settings?.context?.worldInfoSelectionPolicy !== 'clear-on-chat-change') return false;
  settings.context.worldInfoBooks = {};
  return true;
}
