export interface VaultNote {
  path: string;
  content: string;
}

export interface ContextOptions {
  activePath?: string;
  maxNotes: number;
  maxTotalChars: number;
}

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "answer",
  "from",
  "have",
  "into",
  "notes",
  "that",
  "the",
  "this",
  "what",
  "when",
  "where",
  "which",
  "with",
]);

function normalizeFolder(path: string): string {
  return path.trim().replace(/^\/+|\/+$/g, "");
}

export function isAllowedVaultPath(path: string, excludedFolders: string[]): boolean {
  if (path === ".obsidian" || path.startsWith(".obsidian/")) return false;
  return !excludedFolders
    .map(normalizeFolder)
    .filter(Boolean)
    .some((folder) => path === folder || path.startsWith(`${folder}/`));
}

function terms(text: string): string[] {
  return [...new Set(
    text
      .toLocaleLowerCase()
      .split(/[^\p{L}\p{N}_-]+/u)
      .filter((term) => term.length >= 3 && !STOP_WORDS.has(term)),
  )];
}

function occurrences(text: string, term: string): number {
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(term, offset)) !== -1) {
    count += 1;
    offset += term.length;
  }
  return count;
}

export function selectRelevantNotes(
  question: string,
  notes: VaultNote[],
  options: ContextOptions,
): VaultNote[] {
  const queryTerms = terms(question);
  if (queryTerms.length === 0) return [];

  const ranked = notes
    .filter((note) => note.path !== options.activePath)
    .map((note) => {
      const path = note.path.toLocaleLowerCase();
      const content = note.content.toLocaleLowerCase();
      const score = queryTerms.reduce(
        (total, term) =>
          total + occurrences(path, term) * 8 + Math.min(occurrences(content, term), 6),
        0,
      );
      return { note, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.note.path.localeCompare(b.note.path));

  const selected: VaultNote[] = [];
  let usedChars = 0;
  for (const { note } of ranked) {
    if (selected.length >= options.maxNotes || usedChars >= options.maxTotalChars) break;
    const remaining = options.maxTotalChars - usedChars;
    if (remaining <= 0) break;
    const content = note.content.slice(0, remaining);
    selected.push({ path: note.path, content });
    usedChars += content.length;
  }
  return selected;
}
