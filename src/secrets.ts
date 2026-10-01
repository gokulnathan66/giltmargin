const STORAGE_PREFIX = "giltmargin.cursorKey.v1";

export function apiKeyStorageKey(vaultId: string): string {
  return `${STORAGE_PREFIX}.${vaultId || "default"}`;
}

export function readApiKey(storage: Storage, vaultId: string): string {
  return storage.getItem(apiKeyStorageKey(vaultId)) ?? "";
}

export function writeApiKey(storage: Storage, vaultId: string, apiKey: string): void {
  const key = apiKeyStorageKey(vaultId);
  if (!apiKey) {
    storage.removeItem(key);
    return;
  }
  storage.setItem(key, apiKey);
}
