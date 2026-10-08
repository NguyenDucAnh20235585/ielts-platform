/** `%text%` for ILIKE, with LIKE wildcards escaped so a search for "50%" matches literally. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
