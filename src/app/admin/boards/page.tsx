"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/client-api";
import type { Board } from "@/types/domain";

export default function AdminBoardsPage() {
  const { loading, profile } = useAuth();

  const [boards, setBoards] = useState<Board[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    slug: "",
    name: "",
    description: "",
    is_public: true,
    allow_post: true,
    allow_comment: true,
    require_post_approval: false,
  });

  const [cloneForm, setCloneForm] = useState({
    source_board_slug: "freeboard",
    new_slug_base: "",
    new_name: "",
    description: "",
  });

  const loadBoards = async () => {
    const response = await fetch("/api/boards", { cache: "no-store" });
    const payload = await response.json();

    if (!payload.ok) {
      setError(payload.error?.message ?? "게시판 목록 조회 실패");
      return;
    }

    setBoards(payload.data ?? []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBoards();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const response = await apiFetch<Board>("/api/admin/boards/create", {
      method: "POST",
      body: JSON.stringify(createForm),
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessage(`게시판 생성 완료: ${response.data.slug}`);
    await loadBoards();
  };

  const handleClone = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const response = await apiFetch<Board>("/api/admin/boards/clone", {
      method: "POST",
      body: JSON.stringify(cloneForm),
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setMessage(`게시판 복제 완료: ${response.data.slug}`);
    await loadBoards();
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
        <h1 className="page-title">게시판 관리</h1>
        <p className="page-description">직접 생성 또는 기존 보드 복제를 통해 운영 보드를 빠르게 확장합니다.</p>
      </section>

      {message ? <div className="alert">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <section className="grid-2">
        <form className="card stack" onSubmit={handleCreate}>
          <h2 className="panel-title">게시판 생성</h2>

          <label>
            slug
            <input value={createForm.slug} onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })} required />
          </label>

          <label>
            이름
            <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </label>

          <label>
            설명
            <textarea
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createForm.is_public}
              onChange={(e) => setCreateForm({ ...createForm, is_public: e.target.checked })}
            />
            공개
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createForm.allow_post}
              onChange={(e) => setCreateForm({ ...createForm, allow_post: e.target.checked })}
            />
            글쓰기 허용
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createForm.allow_comment}
              onChange={(e) => setCreateForm({ ...createForm, allow_comment: e.target.checked })}
            />
            댓글 허용
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createForm.require_post_approval}
              onChange={(e) => setCreateForm({ ...createForm, require_post_approval: e.target.checked })}
            />
            게시글 승인 필요
          </label>

          <button className="primary" type="submit">
            생성
          </button>
        </form>

        <form className="card stack" onSubmit={handleClone}>
          <h2 className="panel-title">게시판 복제</h2>

          <label>
            원본 게시판
            <select
              value={cloneForm.source_board_slug}
              onChange={(e) => setCloneForm({ ...cloneForm, source_board_slug: e.target.value })}
            >
              {boards.map((board) => (
                <option key={board.id} value={board.slug}>
                  {board.name} ({board.slug})
                </option>
              ))}
            </select>
          </label>

          <label>
            새 slug 기본값
            <input
              value={cloneForm.new_slug_base}
              onChange={(e) => setCloneForm({ ...cloneForm, new_slug_base: e.target.value })}
              required
            />
          </label>

          <label>
            새 게시판 이름
            <input value={cloneForm.new_name} onChange={(e) => setCloneForm({ ...cloneForm, new_name: e.target.value })} required />
          </label>

          <label>
            설명 덮어쓰기(선택)
            <textarea value={cloneForm.description} onChange={(e) => setCloneForm({ ...cloneForm, description: e.target.value })} />
          </label>

          <button className="primary" type="submit">
            복제
          </button>
        </form>
      </section>

      <section className="card stack">
        <div className="panel-header">
          <h2 className="panel-title">현재 게시판</h2>
          <span className="muted">총 {boards.length}개</span>
        </div>

        <div className="table-wrap">
          <table className="clean-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>slug</th>
                <th>설명</th>
                <th>설정</th>
              </tr>
            </thead>
            <tbody>
              {boards.map((board) => (
                <tr key={board.id}>
                  <td>{board.name}</td>
                  <td>/{board.slug}</td>
                  <td>{board.description || "-"}</td>
                  <td>
                    <div className="row">
                      <span className={`badge ${board.is_public ? "success" : "danger"}`}>
                        {board.is_public ? "public" : "private"}
                      </span>
                      {!board.allow_post ? <span className="badge">no-post</span> : null}
                      {!board.allow_comment ? <span className="badge">no-comment</span> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
