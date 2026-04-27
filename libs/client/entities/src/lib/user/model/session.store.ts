import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface SessionState {
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface SessionActions {
  setAuthenticated: (value: boolean) => void;
}

type SessionStore = SessionState & SessionActions;

export const useSessionStore = create<SessionStore>()(
  subscribeWithSelector((set) => ({
    isAuthenticated: false,
    isLoading: true,
    setAuthenticated: (isAuthenticated) => set({ isAuthenticated, isLoading: false }),
  })),
);

export const selectIsAuthenticated = (s: SessionStore) => s.isAuthenticated;
export const selectIsSessionLoading = (s: SessionStore) => s.isLoading;
