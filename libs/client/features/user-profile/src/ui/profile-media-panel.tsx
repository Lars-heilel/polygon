import { memo, useMemo, useState } from 'react';

import type { ChatMediaFilter } from '@org/common';
import { FileMessage, LinkPreviewCard, MessageContent } from '@org/entities-message';
import { useGetChatsSuspenseQuery } from '@org/entities-chat';
import { useMeSuspenseQuery } from '@org/entities-user';
import { MediaViewer, Spinner, type MediaViewerItem, Text, cn, formatTime } from '@org/shared';
import { Virtuoso } from 'react-virtuoso';

import {
  buildChatMediaEntries,
  groupMediaEntriesByDate,
  useChatMediaMessages,
  type ChatMediaEntry,
} from '../api/use-chat-media.js';

interface ProfileMediaPanelProps {
  chatId: string;
}

const tabs: Array<{ key: ChatMediaFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'IMAGE', label: 'Photo' },
  { key: 'VIDEO', label: 'Video' },
  { key: 'AUDIO', label: 'Audio' },
  { key: 'FILE', label: 'Docs' },
  { key: 'LINK', label: 'Links' },
];

export const ProfileMediaPanel = memo(function ProfileMediaPanel({ chatId }: ProfileMediaPanelProps) {
  const [activeTab, setActiveTab] = useState<ChatMediaFilter>('ALL');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useChatMediaMessages(chatId, activeTab);
  const { data: me } = useMeSuspenseQuery();
  const { data: chats } = useGetChatsSuspenseQuery();

  const chat = chats.find((item) => item.id === chatId);
  const profiles = useMemo(
    () => new Map((chat?.members ?? []).map((member) => [member.userId, member.profile])),
    [chat],
  );

  const items = useMemo(() => {
    const messages = data?.pages.flatMap((page) => page.messages) ?? [];
    return buildChatMediaEntries(messages);
  }, [data]);

  const groups = useMemo(() => groupMediaEntriesByDate(items), [items]);
  const flatItems = useMemo(() => flattenGroups(groups), [groups]);
  const visualItems = useMemo(() => buildVisualViewerItems(items), [items]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto rounded-md border border-border bg-surface-elevated p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-muted hover:bg-surface/70 hover:text-text',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Text size="sm" color="muted">Nothing yet</Text>
          </div>
        ) : (
          <Virtuoso
            className="h-full"
            data={flatItems}
            endReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            components={{
              Footer: () => (isFetchingNextPage ? (
                <div className="flex justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : null),
            }}
            itemContent={(_, item) => {
              if (item.type === 'header') {
                return (
                  <div className="sticky top-0 z-10 bg-background/95 px-1 py-2 text-xs font-medium text-text-muted backdrop-blur">
                    {item.label}
                  </div>
                );
              }

              const profile = profiles.get(item.entry.message.senderId);
              const isMine = item.entry.message.senderId === me.id;

              return (
                <MediaEntryCard
                  entry={item.entry}
                  isMine={isMine}
                  senderName={profile?.displayName ?? profile?.name ?? 'Unknown'}
                  onOpenViewer={() => {
                    const nextIndex = visualItems.findIndex((visualItem) => visualItem.id === item.entry.id);
                    if (nextIndex >= 0) {
                      setViewerIndex(nextIndex);
                    }
                  }}
                />
              );
            }}
          />
        )}
      </div>

      <MediaViewer
        isOpen={viewerIndex !== null}
        items={visualItems}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
});

type FlatItem =
  | { type: 'header'; label: string }
  | { type: 'entry'; entry: ChatMediaEntry };

function flattenGroups(groups: Map<string, ChatMediaEntry[]>): FlatItem[] {
  const items: FlatItem[] = [];

  for (const [label, entries] of groups) {
    items.push({ type: 'header', label });
    for (const entry of entries) {
      items.push({ type: 'entry', entry });
    }
  }

  return items;
}

const MediaEntryCard = memo(function MediaEntryCard({
  entry,
  isMine,
  senderName,
  onOpenViewer,
}: {
  entry: ChatMediaEntry;
  isMine: boolean;
  senderName: string;
  onOpenViewer: () => void;
}) {
  const isVisualFile = entry.kind === 'file'
    && ['IMAGE', 'VIDEO', 'CIRCLE'].includes(entry.message.fileCategory ?? '');

  return (
    <div className="mb-3 rounded-lg border border-border bg-surface p-3 shadow-[var(--shadow-surface)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Text size="xs" weight="medium">{senderName}</Text>
        <Text size="xs" color="muted">{formatTime(entry.message.createdAt)}</Text>
      </div>

      {entry.kind === 'file' ? (
        <div className="space-y-2">
          {isVisualFile ? (
            <VisualMediaPreview entry={entry} onOpenViewer={onOpenViewer} />
          ) : (
            <FileMessage message={entry.message} isMine={isMine} />
          )}
          {entry.message.text ? (
            <div className="rounded-md border border-border bg-surface-elevated p-2">
              <MessageContent text={entry.message.text} isMine={false} />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <LinkPreviewCard url={entry.url} />
          {entry.message.text ? (
            <div className="rounded-md border border-border bg-surface-elevated p-2">
              <MessageContent text={entry.message.text} isMine={false} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});

const VisualMediaPreview = memo(function VisualMediaPreview({
  entry,
  onOpenViewer,
}: {
  entry: Extract<ChatMediaEntry, { kind: 'file' }>;
  onOpenViewer: () => void;
}) {
  const src = `/api/media/files/${entry.message.fileId}/content`;
  const isImage = entry.message.fileCategory === 'IMAGE';

  return (
    <button
      type="button"
      onClick={onOpenViewer}
      className="block w-full overflow-hidden rounded-lg border border-border bg-surface-elevated text-left transition-colors hover:border-primary/60"
    >
      {isImage ? (
        <img
          src={src}
          alt={entry.message.fileName ?? 'Image'}
          className="h-56 w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="relative">
          <video
            src={src}
            className="h-56 w-full object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-background/30">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/90 text-text shadow-[var(--shadow-surface)]">
              <svg className="ml-1 h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </button>
  );
});

function buildVisualViewerItems(items: ChatMediaEntry[]): MediaViewerItem[] {
  return items.flatMap((item) => {
    if (item.kind !== 'file') {
      return [];
    }

    const category = item.message.fileCategory;
    if (!category || !['IMAGE', 'VIDEO', 'CIRCLE'].includes(category)) {
      return [];
    }

    return [{
      id: item.id,
      type: category === 'IMAGE' ? 'image' : 'video',
      src: `/api/media/files/${item.message.fileId}/content`,
      alt: item.message.fileName ?? 'Media',
      label: item.message.fileName ?? 'Media',
    }];
  });
}
