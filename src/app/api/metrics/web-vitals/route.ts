import { fail, ok } from "@/lib/api/response";

const ALLOWED_NAMES = new Set(["CLS", "INP", "LCP"]);

interface WebVitalsPayload {
  id?: unknown;
  name?: unknown;
  value?: unknown;
  rating?: unknown;
  delta?: unknown;
  navigationType?: unknown;
  ts?: unknown;
}

function isFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

export async function POST(request: Request) {
  let payload: WebVitalsPayload;
  try {
    payload = (await request.json()) as WebVitalsPayload;
  } catch {
    return fail(400, "Invalid JSON body");
  }

  const name = typeof payload.name === "string" ? payload.name : null;
  if (!name || !ALLOWED_NAMES.has(name)) {
    return fail(400, "Invalid metric name");
  }

  if (!isFiniteNumber(payload.value) || !isFiniteNumber(payload.delta)) {
    return fail(400, "Invalid metric value");
  }

  console.info("[web-vitals]", {
    id: payload.id,
    name,
    value: payload.value,
    delta: payload.delta,
    rating: payload.rating,
    navigationType: payload.navigationType,
    ts: payload.ts,
  });

  return ok({ received: true });
}
