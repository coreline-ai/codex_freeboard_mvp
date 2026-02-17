"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/client-api";
import type { Report } from "@/types/domain";

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default function AdminReportsPage() {
  const { loading, profile } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "rejected">("open");
  const [error, setError] = useState<string | null>(null);

  const loadReports = async (status: "open" | "resolved" | "rejected") => {
    const response = await apiFetch<Report[]>(`/api/admin/reports?status=${status}`);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setReports(response.data);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReports(statusFilter);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyStatus = async (next: "open" | "resolved" | "rejected") => {
    setStatusFilter(next);
    await loadReports(next);
  };

  const resolveReport = async (reportId: string, status: "resolved" | "rejected") => {
    const response = await apiFetch(`/api/admin/reports`, {
      method: "PATCH",
      body: JSON.stringify({ report_id: reportId, status }),
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    await loadReports(statusFilter);
  };

  const moderateTarget = async (report: Report, status: "hidden" | "deleted" | "published") => {
    if (report.target_type === "post") {
      const response = await apiFetch(`/api/admin/moderation/posts/${report.target_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: "report_moderation" }),
      });

      if (!response.ok) {
        setError(response.error.message);
        return;
      }
    } else {
      const response = await apiFetch(`/api/admin/moderation/comments/${report.target_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason: "report_moderation" }),
      });

      if (!response.ok) {
        setError(response.error.message);
        return;
      }
    }

    await loadReports(statusFilter);
  };

  if (loading) {
    return <div className="card">로딩 중...</div>;
  }

  if (!profile || profile.role !== "admin") {
    return <div className="error">관리자 권한이 필요합니다.</div>;
  }

  return (
    <div className="page-shell">
      <section className="hero-panel stack">
        <h1 className="page-title">신고 관리</h1>
        <p className="page-description">신고 상태 필터링 후 즉시 모더레이션/해결 처리를 진행합니다.</p>

        <div className="row">
          <button
            type="button"
            className={`button ${statusFilter === "open" ? "active" : ""}`}
            onClick={() => void applyStatus("open")}
          >
            open
          </button>
          <button
            type="button"
            className={`button ${statusFilter === "resolved" ? "active" : ""}`}
            onClick={() => void applyStatus("resolved")}
          >
            resolved
          </button>
          <button
            type="button"
            className={`button ${statusFilter === "rejected" ? "active" : ""}`}
            onClick={() => void applyStatus("rejected")}
          >
            rejected
          </button>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="card stack">
        <div className="panel-header">
          <h2 className="panel-title">신고 목록</h2>
          <span className="muted">{reports.length}건</span>
        </div>

        {reports.length === 0 ? <div className="empty-state">해당 상태의 신고가 없습니다.</div> : null}

        <div className="list">
          {reports.map((report) => (
            <article key={report.id} className="list-item">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="row">
                  <span className="badge">{report.target_type}</span>
                  <strong>{report.target_id}</strong>
                </div>
                <span className="muted">{formatDate(report.created_at)}</span>
              </div>

              <div>{report.reason}</div>

              <div className="row">
                <button type="button" onClick={() => void moderateTarget(report, "hidden")}>
                  숨김
                </button>
                <button className="danger" type="button" onClick={() => void moderateTarget(report, "deleted")}>
                  삭제
                </button>
                <button type="button" onClick={() => void resolveReport(report.id, "resolved")}>
                  해결 처리
                </button>
                <button type="button" onClick={() => void resolveReport(report.id, "rejected")}>
                  반려
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
