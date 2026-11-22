// Static 404 for an unknown program or course path (#110). Rendering `global-not-found` through vinext
// cost p50 7 ms CPU, over the 6 ms target; this string costs almost nothing. Keep the text equal to app/global-not-found.tsx.
const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found · Course Map</title><meta name="robots" content="noindex"><link rel="icon" href="/icon.svg" type="image/svg+xml"></head><body><main style="max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>Page not found</h1><p>This page does not exist in the course map.</p><p><a href="/">Pick a college and program</a></p></main></body></html>`;

export function unknownPageResponse(): Response {
  return new Response(HTML, { status: 404, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
