"use client";

import { FormEvent, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/client-api";

export default function BoardWritePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { profile } = useAuth();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = params.slug;

  const previewTitle = useMemo(() => {
    if (!title.trim()) {
      return "제목 미리보기";
    }
    return title.trim();
  }, [title]);

  const previewContent = useMemo(() => {
    if (!content.trim()) {
      return "작성한 내용이 여기에 미리 표시됩니다.";
    }
    return content;
  }, [content]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!profile) {
      setError("로그인 후 작성 가능합니다.");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await apiFetch<{ id: string; status: string }>(`/api/boards/${slug}/posts`, {
      method: "POST",
      body: JSON.stringify({ title, content }),
    });

    if (!response.ok) {
      setError(response.error.message);
      setLoading(false);
      return;
    }

    const created = response.data;

    if (created.status === "pending") {
      router.push(`/b/${slug}`);
      return;
    }

    router.push(`/p/${created.id}`);
  };

  return (
    <div className="page-shell">
      <section className="hero-panel stack">
        <h1 className="page-title">글 작성</h1>
        <p className="page-description">간결한 제목과 핵심 내용을 작성하면 가독성이 좋아집니다.</p>

        {!profile ? <div className="alert">로그인 후 이용 가능합니다.</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            제목
            <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} />
          </label>

          <label>
            내용
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              required
              maxLength={20000}
            />
          </label>

          <div className="row">
            <button className="primary" type="submit" disabled={loading || !profile}>
              {loading ? "작성 중..." : "등록"}
            </button>
            <button className="ghost" type="button" onClick={() => router.back()}>
              취소
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <div className="panel-header">
          <h2 className="panel-title">미리보기</h2>
          <span className="muted">/{slug}</span>
        </div>

        <strong>{previewTitle}</strong>
        <div className="article-body muted">{previewContent}</div>
      </section>
    </div>
  );
}
