"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ApiFailure = { ok: false; error: { message: string; details?: unknown } };
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export async function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function parseApiResult<T>(response: Response): Promise<ApiResult<T>> {
  const bodyText = await response.text();
  let parsed: unknown = null;

  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText) as unknown;
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === "object" && "ok" in parsed) {
    const payload = parsed as Partial<ApiResult<T>> & {
      error?: { message?: string; details?: unknown };
    };

    if (payload.ok === true) {
      return payload as ApiSuccess<T>;
    }

    return {
      ok: false,
      error: {
        message: payload.error?.message ?? `HTTP ${response.status}`,
        details: payload.error?.details,
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        message: `HTTP ${response.status}`,
        details: bodyText || undefined,
      },
    };
  }

  return {
    ok: true,
    data: (parsed ?? null) as T,
  };
}

async function requestApi<T>(input: string, init?: RequestInit, options?: { auth?: boolean }): Promise<ApiResult<T>> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }

  if (options?.auth !== false) {
    const token = await getAccessToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers,
    });
  } catch (error) {
    return {
      ok: false,
      error: {
        message: "Network request failed",
        details: error instanceof Error ? error.message : error,
      },
    };
  }

  return parseApiResult<T>(response);
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  return requestApi<T>(input, init, { auth: true });
}

export async function publicApiFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  return requestApi<T>(input, init, { auth: false });
}
