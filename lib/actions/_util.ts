export type FormState = { error?: string; ok?: boolean };

// Read a trimmed string from a form, or null if empty.
export function fstr(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const t = String(v).trim();
  return t === "" ? null : t;
}

// Read a number from a form, or null if empty/invalid.
export function fnum(fd: FormData, key: string): number | null {
  const t = fstr(fd, key);
  if (t == null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Today's date as YYYY-MM-DD.
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
