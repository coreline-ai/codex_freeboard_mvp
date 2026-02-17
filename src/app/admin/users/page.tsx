"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiFetch } from "@/lib/client-api";
import type { Profile } from "@/types/domain";

interface UserActivity {
  posts: Array<{ id: string; title: string; status: string; created_at: string }>;
  comments: Array<{ id: string; post_id: string; status: string; created_at: string }>;
  reports: Array<{ id: string; target_type: string; target_id: string; status: string; created_at: string }>;
  moderation_actions: Array<{
    id: string;
    action_type: string;
    target_type: string;
    target_id: string;
    created_at: string;
    meta: Record<string, unknown>;
  }>;
}

interface UserListData {
  users: Profile[];
  page: number;
  pageSize: number;
  total: number;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

export default function AdminUsersPage() {
  const { loading, profile } = useAuth();

  const [data, setData] = useState<UserListData | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "user" | "admin">("all");
  const [suspendedOnly, setSuspendedOnly] = useState(false);

  const loadUsers = async (nextPage: number) => {
    const params = new URLSearchParams({ page: String(nextPage) });
    if (q.trim()) {
      params.set("q", q.trim());
    }
    if (role !== "all") {
      params.set("role", role);
    }
    if (suspendedOnly) {
      params.set("suspended", "true");
    }

    const response = await apiFetch<UserListData>(`/api/admin/users?${params.toString()}`);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setData(response.data);
    setPage(nextPage);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers(1);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUserRole = async (userId: string, nextRole: "user" | "admin") => {
    const response = await apiFetch(`/api/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: nextRole }),
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    await loadUsers(page);
  };

  const suspend = async (userId: string) => {
    const daysRaw = window.prompt("정지 일수", "7");
    const reason = window.prompt("정지 사유", "운영 정책 위반");

    if (!daysRaw || !reason) {
      return;
    }

    const days = Number(daysRaw);

    const response = await apiFetch(`/api/admin/users/${userId}/suspend`, {
      method: "PATCH",
      body: JSON.stringify({ days, reason }),
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    await loadUsers(page);
  };

  const restore = async (userId: string) => {
    const response = await apiFetch(`/api/admin/users/${userId}/restore`, {
      method: "PATCH",
    });

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    await loadUsers(page);
  };

  const loadActivity = async (userId: string) => {
    setSelectedUserId(userId);

    const response = await apiFetch<UserActivity>(`/api/admin/users/${userId}/activity`);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setActivity(response.data);
  };

  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(Math.ceil(data.total / data.pageSize), 1);
  }, [data]);

  const onFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await loadUsers(1);
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
        <h1 className="page-title">유저 관리</h1>
        <p className="page-description">권한 변경, 정지/복구, 활동 조회를 한 화면에서 처리합니다.</p>

        <form className="toolbar-form admin-users-filter" onSubmit={onFilterSubmit}>
          <input
            className="search-input"
            placeholder="이메일/닉네임 검색"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <select value={role} onChange={(event) => setRole(event.target.value as "all" | "user" | "admin")}>
            <option value="all">전체 권한</option>
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={suspendedOnly}
              onChange={(event) => setSuspendedOnly(event.target.checked)}
            />
            정지 사용자만
          </label>
          <button type="submit">필터 적용</button>
        </form>
      </section>

      {error ? <div className="error">{error}</div> : null}

      <section className="card stack">
        <div className="panel-header">
          <h2 className="panel-title">사용자 목록</h2>
          <span className="muted">총 {data?.total ?? 0}명</span>
        </div>

        <div className="table-wrap desktop-only">
          <table className="clean-table">
            <thead>
              <tr>
                <th>사용자</th>
                <th>권한</th>
                <th>정지 상태</th>
                <th>가입일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {(data?.users ?? []).map((user) => (
                <tr key={user.id}>
                  <td>
                    <div>
                      <strong>{user.nickname}</strong>
                    </div>
                    <div className="muted">{user.email}</div>
                  </td>
                  <td>
                    <span className={`badge ${user.role === "admin" ? "pinned" : ""}`}>{user.role}</span>
                  </td>
                  <td>
                    {user.suspended_until ? (
                      <span className="badge danger">{formatDate(user.suspended_until)} 까지 정지</span>
                    ) : (
                      <span className="badge success">정상</span>
                    )}
                  </td>
                  <td>{formatDate(user.created_at)}</td>
                  <td>
                    <div className="row">
                      <button
                        type="button"
                        onClick={() => void setUserRole(user.id, user.role === "admin" ? "user" : "admin")}
                      >
                        role 변경
                      </button>
                      <button type="button" onClick={() => void suspend(user.id)}>
                        정지
                      </button>
                      <button type="button" onClick={() => void restore(user.id)}>
                        복구
                      </button>
                      <button type="button" onClick={() => void loadActivity(user.id)}>
                        활동보기
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="list mobile-only">
          {(data?.users ?? []).map((user) => (
            <article key={`mobile-${user.id}`} className="list-item">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{user.nickname}</strong>
                <span className={`badge ${user.role === "admin" ? "pinned" : ""}`}>{user.role}</span>
              </div>
              <div className="muted">{user.email}</div>
              <div className="muted">가입일: {formatDate(user.created_at)}</div>
              <div>
                {user.suspended_until ? (
                  <span className="badge danger">{formatDate(user.suspended_until)} 까지 정지</span>
                ) : (
                  <span className="badge success">정상</span>
                )}
              </div>
              <div className="row admin-user-actions">
                <button type="button" onClick={() => void setUserRole(user.id, user.role === "admin" ? "user" : "admin")}>
                  role 변경
                </button>
                <button type="button" onClick={() => void suspend(user.id)}>
                  정지
                </button>
                <button type="button" onClick={() => void restore(user.id)}>
                  복구
                </button>
                <button type="button" onClick={() => void loadActivity(user.id)}>
                  활동보기
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="pagination">
          <button type="button" onClick={() => void loadUsers(page - 1)} disabled={page <= 1}>
            이전
          </button>
          <span className="muted">
            {page} / {totalPages}
          </span>
          <button type="button" onClick={() => void loadUsers(page + 1)} disabled={page >= totalPages}>
            다음
          </button>
        </div>
      </section>

      {selectedUserId && activity ? (
        <section className="card stack">
          <div className="panel-header">
            <h2 className="panel-title">활동 내역</h2>
            <span className="muted">userId: {selectedUserId}</span>
          </div>

          <div className="grid-2">
            <div className="stack">
              <strong>게시글 ({activity.posts.length})</strong>
              <pre className="code-view">{JSON.stringify(activity.posts, null, 2)}</pre>
            </div>
            <div className="stack">
              <strong>댓글 ({activity.comments.length})</strong>
              <pre className="code-view">{JSON.stringify(activity.comments, null, 2)}</pre>
            </div>
            <div className="stack">
              <strong>신고 ({activity.reports.length})</strong>
              <pre className="code-view">{JSON.stringify(activity.reports, null, 2)}</pre>
            </div>
            <div className="stack">
              <strong>모더레이션 ({activity.moderation_actions.length})</strong>
              <pre className="code-view">{JSON.stringify(activity.moderation_actions, null, 2)}</pre>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
