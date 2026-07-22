import { memo, useCallback, useState } from 'react';

import { useMeSuspenseQuery } from '@org/entities-user';
import { EmojiPicker } from '@org/features-emoji';
import {
  type FileAttachment,
  confirmChatFileUpload,
  getCategoryFromMime,
  initChatFileUpload,
  uploadFileToMinio,
  useCircleRecorder,
  useSendMessage,
  useVoiceRecorder,
} from '@org/features-send-message';
import { IconButton, Spinner, Text, Textarea, cn } from '@org/shared';

import { AttachMenu } from './attach-menu';

interface ChatFooterProps {
  chatId: string;
}

export const ChatFooter = memo(function ChatFooter({ chatId }: ChatFooterProps) {
  const { data: me } = useMeSuspenseQuery();
  const { messageText, setMessageText, handleSend, setFileAttachment } = useSendMessage(chatId, me.id);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number } | null>(null);

  const sendWithAttachment = useCallback(
    (attachment: FileAttachment) => {
      setFileAttachment(attachment);
      requestAnimationFrame(() => handleSend());
    },
    [setFileAttachment, handleSend],
  );

  const voiceRecorder = useVoiceRecorder(chatId, sendWithAttachment);
  const circleRecorder = useCircleRecorder(chatId, sendWithAttachment);

  const isRecording = voiceRecorder.isRecording || circleRecorder.isRecording;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isRecording) return;
        handleSend();
      }
    },
    [handleSend, isRecording],
  );

  const handleEmojiSelect = useCallback(
    ({ native }: { native: string }) => {
      setMessageText((prev) => prev + native);
    },
    [setMessageText],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !chatId) return;

      setUploading(true);
      setUploadProgress(0);
      setPendingFile({ name: file.name, size: file.size });

      try {
        const category = getCategoryFromMime(file.type);
        const { fileId, presignedUrl } = await initChatFileUpload(
          file.name,
          file.type,
          file.size,
          chatId,
          category,
        );

        await uploadFileToMinio(presignedUrl, file, setUploadProgress);

        const confirmed = await confirmChatFileUpload(fileId);

        sendWithAttachment({
          fileId: confirmed.id,
          fileBucket: confirmed.bucket,
          fileKey: confirmed.key,
          fileName: confirmed.originalName,
          fileSize: confirmed.size,
          fileMime: confirmed.mimeType,
          fileCategory: category,
        });

        setPendingFile(null);
        setUploadProgress(0);
      } catch {
        setPendingFile(null);
        setUploadProgress(0);
      } finally {
        setUploading(false);
      }
    },
    [chatId, sendWithAttachment],
  );

  const handleAttachFile = useCallback(
    (file: File) => {
      // Create a synthetic change event
      handleFileChange({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
    },
    [handleFileChange],
  );

  const handleRecordVoice = useCallback(() => {
    if (voiceRecorder.isRecording) {
      voiceRecorder.stop();
    } else {
      voiceRecorder.start();
    }
  }, [voiceRecorder]);

  const handleRecordCircle = useCallback(() => {
    if (circleRecorder.isRecording) {
      circleRecorder.stop();
    } else {
      circleRecorder.start();
    }
  }, [circleRecorder]);

  const hasText = messageText.trim().length > 0;
  const hasAttachment = pendingFile !== null;

  return (
    <div className="px-4 py-3 border-t border-border sticky shrink-0 bg-background">
      {hasAttachment && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-surface-elevated rounded-lg text-sm">
          {uploading ? (
            <div className="flex items-center gap-2 flex-1">
              <Spinner
                size="sm"
                color="primary"
              />
              <Text
                as="span"
                size="sm"
                color="muted"
                className="flex-1 truncate"
              >
                {pendingFile.name}
              </Text>
              <Text
                as="span"
                size="xs"
                color="muted"
              >
                {uploadProgress}%
              </Text>
            </div>
          ) : (
            <Text
              as="span"
              size="sm"
              className="flex-1 truncate"
            >
              {pendingFile.name}
            </Text>
          )}
          {!uploading && (
            <IconButton
              type="button"
              label="Remove attachment"
              size="xs"
              variant="ghost"
              onClick={() => setPendingFile(null)}
              icon={<CloseIcon />}
            />
          )}
          {uploading && (
            <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {voiceRecorder.isRecording && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-danger-muted border border-danger/30 rounded-lg text-sm">
          <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
          <Text
            as="span"
            size="sm"
            color="danger"
            weight="medium"
          >
            Recording voice...
          </Text>
          <Text
            as="span"
            size="sm"
            color="muted"
            className="ml-auto tabular-nums"
          >
            {voiceRecorder.formatDuration(voiceRecorder.duration)}
          </Text>
        </div>
      )}

      {circleRecorder.isRecording && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-info-muted border border-info/30 rounded-lg text-sm">
          <span className="w-2 h-2 rounded-full bg-info animate-pulse" />
          <Text
            as="span"
            size="sm"
            color="primary"
            weight="medium"
          >
            Recording circle...
          </Text>
          <Text
            as="span"
            size="sm"
            color="muted"
            className="ml-auto tabular-nums"
          >
            {circleRecorder.formatDuration(circleRecorder.duration)}
          </Text>
        </div>
      )}

      <div className="flex gap-3 items-end">
        <AttachMenu
          disabled={uploading || isRecording}
          onFileSelected={handleAttachFile}
        />

        <div className="flex-1">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Recording...' : 'Write a message...'}
            rows={1}
            className="resize-none"
          />
        </div>

        <EmojiPicker onSelect={handleEmojiSelect} />

        {hasText ? (
          <IconButton
            type="button"
            label="Send message"
            size="lg"
            variant="primary"
            onClick={handleSend}
            disabled={isRecording}
            className="rounded-full"
            icon={<SendIcon />}
          />
        ) : (
          <div className="flex gap-1">
            <IconButton
              type="button"
              label="Voice message"
              size="lg"
              variant={voiceRecorder.isRecording ? 'danger' : 'ghost'}
              onClick={handleRecordVoice}
              disabled={isRecording && !voiceRecorder.isRecording}
              className={cn(
                'rounded-full',
                voiceRecorder.isRecording && 'animate-pulse',
              )}
              icon={<VoiceIcon />}
            />
            <IconButton
              type="button"
              label="Circle video"
              size="lg"
              variant="ghost"
              onClick={handleRecordCircle}
              disabled={isRecording && !circleRecorder.isRecording}
              className={cn(
                'rounded-full',
                circleRecorder.isRecording && 'bg-info text-text-inverse hover:opacity-90 animate-pulse',
              )}
              icon={<CircleVideoIcon />}
            />
          </div>
        )}
      </div>
    </div>
  );
});

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function VoiceIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m-4 0h8m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function CircleVideoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        strokeWidth={2}
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 9l5 3-5 3V9z"
      />
    </svg>
  );
}
