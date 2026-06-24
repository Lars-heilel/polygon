import { create } from 'zustand';
import type { MediaFile } from './types';

interface MediaStore {
  isUploading: boolean;
  files: MediaFile[];
  setUploading: (v: boolean) => void;
  setFiles: (files: MediaFile[]) => void;
  addFile: (file: MediaFile) => void;
}

export const useMediaStore = create<MediaStore>((set) => ({
  isUploading: false,
  files: [],
  setUploading: (v) => set({ isUploading: v }),
  setFiles: (files) => set({ files }),
  addFile: (file) => set((s) => ({ files: [file, ...s.files] })),
}));
