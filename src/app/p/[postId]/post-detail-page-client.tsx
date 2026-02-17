"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch, publicApiFetch } from "@/lib/client-api";

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

function formatDate(value: string) {
  return new Date(value).toLocaleString();
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
    return <div className="error">{error}</div>;
  }

  return (
    <div className="page-shell">
      {articleSchema ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      ) : null}
      {error ? <div className="error">{error}</div> : null}

      <section className="hero-panel stack">
        <div className="panel-header post-header">
          <h1 className="page-title">{result?.post.title}</h1>
          <Link className="button" href={`/b/${result?.board.slug ?? "freeboard"}`}>
            목록으로
          </Link>
        </div>

        <div className="muted post-meta">
          {result?.post.author_nickname} · {result ? formatDate(result.post.created_at) : ""}
        </div>

        <article className="article-body">{result?.post.content}</article>

        <div className="row post-actions">
          <button type="button" onClick={() => void handleLike()}>
            좋아요 {result?.post.like_count ?? 0}
          </button>
          {profile ? (
            <button type="button" onClick={() => void handleReport("post", postId)}>
              신고
            </button>
          ) : null}
          {profile && (result?.post.author_id === profile.id || profile.role === "admin") ? (
            <button className="danger" type="button" onClick={() => void handleDeletePost()}>
              삭제
            </button>
          ) : null}
        </div>
      </section>

      <section className="card stack">
        <div className="panel-header">
          <h2 className="panel-title">댓글</h2>
          <span className="muted">{result?.comments.length ?? 0}개</span>
        </div>

        {result && result.comments.length === 0 ? <div className="empty-state">아직 댓글이 없습니다.</div> : null}

        <div className="comment-thread">
          {(result?.comments ?? []).map((commentNode) => (
            <article key={commentNode.id} className="comment-item">
              <div className="row comment-meta" style={{ justifyContent: "space-between" }}>
                <strong>{commentNode.author_nickname}</strong>
                <span className="muted">{formatDate(commentNode.created_at)}</span>
              </div>

              <div className="article-body">{commentNode.content}</div>

              <div className="row comment-actions">
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
                  <button className="danger" type="button" onClick={() => void handleDeleteComment(commentNode.id)}>
                    삭제
                  </button>
                ) : null}
              </div>

              {(commentNode.replies ?? []).length > 0 ? (
                <div className="reply-list">
                  {commentNode.replies.map((reply) => (
                    <div key={reply.id} className="reply-item">
                      <div className="row comment-meta" style={{ justifyContent: "space-between" }}>
                        <strong>{reply.author_nickname}</strong>
                        <span className="muted">{formatDate(reply.created_at)}</span>
                      </div>
                      <div className="article-body">{reply.content}</div>
                      <div className="row comment-actions">
                        {profile ? (
                          <button type="button" onClick={() => void handleReport("comment", reply.id)}>
                            신고
                          </button>
                        ) : null}
                        {profile && (profile.id === reply.author_id || profile.role === "admin") ? (
                          <button className="danger" type="button" onClick={() => void handleDeleteComment(reply.id)}>
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
          <form className="stack" onSubmit={handleSubmitComment}>
            {replyTargetId ? (
              <div className="alert row" style={{ justifyContent: "space-between" }}>
                <span>답글 작성 중</span>
                <button type="button" onClick={() => setReplyTargetId(null)}>
                  답글 대상 해제
                </button>
              </div>
            ) : null}

            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="댓글을 입력하세요"
              required
            />
            <div className="row">
              <button className="primary" type="submit" disabled={submitting}>
                {submitting ? "등록 중..." : "댓글 등록"}
              </button>
            </div>
          </form>
        ) : (
          <div className="alert">
            댓글 작성은 <Link href="/login">로그인</Link> 후 가능합니다.
          </div>
        )}
      </section>
    </div>
  );
}
