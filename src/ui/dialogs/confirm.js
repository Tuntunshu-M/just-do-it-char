export async function confirmAction(services, message) {
  return Boolean(await services.confirm?.(message));
}
