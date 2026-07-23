import { useCallback, useRef, useState } from 'react';

import {
  confirmChatFileUpload,
  initChatFileUpload,
  uploadFileToMinio,
} from '../upload-chat-file.api';
import type { FileAttachment } from '../use-send-message';

const MAX_DURATION = 60;

export function useCircleRecorder(chatId: string, onReady: (attachment: FileAttachment) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: 'user' },
      });
      chunksRef.current = [];
      const videoTrack = stream.getVideoTracks()[0];
      const facingMode = videoTrack?.getSettings().facingMode;
      setPreviewStream(stream);
      setCameraFacing(facingMode === 'environment' ? 'back' : 'front');

      const mimeType = MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setPreviewStream(null);
        setCameraFacing(null);
        clearInterval(timerRef.current);
        setDuration(0);

        const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
        await uploadCircle(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const next = d + 1;
          if (next >= MAX_DURATION) {
            recorder.stop();
          }
          return next;
        });
      }, 1000);
    } catch {
      setPreviewStream(null);
      setCameraFacing(null);
      setIsRecording(false);
    }
  }, [chatId, onReady]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const uploadCircle = async (blob: Blob) => {
    const file = new File([blob], `circle-${Date.now()}.mp4`, { type: 'video/mp4' });
    const { fileId, presignedUrl } = await initChatFileUpload(
      file.name,
      file.type,
      file.size,
      chatId,
      'CIRCLE',
    );

    await uploadFileToMinio(presignedUrl, file);
    const confirmed = await confirmChatFileUpload(fileId);

    onReady({
      fileId: confirmed.id,
      fileBucket: confirmed.bucket,
      fileKey: confirmed.key,
      fileName: confirmed.originalName,
      fileSize: confirmed.size,
      fileMime: confirmed.mimeType,
      fileCategory: 'CIRCLE',
    });
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { isRecording, duration, previewStream, cameraFacing, formatDuration, start, stop };
}
