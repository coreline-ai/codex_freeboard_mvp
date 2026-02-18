"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, publicApiFetch } from "@/lib/client-api";
import styles from "./post-detail-page.module.css";

type Reply = {
  id: string;
  content: string;
  author_nickname: string;
  author_id: string;
  created_at: string;
};

type CommentNode = {
  id: string;
  content: string;
  author_nickname: string;
  author_id: string;
  created_at: string;
  replies: Reply[];
};

type PostDetailResponse = {
  board: {
    id: string;
    slug: string;
    name: string;
  };
  post: {
    id: string;
    title: string;
    content: string;
    author_id: string;
    author_nickname: string;
    like_count: number;
    created_at: string;
  };
  comments: CommentNode[];
};

type BoardPostsResponse = {
  posts: Array<{
    id: string;
    title: string;
    created_at: string;
  }>;
};

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatRelative(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return "just now";
  }

  const diff = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diff < 60) {
    return `${diff}s ago`;
  }

  const min = Math.floor(diff / 60);
  if (min < 60) {
    return `${min}m ago`;
  }

  const hour = Math.floor(min / 60);
  if (hour < 24) {
    return `${hour}h ago`;
  }

  return `${Math.floor(hour / 24)}d ago`;
}

function avatarInitial(name: string) {
  const t = name.trim();
  return t ? t.slice(0, 2).toUpperCase() : "ME";
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeHeading(raw: string) {
  return raw
    .replace(/`/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/\*/g, "")
    .replace(/_/g, "")
    .replace(/~~/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .trim();
}

function makeHeadingId(text: string, seen: Map<string, number>) {
  const base = slugify(text) || "section";
  const idx = seen.get(base) ?? 0;
  seen.set(base, idx + 1);
  return idx === 0 ? base : `${base}-${idx + 1}`;
}

function extractToc(markdown: string): TocItem[] {
  const seen = new Map<string, number>();
  const items: TocItem[] = [];

  for (const line of markdown.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) {
      continue;
    }

    const level = m[1].length as 2 | 3;
    const text = normalizeHeading(m[2]);
    if (!text) {
      continue;
    }

    items.push({
      id: makeHeadingId(text, seen),
      text,
      level,
    });
  }

  return items;
}

function plainText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((entry) => plainText(entry)).join("");
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  if ("props" in node) {
    return plainText((node as { props?: { children?: ReactNode } }).props?.children);
  }

  return "";
}

type RailIconName = "home" | "search" | "board" | "trend" | "bookmark";

function RailIcon({ name }: { name: RailIconName }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (name === "home") {
    return (
      <svg {...common}>
        <path d="M3 11.5L12 4l9 7.5" />
        <path d="M5.5 10.5V20h13V10.5" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
    );
  }

  if (name === "board") {
    return (
      <svg {...common}>
        <path d="M4 6.5h16v9H9l-5 4v-13z" />
      </svg>
    );
  }

  if (name === "trend") {
    return (
      <svg {...common}>
        <path d="M4 16l6-6 4 4 6-6" />
        <path d="M16 8h4v4" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M7 4h10v16H7z" />
      <path d="M9.5 8h5" />
      <path d="M9.5 12h5" />
    </svg>
  );
}

export default function PostDetailPage() {
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [result, setResult] = useState<PostDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nextPost, setNextPost] = useState<{ id: string; title: string } | null>(null);

  const postId = params.postId;

  const articleSchema = result
    ? {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: result.post.title,
        datePublished: result.post.created_at,
        author: {
          "@type": "Person",
          name: result.post.author_nickname,
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": `${typeof window !== "undefined" ? window.location.origin : ""}/p/${result.post.id}`,
        },
        articleSection: result.board.name,
      }
    : null;

  const toc = useMemo(() => extractToc(result?.post.content ?? ""), [result?.post.content]);

  const load = async () => {
    const payload = await publicApiFetch<PostDetailResponse>(`/api/posts/${postId}`, { cache: "no-store" });

    if (!payload.ok) {
      setError(payload.error?.message ?? "게시글을 불러오지 못했습니다.");
      return;
    }

    setResult(payload.data);
    setError(null);
  };

  useEffect(() => {
    if (postId) {
      void load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    async function loadNextUp() {
      if (!result?.board.slug || !result.post.id) {
        setNextPost(null);
        return;
      }

      const payload = await publicApiFetch<BoardPostsResponse>(`/api/boards/${result.board.slug}/posts?page=1`, {
        cache: "no-store",
      });

      if (!payload.ok) {
        setNextPost(null);
        return;
      }

      const target = (payload.data?.posts ?? []).find((entry) => entry.id !== result.post.id) ?? null;
      setNextPost(target ? { id: target.id, title: target.title } : null);
    }

    void loadNextUp();
  }, [result?.board.slug, result?.post.id]);

  const handleLike = async () => {
    const response = await apiFetch<{ liked: boolean }>(`/api/posts/${postId}/like`, { method: "POST" });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    await load();
  };

  const handleDeletePost = async () => {
    const confirmDelete = window.confirm("정말 삭제하시겠습니까?");
    if (!confirmDelete) {
      return;
    }

    const response = await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    router.push(`/b/${result?.board.slug ?? "freeboard"}`);
  };

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!comment.trim()) {
      return;
    }

    setSubmitting(true);

    const response = await apiFetch(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ content: comment, parent_id: replyTargetId }),
    });

    if (!response.ok) {
      setError(response.error.message);
      setSubmitting(false);
      return;
    }

    setComment("");
    setReplyTargetId(null);
    setSubmitting(false);
    await load();
  };

  const handleDeleteComment = async (commentId: string) => {
    const response = await apiFetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    await load();
  };

  const handleReport = async (targetType: "post" | "comment", targetId: string) => {
    const reason = window.prompt("신고 사유를 입력하세요", "부적절한 내용");
    if (!reason) {
      return;
    }

    const response = await apiFetch(`/api/reports`, {
      method: "POST",
      body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    window.alert("신고가 접수되었습니다.");
  };

  if (error && !result) {
    return <div className={styles.detailError}>{error}</div>;
  }

  const headingSeen = new Map<string, number>();

  return (
    <div className={styles.detailShell}>
      {articleSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      ) : null}

      <nav className={styles.detailRail} aria-label="Detail navigation">
        <Link href="/" className={styles.detailRailBrand} aria-label="Home">
          FB
        </Link>
        <Link href="/" className={styles.detailRailLink} aria-label="Home">
          <RailIcon name="home" />
        </Link>
        <Link href="/search?page=1" className={styles.detailRailLink} aria-label="Search">
          <RailIcon name="search" />
        </Link>
        <Link href={`/b/${result?.board.slug ?? "freeboard"}`} className={`${styles.detailRailLink} ${styles.detailRailLinkActive}`} aria-label="Board">
          <RailIcon name="board" />
        </Link>
        <Link href="/b/ai-freeboard" className={styles.detailRailLink} aria-label="Trending board">
          <RailIcon name="trend" />
        </Link>
        <Link href="/login" className={styles.detailRailLink} aria-label="Bookmarks">
          <RailIcon name="bookmark" />
        </Link>
        <div className={styles.detailRailMe}>{avatarInitial(profile?.nickname ?? "ME")}</div>
      </nav>

      <main className={styles.detailMain}>
        <header className={styles.detailTopbar}>
          <div className={styles.detailBreadcrumbs}>
            <Link href="/">Discussions</Link>
            <span>/</span>
            <Link href={`/b/${result?.board.slug ?? "freeboard"}`}>{result?.board.name ?? "Board"}</Link>
            <span>/</span>
            <strong>Post</strong>
          </div>

          <form action="/search" method="get" className={styles.detailTopSearch}>
            <input type="hidden" name="page" value="1" />
            <input name="q" placeholder="Search..." aria-label="Search" />
          </form>
        </header>

        {error ? <div className={styles.detailError}>{error}</div> : null}

        <div className={styles.detailGrid}>
          <aside className={styles.detailAuthorCol}>
            <div className={styles.detailAuthorCard}>
              <div className={styles.detailAuthorAvatar}>{avatarInitial(result?.post.author_nickname ?? "UN")}</div>
              <h3>{result?.post.author_nickname ?? "Unknown"}</h3>
              <p>@{(result?.post.author_nickname ?? "unknown").toLowerCase().replace(/\s+/g, "_")}</p>
              <span>Community Author</span>
            </div>
          </aside>

          <article className={styles.detailArticleCol}>
            <div className={styles.detailMetaRow}>
              <span className={styles.detailMetaBadge}>Deep Dive</span>
              <span className={styles.detailMetaBadgeMuted}>{formatRelative(result?.post.created_at ?? new Date().toISOString())}</span>
              <span className={styles.detailMetaBadgeMuted}>{result ? formatDate(result.post.created_at) : ""}</span>
            </div>

            <h1 className={styles.detailTitle}>{result?.post.title}</h1>
            <p className={styles.detailSubtitle}>
              Why single prompt LLM calls are becoming obsolete and how multi-agent orchestration reshapes production systems.
            </p>

            <div className={styles.detailHeroVisual}>
              <div className={styles.detailHeroGlow} />
              <p>Figure 1.0: Editorial visualization</p>
            </div>

            <div className={styles.detailProse}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: ({ children }) => {
                    const text = plainText(children);
                    const id = makeHeadingId(normalizeHeading(text), headingSeen);
                    return (
                      <h2 id={id}>
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => {
                    const text = plainText(children);
                    const id = makeHeadingId(normalizeHeading(text), headingSeen);
                    return (
                      <h3 id={id}>
                        {children}
                      </h3>
                    );
                  },
                }}
              >
                {result?.post.content ?? ""}
              </ReactMarkdown>
            </div>

            <section className={styles.detailCommentSection}>
              <div className={styles.detailCommentHeader}>
                <h2>Discussion ({result?.comments.length ?? 0})</h2>
                <Link href={`/b/${result?.board.slug ?? "freeboard"}`}>게시판으로</Link>
              </div>

              {result && result.comments.length === 0 ? <div className={styles.detailEmpty}>아직 댓글이 없습니다.</div> : null}

              <div className={styles.detailCommentList}>
                {(result?.comments ?? []).map((commentNode) => (
                  <article key={commentNode.id} className={styles.detailCommentItem}>
                    <div className={styles.detailCommentMeta}>
                      <strong>{commentNode.author_nickname}</strong>
                      <span>{formatDate(commentNode.created_at)}</span>
                    </div>
                    <p>{commentNode.content}</p>

                    <div className={styles.detailCommentActions}>
                      {profile ? (
                        <button type="button" onClick={() => setReplyTargetId(commentNode.id)}>
                          답글
                        </button>
                      ) : null}
                      {profile ? (
                        <button type="button" onClick={() => void handleReport("comment", commentNode.id)}>
                          신고
                        </button>
                      ) : null}
                      {profile && (profile.id === commentNode.author_id || profile.role === "admin") ? (
                        <button type="button" onClick={() => void handleDeleteComment(commentNode.id)}>
                          삭제
                        </button>
                      ) : null}
                    </div>

                    {(commentNode.replies ?? []).length > 0 ? (
                      <div className={styles.detailReplyList}>
                        {commentNode.replies.map((reply) => (
                          <div key={reply.id} className={styles.detailReplyItem}>
                            <div className={styles.detailCommentMeta}>
                              <strong>{reply.author_nickname}</strong>
                              <span>{formatDate(reply.created_at)}</span>
                            </div>
                            <p>{reply.content}</p>
                            <div className={styles.detailCommentActions}>
                              {profile ? (
                                <button type="button" onClick={() => void handleReport("comment", reply.id)}>
                                  신고
                                </button>
                              ) : null}
                              {profile && (profile.id === reply.author_id || profile.role === "admin") ? (
                                <button type="button" onClick={() => void handleDeleteComment(reply.id)}>
                                  삭제
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              {profile ? (
                <form className={styles.detailCommentForm} onSubmit={handleSubmitComment}>
                  {replyTargetId ? (
                    <div className={styles.detailReplyHint}>
                      <span>답글 작성 중</span>
                      <button type="button" onClick={() => setReplyTargetId(null)}>
                        해제
                      </button>
                    </div>
                  ) : null}
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="댓글을 입력하세요"
                    required
                  />
                  <button type="submit" disabled={submitting}>
                    {submitting ? "등록 중..." : "Post Comment"}
                  </button>
                </form>
              ) : (
                <div className={styles.detailLoginHint}>
                  댓글 작성은 <Link href="/login">로그인</Link> 후 가능합니다.
                </div>
              )}
            </section>
          </article>

          <aside className={styles.detailRightCol}>
            <div className={styles.detailActionCard}>
              <button type="button" onClick={() => void handleLike()}>
                Like {result?.post.like_count ?? 0}
              </button>
              <button type="button">Comments {result?.comments.length ?? 0}</button>
              {profile ? (
                <button type="button" onClick={() => void handleReport("post", postId)}>
                  Report
                </button>
              ) : null}
              {profile && (result?.post.author_id === profile.id || profile.role === "admin") ? (
                <button type="button" onClick={() => void handleDeletePost()}>
                  Delete
                </button>
              ) : null}
            </div>

            {toc.length > 0 ? (
              <div className={styles.detailTocCard}>
                <h4>On this page</h4>
                <ul>
                  {toc.map((item) => (
                    <li key={item.id} className={item.level === 3 ? styles.detailTocSubItem : ""}>
                      <a href={`#${item.id}`}>{item.text}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.detailNextCard}>
              <h4>Next Up</h4>
              {nextPost ? (
                <Link href={`/p/${nextPost.id}`}>{nextPost.title}</Link>
              ) : (
                <p>다음 추천 글이 아직 없습니다.</p>
              )}
            </div>
          </aside>
        </div>

        <footer className={styles.detailFooter}>
          <p>© 2026 FreeBoard Community.</p>
          <div>
            <Link href="/search?page=1">Explore</Link>
            <Link href="/login">Login</Link>
            <Link href="/admin">Admin</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
