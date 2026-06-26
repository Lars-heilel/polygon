import { useCallback, useRef, useState } from 'react';

import {
  confirmChatFileUpload,
  initChatFileUpload,
  uploadFileToMinio,
} from '../upload-chat-file.api';
import type { FileAttachment } from '../use-send-message';

export function useVoiceRecorder(chatId: string, onReady: (attachment: FileAttachment) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(timerRef.current);
        setDuration(0);

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadVoice(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  }, [chatId, onReady]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const uploadVoice = async (blob: Blob) => {
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    const { fileId, presignedUrl } = await initChatFileUpload(
      file.name,
      file.type,
      file.size,
      chatId,
      'VOICE',
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
      fileCategory: 'VOICE',
    });
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return { isRecording, duration, formatDuration, start, stop };
}
