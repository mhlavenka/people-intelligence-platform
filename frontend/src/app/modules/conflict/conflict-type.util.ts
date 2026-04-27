/**
 * The divergence-aware AI prompt instructs Claude to emit conflict types as
 * "Label — rationale sentence." (em-dash with surrounding spaces). Older
 * analyses just have a label. This helper splits the string so the UI can
 * render the label compactly in chips/pills and surface the full rationale
 * only where there's room (sub-analysis cards).
 */
export interface ParsedConflictType {
  label: string;
  rationale: string;
}

const SPLIT_RE = /\s[—–-]\s/;

export function parseConflictType(raw: string): ParsedConflictType {
  if (!raw) return { label: '', rationale: '' };
  const idx = raw.search(SPLIT_RE);
  if (idx < 0) return { label: raw.trim(), rationale: '' };
  const matched = raw.match(SPLIT_RE)![0];
  return {
    label: raw.slice(0, idx).trim(),
    rationale: raw.slice(idx + matched.length).trim(),
  };
}

export function conflictTypeLabel(raw: string): string {
  return parseConflictType(raw).label;
}
