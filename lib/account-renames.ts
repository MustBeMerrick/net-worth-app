// Historical institution renames, keyed by account ID.
// `before` is exclusive: the rename applies for years strictly less than `before`.
const RENAMES: Record<string, { institution: string; before: number }[]> = {
  "lpl-individual": [{ institution: "Kestra", before: 2026 }],
  "hsa": [{ institution: "WEX", before: 2026 }],
  // Cutler Group 401k (Paychex) rolled into Robinhood IRAs in March 2025.
  "robinhood-roth": [{ institution: "Paychex", before: 2025 }],
  "robinhood-ira": [{ institution: "Paychex", before: 2025 }],
};

export function institutionAtYear(accountId: string, institution: string, year: number): string {
  const renames = RENAMES[accountId];
  if (!renames) return institution;
  return renames.find((r) => year < r.before)?.institution ?? institution;
}

// The prior institution name for the transition year only (first year under the
// current name, right after a rename ended). Used as a small styled note beside
// the institution — e.g. Robinhood (Paychex) in 2025 — without affecting grouping.
export function formerInstitutionAtYear(accountId: string, year: number): string | undefined {
  return RENAMES[accountId]?.find((r) => r.before === year)?.institution;
}
