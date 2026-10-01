const API_KEY_ID = "giltmargin-cursor-api-key";

export interface SecretStore {
  getSecret(id: string): string | null;
  setSecret(id: string, value: string): void;
}

export interface LegacyStorage {
  getItem(id: string): string | null;
  removeItem(id: string): void;
}

export function readApiKey(secrets: SecretStore): string {
  return secrets.getSecret(API_KEY_ID) ?? "";
}

export function writeApiKey(secrets: SecretStore, apiKey: string): void {
  secrets.setSecret(API_KEY_ID, apiKey);
}

export function migrateLegacyApiKey(
  secrets: SecretStore,
  storage: LegacyStorage,
  vaultId: string,
): void {
  if (readApiKey(secrets)) return;
  const legacyId = `giltmargin.cursorKey.v1.${vaultId || "default"}`;
  const legacyKey = storage.getItem(legacyId);
  if (!legacyKey) return;
  writeApiKey(secrets, legacyKey);
  storage.removeItem(legacyId);
}
