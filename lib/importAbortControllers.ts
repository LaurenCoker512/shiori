const controllers = new Map<number, AbortController>();

export function registerImportAbort(textId: number, controller: AbortController): void {
  controllers.set(textId, controller);
}

export function abortImport(textId: number): void {
  controllers.get(textId)?.abort();
  controllers.delete(textId);
}

export function unregisterImportAbort(textId: number): void {
  controllers.delete(textId);
}
