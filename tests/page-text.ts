// What a person reads on a rendered page. The planner (#126) and Paths (#138) tests share it.

/** MSCS Boston: a roadmap with no modeled degree rules, so Map tier. */
export const MAP_KEY = "northeastern/computer-science-mscs-976b977119";

/**
 * Markup as plain text: the text nodes, then the attributes that a browser shows or a screen reader reads,
 * then `more` (such as the page description). Class names are not text.
 */
export function pageText(html: string, ...more: (string | null | undefined)[]): string {
  const attributes = [...html.matchAll(/\s(?:aria-(?:label|description|valuetext)|title|alt|placeholder)="([^"]*)"/g)].map((match) => match[1]);
  return `${html.replace(/<[^>]+>/g, " ")} ${attributes.join(" ")} ${more.join(" ")}`.replace(/\s+/g, " ");
}
