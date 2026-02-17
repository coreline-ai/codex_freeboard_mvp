"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export default function AdminHomePage() {
  const { loading, profile } = useAuth();

  if (loading) {
    return <div className="card">로딩 중...</div>;
  }

  if (!profile || profile.role !== "admin") {
    return <div className="error">관리자 권한이 필요합니다.</div>;
  }

  return (
    <div className="page-shell">
      <section className="hero-panel stack">
        <h1 className="page-title">관리자 대시보드</h1>
        <p className="page-description">
          게시판 운영, 사용자 권한/정지 관리, 신고 처리 흐름을 한 곳에서 빠르게 처리할 수 있습니다.
        </p>
      </section>

      <section className="grid-2">
        <Link className="card stack" href="/admin/boards">
          <h2 className="panel-title">게시판 관리</h2>
          <p className="muted">신규 생성, 템플릿 복제, 게시 설정 점검</p>
          <span className="button primary" style={{ width: "fit-content" }}>
            이동
          </span>
        </Link>

        <Link className="card stack" href="/admin/users">
          <h2 className="panel-title">유저 관리</h2>
          <p className="muted">권한 변경, 정지/복구, 활동 이력 확인</p>
          <span className="button" style={{ width: "fit-content" }}>
            이동
          </span>
        </Link>

        <Link className="card stack" href="/admin/reports">
          <h2 className="panel-title">신고 관리</h2>
          <p className="muted">신고 건 검토, 숨김/삭제, 해결/반려 처리</p>
          <span className="button" style={{ width: "fit-content" }}>
            이동
          </span>
        </Link>
      </section>
    </div>
  );
}
