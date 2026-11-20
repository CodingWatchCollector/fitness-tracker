export function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
  document.dispatchEvent(new Event('visibilitychange'));
}

export function resetVisibility(): void {
  Reflect.deleteProperty(document, 'visibilityState');
  Reflect.deleteProperty(document, 'hidden');
}
