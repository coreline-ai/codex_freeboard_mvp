"use client";

import { useEffect } from "react";
import type { Metric } from "web-vitals";

const WEB_VITALS_ENDPOINT = "/api/metrics/web-vitals";

function reportMetric(metric: Metric) {
  const payload = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: metric.navigationType,
    ts: Date.now(),
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(WEB_VITALS_ENDPOINT, blob);
    return;
  }

  void fetch(WEB_VITALS_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

export function WebVitalsReporter() {
  useEffect(() => {
    let active = true;

    void import("web-vitals")
      .then(({ onCLS, onINP, onLCP }) => {
        if (!active) {
          return;
        }

        onCLS(reportMetric);
        onINP(reportMetric);
        onLCP(reportMetric);
      })
      .catch(() => {
        // no-op
      });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
