export interface RobotsRules {
  fetchedAt: string;
  disallowed: string[];
}

export function parseRobots(text: string): string[] {
  const disallowed: string[] = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [field, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(field)) {
      applies = value === "*";
      continue;
    }
    if (applies && /^disallow$/i.test(field) && value) disallowed.push(value);
  }
  return disallowed;
}

export function pathDisallowed(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => prefix !== "" && pathname.startsWith(prefix));
}
