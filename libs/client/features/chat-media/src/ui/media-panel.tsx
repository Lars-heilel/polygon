import React, { memo, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';

import type { FileCategory } from '@org/common';
import { Text } from '@org/shared';

import { useChatMediaInfiniteQuery, groupMediaByDate } from '../api/use-chat-media.js';
import type { MediaFile } from '../api/chat-media.api.js';

interface MediaPanelProps {
  chatId: string;
}

type CategoryTab = { key: FileCategory | 'ALL'; label: string };

const categories: CategoryTab[] = [
  { key: 'IMAGE', label: 'Photo' },
  { key: 'VIDEO', label: 'Video' },
  { key: 'AUDIO', label: 'Audio' },
  { key: 'FILE', label: 'Docs' },
];

export const MediaPanel = memo(function MediaPanel({ chatId }: MediaPanelProps) {
  const [activeCategory, setActiveCategory] = React.useState<FileCategory | 'ALL'>('ALL');

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveCategory('ALL')}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            activeCategory === 'ALL'
              ? 'text-primary border-b-2 border-primary'
              : 'text-text-muted hover:text-text'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              activeCategory === cat.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {activeCategory === 'ALL' ? (
          <AllMediaList chatId={chatId} />
        ) : (
          <CategorizedMediaList chatId={chatId} category={activeCategory} />
        )}
      </div>
    </div>
  );
});

function AllMediaList({ chatId }: { chatId: string }) {
  const queries = {
    IMAGE: useChatMediaInfiniteQuery(chatId, 'IMAGE'),
    VIDEO: useChatMediaInfiniteQuery(chatId, 'VIDEO'),
    AUDIO: useChatMediaInfiniteQuery(chatId, 'AUDIO'),
    FILE: useChatMediaInfiniteQuery(chatId, 'FILE'),
  };

  const isLoading = Object.values(queries).some((q) => q.isLoading);
  const allFiles = useMemo(() => {
    const files: MediaFile[] = [];
    for (const q of Object.values(queries)) {
      if (q.data) {
        for (const page of q.data.pages) {
          files.push(...page.files);
        }
      }
    }
    files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return files;
  }, [queries]);

  const groups = useMemo(() => groupMediaByDate(allFiles), [allFiles]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  if (allFiles.length === 0) {
    return <div className="flex items-center justify-center py-16 text-text-muted text-sm">
      No media yet
    </div>;
  }

  const flatItems = buildFlatGroupedList(groups);

  return (
    <Virtuoso
      className="h-full"
      data={flatItems}
      itemContent={(_, item) => {
        if (item.type === 'header') {
          return (
            <div className="px-4 py-2 text-xs font-medium text-text-muted sticky top-0 bg-surface-elevated z-10">
              {item.label}
            </div>
          );
        }
        return <MediaThumbnail file={item.file} />;
      }}
    />
  );
}

function CategorizedMediaList({ chatId, category }: { chatId: string; category: FileCategory }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useChatMediaInfiniteQuery(chatId, category);

  const groups = useMemo(() => {
    const files = data?.pages.flatMap((p) => p.files) ?? [];
    return groupMediaByDate(files);
  }, [data]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  if (!data || data.pages[0].files.length === 0) {
    return <div className="flex items-center justify-center py-16 text-text-muted text-sm">
      No {category.toLowerCase()} yet
    </div>;
  }

  const flatItems = buildFlatGroupedList(groups);

  return (
    <Virtuoso
      className="h-full"
      data={flatItems}
      endReached={() => {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }}
      components={{
        Footer: () => (isFetchingNextPage ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : null),
      }}
      itemContent={(_, item) => {
        if (item.type === 'header') {
          return (
            <div className="px-4 py-2 text-xs font-medium text-text-muted sticky top-0 bg-surface-elevated z-10">
              {item.label}
            </div>
          );
        }
        return <MediaThumbnail file={item.file} />;
      }}
    />
  );
}

type FlatItem =
  | { type: 'header'; label: string }
  | { type: 'file'; file: MediaFile };

function buildFlatGroupedList(groups: Map<string, MediaFile[]>): FlatItem[] {
  const items: FlatItem[] = [];
  for (const [label, files] of groups) {
    items.push({ type: 'header', label });
    for (const file of files) {
      items.push({ type: 'file', file });
    }
  }
  return items;
}

const MediaThumbnail = memo(function MediaThumbnail({ file }: { file: MediaFile }) {
  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');

  if (isImage) {
    return (
      <div className="px-4 py-1.5">
        <div className="w-[min(90vw,200px)] h-[120px] rounded-lg overflow-hidden">
          <img
            src={`/api/media/files/${file.id}/content`}
            alt={file.originalName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="px-4 py-1.5">
        <div className="w-[min(90vw,200px)] h-[120px] rounded-lg overflow-hidden bg-surface-elevated flex items-center justify-center relative">
          <video
            src={`/api/media/files/${file.id}/content`}
            className="w-full h-full object-cover"
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="px-4 py-1.5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg overflow-hidden bg-surface-elevated w-[min(90vw,280px)]">
          <span className="text-xl">🎵</span>
          <div className="flex-1 min-w-0">
            <Text size="sm" className="truncate">{file.originalName}</Text>
            <Text size="xs" color="muted">{formatFileSize(file.size)}</Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-1.5">
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg overflow-hidden bg-surface-elevated w-[min(90vw,280px)]">
        <span className="text-xl">{getFileIcon(file.originalName)}</span>
        <div className="flex-1 min-w-0">
          <Text size="sm" className="truncate">{file.originalName}</Text>
          <Text size="xs" color="muted">{formatFileSize(file.size)}</Text>
        </div>
      </div>
    </div>
  );
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return '📄';
    case 'doc': case 'docx': return '📝';
    case 'xls': case 'xlsx': return '📊';
    case 'zip': case 'rar': case '7z': return '📦';
    case 'txt': return '📃';
    default: return '📎';
  }
}
