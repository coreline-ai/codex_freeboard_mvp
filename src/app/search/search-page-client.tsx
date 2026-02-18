"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { publicApiFetch } from "@/lib/client-api";
import type { SearchResponseData } from "@/types/domain";

function makePageList(current: number, total: number) {
  const start = Math.max(1, current - 2);
  const end = Math.min(total, start + 4);
  const fixedStart = Math.max(1, end - 4);
  const pages: number[] = [];
  for (let i = fixedStart; i <= end; i += 1) {
    pages.push(i);
  }
  return pages;
}

export default function SearchPageClient() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeQ = (searchParams.get("q") ?? "").trim();
  const page = Math.max(Number(searchParams.get("page") ?? 1) || 1, 1);

  const [input, setInput] = useState(activeQ);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchResponseData | null>(null);

  useEffect(() => {
    setInput(activeQ);
  }, [activeQ]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!activeQ) {
        setResult(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      const payload = await publicApiFetch<SearchResponseData>(
        `/api/search?q=${encodeURIComponent(activeQ)}&page=${page}`,
        {
          cache: "no-store",
        },
      );

      if (!mounted) {
        return;
      }

      if (!payload.ok) {
        setError(payload.error?.message ?? "검색 결과를 불러오지 못했습니다.");
        setResult(null);
        setLoading(false);
        return;
      }

      setError(null);
      setResult(payload.data);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [activeQ, page]);

  const totalPages = useMemo(() => {
    if (!result) {
      return 1;
    }
    return Math.max(Math.ceil(result.total / result.pageSize), 1);
  }, [result]);

  const pageList = makePageList(page, totalPages);

  const pushSearch = (q: string, nextPage = 1) => {
    const query = new URLSearchParams({ q, page: String(nextPage) });
    router.push(`/search?${query.toString()}`);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError("검색어를 입력해 주세요.");
      return;
    }
    pushSearch(trimmed, 1);
  };

  return (
    <div className="page-shell">
      <section className="hero-panel stack">
        <h1 className="page-title">통합 검색</h1>
        <p className="page-description">공개 게시판의 게시글을 한 번에 검색합니다.</p>

        <form className="toolbar-form search-page-form" onSubmit={onSubmit}>
          <input
            className="search-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="검색어를 입력하세요"
          />
          <button type="submit" className="primary">
            검색
          </button>
        </form>
      </section>

      {error ? <div className="error">{error}</div> : null}

      {!activeQ ? <div className="empty-state">검색어를 입력하면 통합 검색 결과가 표시됩니다.</div> : null}

      {loading ? <div className="empty-state">검색 중입니다...</div> : null}

      {result ? (
        <section className="card stack">
          <div className="panel-header">
            <h2 className="panel-title">검색 결과</h2>
            <span className="muted">
              &quot;{result.query}&quot; · {result.total}건
            </span>
          </div>

          {result.results.length === 0 ? <div className="empty-state">검색 결과가 없습니다.</div> : null}

          <div className="list search-results-list">
            {result.results.map((item) => (
              <Link key={item.post_id} href={`/p/${item.post_id}`} className="list-item search-result-item">
                <div className="row search-result-title-row">
                  <strong>{item.title}</strong>
                  <span className="muted search-rank">score {item.rank.toFixed(3)}</span>
                </div>
                <div className="muted search-excerpt">{item.excerpt || "요약이 없습니다."}</div>
                <div className="row search-result-meta-row">
                  <div className="row">
                    <span className="badge">{item.board_name}</span>
                    <span className="muted">/{item.board_slug}</span>
                    <span className="muted">{item.author_nickname}</span>
                  </div>
                  <div className="row">
                    {profile?.role === "admin" ? (
                      <span className={`badge ${item.status === "published" ? "success" : "danger"}`}>{item.status}</span>
                    ) : null}
                    <span className="muted">{new Date(item.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="pagination">
              <button type="button" onClick={() => pushSearch(activeQ, page - 1)} disabled={page <= 1}>
                이전
              </button>
              {pageList.map((targetPage) => (
                <button
                  key={targetPage}
                  type="button"
                  className={`button ${targetPage === page ? "active" : ""}`}
                  onClick={() => pushSearch(activeQ, targetPage)}
                >
                  {targetPage}
                </button>
              ))}
              <button type="button" onClick={() => pushSearch(activeQ, page + 1)} disabled={page >= totalPages}>
                다음
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
