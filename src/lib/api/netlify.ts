import { createHash } from "node:crypto";

export function getRequestIp(headers: Headers) {
  const netlifyIp = headers.get("x-nf-client-connection-ip");
  if (netlifyIp) {
    return netlifyIp;
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }

  return "unknown";
}

export function hashActorKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
