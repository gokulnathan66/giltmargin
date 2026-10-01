export interface GiltmarginSettings {
  repoUrl: string;
  branch: string;
  model: string;
  includeActiveNote: boolean;
  noteCharLimit: number;
}

export const DEFAULT_SETTINGS: GiltmarginSettings = {
  repoUrl: "",
  branch: "main",
  model: "",
  includeActiveNote: true,
  noteCharLimit: 20000,
};
