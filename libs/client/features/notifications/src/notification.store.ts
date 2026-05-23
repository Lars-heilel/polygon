import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NotificationState {
  isMuted: boolean;
}

interface NotificationActions {
  setMuted: (muted: boolean) => void;
  toggle: () => void;
}

type NotificationStore = NotificationState & NotificationActions;

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      isMuted: false,
      setMuted: (muted) => set({ isMuted: muted }),
      toggle: () => set({ isMuted: !get().isMuted }),
    }),
    { name: 'notification-settings' },
  ),
);

export const selectIsMuted = (s: NotificationStore) => s.isMuted;
