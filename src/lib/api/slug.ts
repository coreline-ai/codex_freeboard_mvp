export function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function generateUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
) {
  const root = toSlug(base);
  if (!root) {
    throw new Error("Invalid slug base");
  }

  if (!(await exists(root))) {
    return root;
  }

  let i = 2;
  while (i < 10000) {
    const candidate = `${root}-${i}`;
    if (!(await exists(candidate))) {
      return candidate;
    }
    i += 1;
  }

  throw new Error("Unable to generate unique slug");
}
