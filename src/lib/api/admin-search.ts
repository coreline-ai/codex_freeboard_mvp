const MAX_SEARCH_LENGTH = 100;

export function sanitizeAdminSearchTerm(raw: string | null | undefined) {
  if (!raw) {
    return "";
  }

  const collapsed = raw
    .trim()
    .slice(0, MAX_SEARCH_LENGTH)
    .replace(/[(),"'`;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!collapsed) {
    return "";
  }

  // Keep literal %/_ behavior and avoid wildcard amplification.
  return collapsed.replace(/[%_]/g, "\\$&");
}

export function buildAdminUserSearchFilter(raw: string | null | undefined) {
  const term = sanitizeAdminSearchTerm(raw);
  if (!term) {
    return null;
  }

  return `email.ilike.%${term}%,nickname.ilike.%${term}%`;
}
