import { create } from 'zustand';
import type { AvatarItem } from './types';

interface AvatarStore {
  files: AvatarItem[];
  setFiles: (files: AvatarItem[]) => void;
  addFile: (file: AvatarItem) => void;
  removeFile: (id: string) => void;
}

export const useAvatarStore = create<AvatarStore>((set) => ({
  files: [],
  setFiles: (files) => set({ files }),
  addFile: (file) => set((s) => ({ files: [file, ...s.files] })),
  removeFile: (id) => set((s) => ({ files: s.files.filter((f) => f.id !== id) })),
}));
