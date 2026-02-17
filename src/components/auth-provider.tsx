"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/domain";
import { apiFetch } from "@/lib/client-api";

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refresh = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();

    setSession(currentSession);

    if (!currentSession?.access_token) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const meResponse = await apiFetch<Profile>("/api/me");
    if (meResponse.ok) {
      setProfile(meResponse.data);
    } else {
      setProfile(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refresh();
    });

    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    await refresh();
  };

  return (
    <AuthContext.Provider value={{ loading, session, profile, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
