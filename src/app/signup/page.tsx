"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, nickname }),
    });

    const payload = await response.json();

    if (!payload.ok) {
      setError(payload.error?.message ?? "회원가입에 실패했습니다.");
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
      setError("회원가입은 되었지만 세션이 생성되지 않았습니다. 로그인해 주세요.");
    }

    setLoading(false);
  };

  return (
    <div className="page-shell">
      <section className="hero-panel auth-card stack">
        <h1 className="page-title">회원가입</h1>
        <p className="page-description">즉시 가입 후 바로 게시판을 이용할 수 있습니다.</p>

        {error ? <div className="error">{error}</div> : null}

        <form className="stack" onSubmit={handleSubmit}>
          <label>
            닉네임
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="nickname_01"
              required
            />
          </label>

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
            {loading ? "가입 중..." : "가입하기"}
          </button>
        </form>

        <div className="muted">
          이미 계정이 있다면 <Link href="/login">로그인</Link>
        </div>
      </section>
    </div>
  );
}
