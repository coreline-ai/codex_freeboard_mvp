"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Board } from "@/types/domain";

interface HomePost {
  id: string;
  title: string;
  created_at: string;
  author_nickname: string;
  comment_count?: number;
  like_count?: number;
}

export default function HomePage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [latestPosts, setLatestPosts] = useState<HomePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const boardsRes = await fetch("/api/boards", { cache: "no-store" });
      const boardsPayload = await boardsRes.json();

      if (!boardsPayload.ok) {
        if (mounted) {
          setError(boardsPayload.error?.message ?? "게시판 목록을 불러오지 못했습니다.");
          setLoading(false);
        }
        return;
      }

      if (mounted) {
        setBoards(boardsPayload.data ?? []);
      }

      const feedRes = await fetch("/api/boards/freeboard/posts?page=1", { cache: "no-store" });
      const feedPayload = await feedRes.json();

      if (mounted) {
        if (feedPayload.ok) {
          setLatestPosts((feedPayload.data.posts ?? []).slice(0, 8));
          setError(null);
        } else {
          setError(feedPayload.error?.message ?? "최신 글을 불러오지 못했습니다.");
        }
        setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-shell">
      <section className="hero-panel stack">
        <h1 className="page-title">깔끔한 커뮤니티 게시판</h1>
        <p className="page-description">
          공개 보드에서 자유롭게 글을 작성하고, 관리자는 보드 생성/복제와 유저 운영까지 한 번에 처리할 수 있습니다.
        </p>
        <div className="row">
          <Link className="button primary" href="/b/freeboard">
            테크 뉴스 보드 보기
          </Link>
          <Link className="button" href="/b/ai-freeboard">
            AI 보드 보기
          </Link>
          <Link className="button ghost" href="/admin">
            관리자 대시보드
          </Link>
        </div>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="grid-2">
        <article className="card stack">
          <div className="panel-header">
            <h2 className="panel-title">게시판 목록</h2>
            <span className="muted">총 {boards.length}개</span>
          </div>

          {loading ? <div className="empty-state">게시판을 불러오는 중입니다...</div> : null}

          {!loading && boards.length === 0 ? <div className="empty-state">생성된 게시판이 없습니다.</div> : null}

          <div className="list">
            {boards.map((board) => (
              <Link key={board.id} href={`/b/${board.slug}`} className="list-item">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{board.name}</strong>
                  <span className="badge">/{board.slug}</span>
                </div>
                <div className="muted">{board.description || "설명이 없습니다."}</div>
              </Link>
            ))}
          </div>
        </article>

        <article className="card stack">
          <div className="panel-header">
            <h2 className="panel-title">최신 글</h2>
            <span className="muted">freeboard 기준</span>
          </div>

          {loading ? <div className="empty-state">최신 글을 불러오는 중입니다...</div> : null}

          {!loading && latestPosts.length === 0 ? <div className="empty-state">최신 글이 없습니다.</div> : null}

          <div className="list">
            {latestPosts.map((post) => (
              <Link key={post.id} href={`/p/${post.id}`} className="list-item">
                <strong>{post.title}</strong>
                <div className="muted">
                  {post.author_nickname} · {new Date(post.created_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
