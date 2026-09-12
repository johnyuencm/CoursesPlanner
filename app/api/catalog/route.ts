import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { readCatalog, validateCatalog } from "@/lib/catalog";
import { refreshCatalog } from "@/scraper/refresh";
import type { Catalog } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let activeRefresh: Promise<Catalog> | null = null;
let lastRefreshStartedAt = 0;
const REFRESH_COOLDOWN_MS = 30_000;
const SERVICE_URL = process.env.CATALOG_SERVICE_URL ?? "http://127.0.0.1:8787";
const CATALOG_ID = process.env.CATALOG_ID ?? "neu-mscs-seattle";

function errorResponse(error: unknown, status = 500) {
  const message =
    status < 500 && error instanceof Error ? error.message : "Catalog operation failed.";
  return NextResponse.json({ error: message }, { status });
}

function isCrossSite(request: NextRequest): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== request.nextUrl.origin;
  } catch {
    return true;
  }
}

function tokenMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

function isRefreshAuthorized(request: NextRequest): boolean {
  const expected = process.env.CATALOG_REFRESH_TOKEN;
  if (expected) return tokenMatches(request.headers.get("x-catalog-refresh-token"), expected);
  return process.env.NODE_ENV === "development";
}

function isServiceUnreachable(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (error instanceof Error && error.name === "AbortError") return false;
  if (typeof error === "object" && error !== null && "cause" in error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code === "ECONNREFUSED" || cause?.code === "ECONNRESET" || cause?.code === "ENOTFOUND" || cause?.code === "EHOSTUNREACH";
  }
  return false;
}

async function refreshViaService(): Promise<Catalog> {
  const response = await fetch(`${SERVICE_URL}/catalogs/${encodeURIComponent(CATALOG_ID)}/refresh`, {
    method: "POST",
    cache: "no-store",
  });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : `Catalog service refresh failed (${response.status})`;
    throw new Error(message);
  }
  validateCatalog(data);
  return data;
}

async function refreshCatalogSnapshot(): Promise<Catalog> {
  try {
    return await refreshViaService();
  } catch (error) {
    if (!isServiceUnreachable(error)) throw error;
    return refreshCatalog({ force: true });
  }
}

export async function GET() {
  try {
    return NextResponse.json(readCatalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, 503);
  }
}

export async function POST(request: NextRequest) {
  if (isCrossSite(request)) return errorResponse(new Error("Cross-site catalog refresh refused."), 403);
  if (!isRefreshAuthorized(request)) {
    return errorResponse(new Error("Catalog refresh is not authorized."), 401);
  }
  // Browser fetch POST always has a ReadableStream body; reject only non-empty payloads.
  const payload = await request.arrayBuffer();
  if (payload.byteLength > 0) {
    return errorResponse(new Error("Catalog refresh does not accept a request body."), 400);
  }

  const now = Date.now();
  try {
    if (!activeRefresh && now - lastRefreshStartedAt < REFRESH_COOLDOWN_MS) {
      return NextResponse.json(readCatalog(), {
        headers: { "Cache-Control": "no-store", "X-Catalog-Refresh": "cooldown" },
      });
    }
    if (!activeRefresh) {
      lastRefreshStartedAt = now;
      activeRefresh = refreshCatalogSnapshot().finally(() => {
        activeRefresh = null;
      });
    }
    const catalog = await activeRefresh;
    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "no-store", "X-Catalog-Refresh": "updated" },
    });
  } catch (error) {
    return errorResponse(error, 502);
  }
}
