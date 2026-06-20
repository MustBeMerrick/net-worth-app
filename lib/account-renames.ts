// Historical institution renames, keyed by account ID.
// `before` is exclusive: the rename applies for years strictly less than `before`.
const RENAMES: Record<string, { institution: string; before: number }[]> = {
  "lpl-individual": [{ institution: "Kestra", before: 2026 }],
  "hsa": [{ institution: "WEX", before: 2026 }],
};

export function institutionAtYear(accountId: string, institution: string, year: number): string {
  const renames = RENAMES[accountId];
  if (!renames) return institution;
  return renames.find((r) => year < r.before)?.institution ?? institution;
}
