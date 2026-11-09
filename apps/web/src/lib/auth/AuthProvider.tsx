"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { AuthErrorCode, AuthUser } from "@algoforge/contracts";
import { GoogleLoginModal } from "@/components/auth/GoogleLoginModal";
import { API_BASE_URL } from "../api/config";
import { endpoints } from "../api/endpoints";
import { isApiError } from "../api/errors";
import { queryKeys } from "../query/keys";
import { buildLoginUrl, readAuthError, stripAuthError } from "./loginUrl";
import { onSessionExpired } from "./sessionEvents";

export type AuthStatus = "loading" | "guest" | "authed";

export interface LoginModalOptions {
  /** Internal path to come back to after Google. Defaults to the current page. */
  returnTo?: string;
  /** One line shown under the title, explaining why signing in helps here. */
  message?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** The last error from loading /me (for example the API is unreachable). A 401 is not an error: it just means guest. */
  error: unknown;
  /** Full-page navigation to Google sign-in. */
  login: (returnTo?: string) => void;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  /** Replace the cached user, for example after a profile update. */
  setUser: (user: AuthUser) => void;
  /** Drop the local session (the server side already ended it). */
  clearSession: () => void;
  openLoginModal: (options?: LoginModalOptions) => void;
  closeLoginModal: () => void;
}

const noop = (): void => undefined;
const noopAsync = async (): Promise<void> => undefined;

const AuthContext = createContext<AuthContextValue>({
  user: null,
  status: "guest",
  error: null,
  login: noop,
  logout: noopAsync,
  logoutAll: noopAsync,
  setUser: noop,
  clearSession: noop,
  openLoginModal: noop,
  closeLoginModal: noop,
});

export const useAuth = (): AuthContextValue => useContext(AuthContext);

interface ModalState {
  open: boolean;
  returnTo: string | null;
  message: string | null;
  error: AuthErrorCode | null;
}
const CLOSED: ModalState = { open: false, returnTo: null, message: null, error: null };

/** The cookies are httpOnly, so only the server can say who is signed in. A 401 simply means guest. */
async function fetchMe(signal: AbortSignal): Promise<AuthUser | null> {
  try {
    return (await endpoints.me(signal)).user;
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

/** Everything that belongs to one signed-in person must not outlive their session. */
function clearPrivateData(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: ["analysis"] });
  queryClient.removeQueries({ queryKey: ["shares"] });
  queryClient.removeQueries({ queryKey: ["explain"] });
  queryClient.removeQueries({ queryKey: ["visualizations"] });
  queryClient.removeQueries({ queryKey: queryKeys.deviceSessions() });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(CLOSED);

  const me = useQuery<AuthUser | null>({
    queryKey: queryKeys.me(),
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const user = me.data ?? null;
  const status: AuthStatus = me.isPending ? "loading" : user ? "authed" : "guest";

  const clearSession = useCallback(() => {
    clearPrivateData(queryClient);
    queryClient.setQueryData<AuthUser | null>(queryKeys.me(), null);
  }, [queryClient]);

  // A 401 that refreshing could not fix: show the guest state without refetching (a refetch would just fail again).
  useEffect(
    () =>
      onSessionExpired(() => {
        if (queryClient.getQueryData<AuthUser | null>(queryKeys.me())) clearPrivateData(queryClient);
        queryClient.setQueryData<AuthUser | null>(queryKeys.me(), null);
      }),
    [queryClient],
  );

  // Coming back from Google with ?authError=…: tell the person, then clean the address bar.
  useEffect(() => {
    const code = readAuthError(window.location.search);
    if (!code) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the query string only exists in the browser
    setModal({ open: true, returnTo: null, message: null, error: code });
    window.history.replaceState(window.history.state, "", stripAuthError(window.location.href));
  }, []);

  const login = useCallback((returnTo?: string) => {
    const target = returnTo ?? `${window.location.pathname}${window.location.search}`;
    window.location.assign(buildLoginUrl(target, API_BASE_URL));
  }, []);

  const logout = useCallback(async () => {
    await endpoints.logout();
    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    await endpoints.logoutAll();
    clearSession();
  }, [clearSession]);

  const setUser = useCallback(
    (next: AuthUser) => {
      queryClient.setQueryData<AuthUser | null>(queryKeys.me(), next);
    },
    [queryClient],
  );

  const openLoginModal = useCallback((options?: LoginModalOptions) => {
    setModal({ open: true, returnTo: options?.returnTo ?? null, message: options?.message ?? null, error: null });
  }, []);
  const closeLoginModal = useCallback(() => setModal(CLOSED), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, error: me.error, login, logout, logoutAll, setUser, clearSession, openLoginModal, closeLoginModal }),
    [user, status, me.error, login, logout, logoutAll, setUser, clearSession, openLoginModal, closeLoginModal],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <GoogleLoginModal
        isOpen={modal.open}
        onClose={closeLoginModal}
        error={modal.error}
        message={modal.message}
        onGoogleLogin={async () => {
          login(modal.returnTo ?? undefined);
          // The page is about to navigate away. If it does not (blocked, offline), the button becomes usable again.
          await new Promise<void>((resolve) => setTimeout(resolve, 4000));
        }}
      />
    </AuthContext.Provider>
  );
}
