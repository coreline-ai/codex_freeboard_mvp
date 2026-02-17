import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Board } from "@/types/domain";

interface HomePost {
  id: string;
  title: string;
  created_at: string;
  author_nickname: string;
  comment_count?: number;
  like_count?: number;
}

export default async function HomePage() {
  const admin = getSupabaseAdminClient();

  let boards: Board[] = [];
  let latestPosts: HomePost[] = [];
  let error: string | null = null;

  const { data: boardRows, error: boardsError } = await admin
    .from("boards")
    .select("*")
    .eq("is_public", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (boardsError) {
    error = "게시판 목록을 불러오지 못했습니다.";
  } else {
    boards = (boardRows ?? []) as Board[];
  }

  const { data: freeboard } = await admin
    .from("boards")
    .select("id")
    .eq("slug", "freeboard")
    .eq("is_public", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (freeboard?.id) {
    const { data: posts, error: postsError } = await admin
      .from("posts")
      .select("id,title,created_at,author_id,comment_count,like_count")
      .eq("board_id", freeboard.id)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!postsError) {
      const authorIds = [...new Set((posts ?? []).map((post) => post.author_id))];
      const { data: profiles } = authorIds.length
        ? await admin.from("profiles").select("id,nickname").in("id", authorIds)
        : { data: [] as Array<{ id: string; nickname: string }> };

      const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile.nickname]));

      latestPosts = (posts ?? []).map((post) => ({
        id: post.id,
        title: post.title,
        created_at: post.created_at,
        comment_count: post.comment_count,
        like_count: post.like_count,
        author_nickname: profileMap.get(post.author_id) ?? "unknown",
      }));
    } else if (!error) {
      error = "최신 글을 불러오지 못했습니다.";
    }
  }

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

          {boards.length === 0 ? <div className="empty-state">생성된 게시판이 없습니다.</div> : null}

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

          {latestPosts.length === 0 ? <div className="empty-state">최신 글이 없습니다.</div> : null}

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
