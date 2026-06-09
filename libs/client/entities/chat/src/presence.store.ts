import { create } from 'zustand';

interface PresenceState {
  onlineUsers: Record<string, boolean>;
  setOnline: (userId: string) => void;
  setOffline: (userId: string) => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  onlineUsers: {},
  setOnline: (userId) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: true },
    })),
  setOffline: (userId) =>
    set((state) => ({
      onlineUsers: { ...state.onlineUsers, [userId]: false },
    })),
}));
