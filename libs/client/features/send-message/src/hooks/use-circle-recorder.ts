import { useCallback, useRef, useState } from 'react';

import {
  confirmChatFileUpload,
  initChatFileUpload,
  uploadFileToMinio,
} from '../upload-chat-file.api';
import type { FileAttachment } from '../use-send-message';

const MAX_DURATION = 60;
type CameraFacing = 'front' | 'back';

function getVideoConstraints(facing: CameraFacing): MediaTrackConstraints {
  return {
    facingMode: facing === 'back' ? { ideal: 'environment' } : { ideal: 'user' },
  };
}

function getCameraFacingFromStream(stream: MediaStream, fallback: CameraFacing): CameraFacing {
  const facingMode = stream.getVideoTracks()[0]?.getSettings().facingMode;
  return facingMode === 'environment' ? 'back' : fallback;
}

function getRecorderMimeType(): string {
  return MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
}

function getCircleFileName(mimeType: string): string {
  return `circle-${Date.now()}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
}

export function useCircleRecorder(chatId: string, onReady: (attachment: FileAttachment) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<CameraFacing | null>(null);
  const [cameraPreference, setCameraPreference] = useState<CameraFacing>('front');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeTypeRef = useRef('video/mp4');
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const uploadCircle = useCallback(async (blob: Blob, mimeType: string) => {
    const file = new File([blob], getCircleFileName(mimeType), { type: mimeType });
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
  }, [chatId, onReady]);

  const beginRecording = useCallback(async (facing: CameraFacing, resetDuration: boolean) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: getVideoConstraints(facing),
    });
    const mimeType = getRecorderMimeType();
    const recorder = new MediaRecorder(stream, { mimeType });

    streamRef.current = stream;
    mimeTypeRef.current = mimeType;
    setPreviewStream(stream);
    setCameraFacing(getCameraFacingFromStream(stream, facing));
    setCameraPreference(facing);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setPreviewStream(null);
      setCameraFacing(null);
      clearInterval(timerRef.current);
      setDuration(0);

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
      await uploadCircle(blob, mimeTypeRef.current);
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    if (resetDuration) setDuration(0);
  }, [uploadCircle]);

  const start = useCallback(async () => {
    try {
      chunksRef.current = [];
      await beginRecording(cameraPreference, true);

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          const next = d + 1;
          if (next >= MAX_DURATION) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
          }
          return next;
        });
      }, 1000);
    } catch {
      setPreviewStream(null);
      setCameraFacing(null);
      setIsRecording(false);
    }
  }, [beginRecording, cameraPreference]);

  const stop = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const switchCamera = useCallback(async () => {
    const nextFacing = (cameraFacing ?? cameraPreference) === 'front' ? 'back' : 'front';
    setCameraPreference(nextFacing);

    if (!isRecording || !mediaRecorderRef.current || !streamRef.current) return;

    const previousRecorder = mediaRecorderRef.current;
    const previousStream = streamRef.current;

    previousRecorder.onstop = () => {
      previousStream.getTracks().forEach((t) => t.stop());
    };
    previousRecorder.stop();

    try {
      await beginRecording(nextFacing, false);
    } catch {
      previousStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setPreviewStream(null);
      setCameraFacing(null);
      setIsRecording(false);
      clearInterval(timerRef.current);
      setDuration(0);
    }
  }, [beginRecording, cameraFacing, cameraPreference, isRecording]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    duration,
    previewStream,
    cameraFacing,
    cameraPreference,
    formatDuration,
    start,
    stop,
    switchCamera,
  };
}
