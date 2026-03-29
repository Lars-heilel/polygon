import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SessionState {
  accessToken: string | null;
}

interface SessionActions {
  setCredentials: (accessToken: string) => void;
  clearCredentials: () => void;
}

type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  persist(
    (set) => ({
      accessToken: null,
      setCredentials: (accessToken) => set({ accessToken }),
      clearCredentials: () => set({ accessToken: null }),
    }),
    { name: 'session' }
  )
);

export const selectAccessToken = (s: SessionStore) => s.accessToken;
export const selectIsAuthenticated = (s: SessionStore) =>
  Boolean(s.accessToken);
