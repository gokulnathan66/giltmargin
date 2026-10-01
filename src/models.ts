export interface GiltmarginSettings {
  model: string;
  includeActiveNote: boolean;
  noteCharLimit: number;
  searchVault: boolean;
  maxRelatedNotes: number;
  relatedNotesCharLimit: number;
  excludedFolders: string;
}

export const DEFAULT_SETTINGS: GiltmarginSettings = {
  model: "",
  includeActiveNote: true,
  noteCharLimit: 20000,
  searchVault: true,
  maxRelatedNotes: 5,
  relatedNotesCharLimit: 30000,
  excludedFolders: ".trash",
};
