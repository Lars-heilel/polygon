import { memo, useCallback, useRef, useState } from 'react';

import { EmojiPicker } from '@org/features-emoji';
import {
  confirmChatFileUpload,
  initChatFileUpload,
  uploadFileToMinio,
  useSendMessage,
} from '@org/features-send-message';
import { Button, Textarea } from '@org/shared';
import { cn } from '@org/shared';

interface ChatFooterProps {
  chatId: string;
}

export const ChatFooter = memo(function ChatFooter({ chatId }: ChatFooterProps) {
  const { messageText, setMessageText, handleSend, setFileAttachment } = useSendMessage(chatId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<{ name: string; size: number } | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleEmojiSelect = useCallback(
    ({ native }: { native: string }) => {
      setMessageText((prev) => prev + native);
    },
    [setMessageText],
  );

  const handleAttachClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !chatId) return;

      setUploading(true);
      setUploadProgress(0);
      setPendingFile({ name: file.name, size: file.size });

      try {
        const { fileId, presignedUrl } = await initChatFileUpload(
          file.name,
          file.type,
          file.size,
          chatId,
        );

        await uploadFileToMinio(presignedUrl, file, setUploadProgress);

        const confirmed = await confirmChatFileUpload(fileId);

        setFileAttachment({
          fileId: confirmed.id,
          fileBucket: 'polygon-public',
          fileKey: presignedUrl.split('/').pop()!.split('?')[0]!,
          fileName: confirmed.originalName,
          fileSize: confirmed.size,
          fileMime: confirmed.mimeType,
        });

        setPendingFile(null);
        setUploadProgress(0);
        handleSend();
      } catch {
        setPendingFile(null);
        setUploadProgress(0);
      } finally {
        setUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [chatId, setFileAttachment, handleSend],
  );

  const hasAttachment = pendingFile !== null;

  return (
    <div className="px-4 py-3 border-t border-border sticky shrink-0 bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
        className="hidden"
        onChange={handleFileChange}
      />

      {hasAttachment && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-surface-elevated rounded-lg text-sm">
          {uploading ? (
            <div className="flex items-center gap-2 flex-1">
              <svg className="w-4 h-4 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-text-muted flex-1">{pendingFile.name}</span>
              <span className="text-text-muted text-xs">{uploadProgress}%</span>
            </div>
          ) : (
            <span className="text-text flex-1 truncate">{pendingFile.name}</span>
          )}
          {!uploading && (
            <button
              onClick={() => setPendingFile(null)}
              className="p-1 hover:bg-border rounded text-text-muted"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
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

      <div className="flex gap-3 items-end">
        <button
          onClick={handleAttachClick}
          disabled={uploading}
          className={cn(
            'p-2 hover:bg-surface-elevated rounded-lg text-text-muted transition-colors',
            uploading && 'opacity-50 pointer-events-none',
          )}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        <div className="flex-1">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a message..."
            rows={1}
            className="resize-none"
          />
        </div>

        <EmojiPicker onSelect={handleEmojiSelect} />

        <Button
          onClick={handleSend}
          disabled={!messageText.trim() && !pendingFile}
          size="md"
        >
          Send
        </Button>
      </div>
    </div>
  );
});
