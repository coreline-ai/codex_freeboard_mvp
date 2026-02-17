"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { publicApiFetch } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = await publicApiFetch<{
      user: unknown;
      session: { access_token: string; refresh_token: string } | null;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!payload.ok) {
      setError(payload.error?.message ?? "로그인에 실패했습니다.");
      setLoading(false);
      return;
    }

    if (payload.data?.session?.access_token && payload.data?.session?.refresh_token) {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.setSession({
        access_token: payload.data.session.access_token,
        refresh_token: payload.data.session.refresh_token,
      });
      await refresh();
      router.push("/");
    } else {
      setError("세션 정보가 없습니다.");
    }

    setLoading(false);
  };

  return (
    <div className="page-shell">
      <section className="hero-panel auth-card stack">
        <h1 className="page-title">로그인</h1>
        <p className="page-description">가입한 이메일과 비밀번호로 로그인하세요.</p>

        {error ? <div className="error">{error}</div> : null}

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8자 이상"
              minLength={8}
              required
            />
          </label>

          <button className="primary" type="submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="muted">
          계정이 없다면 <Link href="/signup">회원가입</Link>
        </div>
      </section>
    </div>
  );
}
