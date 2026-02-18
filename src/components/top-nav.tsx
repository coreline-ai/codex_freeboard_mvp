"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function TopNav() {
  const { loading, profile, signOut } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState("");

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const params = new URLSearchParams({ q: trimmed, page: "1" });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <header className="top-nav">
      <div className="container top-nav-inner">
        <Link href="/" className="brand">
          FreeBoard
        </Link>

        <nav className="nav-links top-nav-menu" aria-label="주요 메뉴">
          <Link href="/" className="nav-link">
            홈
          </Link>
          <Link href="/b/freeboard" className="nav-link">
            테크 뉴스
          </Link>
          <Link href="/b/ai-freeboard" className="nav-link">
            AI 게시판
          </Link>
          {profile?.role === "admin" ? (
            <Link href="/admin" className="nav-link nav-link-admin">
              관리자
            </Link>
          ) : null}
        </nav>

        <div className="top-nav-actions">
          <form className="top-search-form" onSubmit={handleSearchSubmit}>
            <input
              className="top-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="통합 검색"
            />
            <button type="submit">검색</button>
          </form>

          <div className="auth-actions">
            {loading ? (
              <span>로딩중...</span>
            ) : profile ? (
              <>
                <span>
                  {profile.nickname} ({profile.role})
                </span>
                <button type="button" onClick={() => void signOut()}>
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link className="button" href="/login">
                  로그인
                </Link>
                <Link className="button primary" href="/signup">
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
