import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

interface AuthValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configured: boolean;
  signIn(email: string, password: string): Promise<string | null>;
  signInWithGoogle(): Promise<string | null>;
  signUp(email: string, password: string, displayName: string): Promise<string | null>;
  signOut(): Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

function sessionIsExpired(session: Session) {
  return typeof session.expires_at !== "number" || session.expires_at <= Date.now() / 1000;
}

async function restoreSessionSafely(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (!error && data.session && !sessionIsExpired(data.session)) return data.session;
    if (!error && !data.session) return null;

    // getSession can surface a stale stored JWT before auto-refresh has run. Refresh
    // exactly once here so no authenticated request starts with that stale token.
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session) return refreshed.session;
  } catch {
    // A corrupted local session is handled below just like a rejected refresh token.
  }

  // This only clears this browser's persisted credentials; it does not revoke other
  // devices' sessions. RequireAuth then returns the visitor to the login route.
  try { await supabase.auth.signOut({ scope: "local" }); } catch { /* local storage may already be cleared */ }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const restorationRef = useRef<Promise<Session | null> | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const restore = restorationRef.current ?? restoreSessionSafely();
    restorationRef.current = restore;
    let unsubscribe: (() => void) | undefined;

    void restore.then((nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      // Subscribe only after restoration. This avoids an INITIAL_SESSION event
      // publishing the stale stored session while refreshSession is in flight.
      const { data } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
        if (active) setSession(updatedSession);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    }).catch(() => {
      if (!active) return;
      setSession(null);
      setLoading(false);
    });

    return () => { active = false; unsubscribe?.(); };
  }, []);
  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    configured: isSupabaseConfigured,
    async signIn(email, password) {
      if (!isSupabaseConfigured) return "Supabase authentication is not configured yet.";
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    },
    async signInWithGoogle() {
      if (!isSupabaseConfigured) return "Supabase authentication is not configured yet.";
      const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("dashboard", appBaseUrl).toString() },
      });
      return error?.message ?? null;
    },
    async signUp(email, password, displayName) {
      if (!isSupabaseConfigured) return "Supabase authentication is not configured yet.";
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName } } });
      return error?.message ?? null;
    },
    async signOut() { if (isSupabaseConfigured) await supabase.auth.signOut(); },
  }), [session, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be inside AuthProvider"); return value; }
