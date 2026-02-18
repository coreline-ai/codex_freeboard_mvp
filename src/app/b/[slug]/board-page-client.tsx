"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { publicApiFetch } from "@/lib/client-api";
import styles from "./board-page.module.css";

interface BoardPostsResponse {
  board: {
    slug: string;
    name: string;
    description: string;
  };
  posts: Array<{
    id: string;
    title: string;
    content: string;
    created_at: string;
    author_nickname: string;
    like_count: number;
    comment_count: number;
    is_notice: boolean;
    is_pinned: boolean;
  }>;
  page: number;
  pageSize: number;
  total: number;
}

type PostFilter = "all" | "notice" | "general";

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

function excerpt(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 130);
}

export default function BoardPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useAuth();

  const slug = params.slug;
  const activeQ = (searchParams.get("q") ?? "").trim();

  const [result, setResult] = useState<BoardPostsResponse | null>(null);
  const [queryInput, setQueryInput] = useState(activeQ);
  const [filter, setFilter] = useState<PostFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = useMemo(() => {
    const parsed = Number(searchParams.get("page") ?? 1);
    return parsed > 0 ? parsed : 1;
  }, [searchParams]);

  useEffect(() => {
    setQueryInput(activeQ);
  }, [activeQ]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      const query = new URLSearchParams({ page: String(page) });
      if (activeQ) {
        query.set("q", activeQ);
      }

      const payload = await publicApiFetch<BoardPostsResponse>(`/api/boards/${slug}/posts?${query.toString()}`, {
        cache: "no-store",
      });

      if (!mounted) {
        return;
      }

      if (!payload.ok) {
        setError(payload.error?.message ?? "게시글을 불러오지 못했습니다.");
        setResult(null);
        setLoading(false);
        return;
      }

      setError(null);
      setResult(payload.data);
      setLoading(false);
    }

    if (slug) {
      void load();
    }

    return () => {
      mounted = false;
    };
  }, [slug, page, activeQ]);

  const visiblePosts = useMemo(() => {
    const posts = result?.posts ?? [];
    if (filter === "notice") {
      return posts.filter((post) => post.is_notice || post.is_pinned);
    }
    if (filter === "general") {
      return posts.filter((post) => !post.is_notice && !post.is_pinned);
    }
    return posts;
  }, [result, filter]);

  const totalPages = result ? Math.max(Math.ceil(result.total / result.pageSize), 1) : 1;
  const pageList = makePageList(page, totalPages);

  const noticeCount = (result?.posts ?? []).filter((post) => post.is_notice || post.is_pinned).length;
  const generalCount = (result?.posts ?? []).filter((post) => !post.is_notice && !post.is_pinned).length;

  const pushPage = (nextPage: number) => {
    const query = new URLSearchParams({ page: String(nextPage) });
    if (activeQ) {
      query.set("q", activeQ);
    }
    router.push(`/b/${slug}?${query.toString()}`);
  };

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = new URLSearchParams({ page: "1" });
    if (queryInput.trim()) {
      query.set("q", queryInput.trim());
    }
    router.push(`/b/${slug}?${query.toString()}`);
  };

  return (
    <div className={styles.boardDetailShell}>
      <header className={styles.boardDetailHero}>
        <div className={styles.boardDetailBread}>
          <Link href="/">Discussions</Link>
          <span>/</span>
          <strong>{result?.board.name ?? slug}</strong>
        </div>

        <h1>{result?.board.name ?? slug}</h1>
        <p>{result?.board.description ?? "게시판"}</p>

        <div className={styles.boardDetailToolbar}>
          <form className={styles.boardDetailSearchForm} onSubmit={onSearch}>
            <input
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder="제목/본문 검색"
              aria-label="검색"
            />
            <button type="submit">검색</button>
          </form>

          <div className={styles.boardDetailControlRow}>
            <select value={filter} onChange={(event) => setFilter(event.target.value as PostFilter)}>
              <option value="all">전체 글</option>
              <option value="notice">공지/고정</option>
              <option value="general">일반 글</option>
            </select>

            {profile ? (
              <Link href={`/b/${slug}/write`} className={styles.boardDetailPrimaryButton}>
                글쓰기
              </Link>
            ) : (
              <Link href="/login" className={styles.boardDetailGhostButton}>
                로그인 후 글쓰기
              </Link>
            )}
          </div>
        </div>
      </header>

      {error ? <div className={styles.boardDetailError}>{error}</div> : null}

      <div className={styles.boardDetailGrid}>
        <section className={styles.boardDetailListPanel}>
          <div className={styles.boardDetailListHeader}>
            <h2>게시글 목록</h2>
            <span>
              page {page} / {totalPages}
            </span>
          </div>

          {loading ? <div className={styles.boardDetailEmpty}>게시글을 불러오는 중입니다...</div> : null}

          {!loading && visiblePosts.length === 0 ? (
            <div className={styles.boardDetailEmpty}>조건에 맞는 게시글이 없습니다.</div>
          ) : null}

          <div className={styles.boardDetailPostList}>
            {visiblePosts.map((post) => (
              <Link href={`/p/${post.id}`} key={post.id} className={styles.boardDetailPostCard}>
                <div className={styles.boardDetailPostTop}>
                  <div className={styles.boardDetailTagRow}>
                    {post.is_notice ? <span className={`${styles.boardDetailTag} ${styles.boardDetailTagNotice}`}>공지</span> : null}
                    {post.is_pinned ? <span className={`${styles.boardDetailTag} ${styles.boardDetailTagPinned}`}>고정</span> : null}
                    <strong>{post.title}</strong>
                  </div>
                  <span>{new Date(post.created_at).toLocaleString()}</span>
                </div>

                <p>{excerpt(post.content)}</p>

                <div className={styles.boardDetailPostMeta}>
                  <span>{post.author_nickname}</span>
                  <span>댓글 {post.comment_count}</span>
                  <span>좋아요 {post.like_count}</span>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className={styles.boardDetailPagination}>
              <button type="button" onClick={() => pushPage(page - 1)} disabled={page <= 1}>
                이전
              </button>
              {pageList.map((targetPage) => (
                <button
                  type="button"
                  key={targetPage}
                  className={targetPage === page ? styles.boardDetailPageActive : ""}
                  onClick={() => pushPage(targetPage)}
                >
                  {targetPage}
                </button>
              ))}
              <button type="button" onClick={() => pushPage(page + 1)} disabled={page >= totalPages}>
                다음
              </button>
            </div>
          ) : null}
        </section>

        <aside className={styles.boardDetailSidePanel}>
          <section className={styles.boardDetailSideCard}>
            <h3>Board Stats</h3>
            <dl>
              <div>
                <dt>Total</dt>
                <dd>{result?.total ?? 0}</dd>
              </div>
              <div>
                <dt>Notice</dt>
                <dd>{noticeCount}</dd>
              </div>
              <div>
                <dt>General</dt>
                <dd>{generalCount}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.boardDetailSideCard}>
            <h3>Quick Actions</h3>
            <div className={styles.boardDetailSideActions}>
              {profile ? (
                <Link href={`/b/${slug}/write`} className={styles.boardDetailPrimaryButton}>
                  새 글 작성
                </Link>
              ) : (
                <Link href="/login" className={styles.boardDetailGhostButton}>
                  로그인
                </Link>
              )}
              <Link href="/search?page=1" className={styles.boardDetailGhostButton}>
                통합 검색
              </Link>
            </div>
          </section>

          <section className={styles.boardDetailSideCard}>
            <h3>Current Filter</h3>
            <p>{filter === "all" ? "전체 게시글" : filter === "notice" ? "공지/고정" : "일반 게시글"}</p>
            <p>{activeQ ? `검색어: ${activeQ}` : "검색어 없음"}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
