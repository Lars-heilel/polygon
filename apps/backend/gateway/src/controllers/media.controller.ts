import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { lastValueFrom, Observable } from 'rxjs';

import {
  CHAT_CLIENT_TOKEN,
  CHAT_PATTERNS,
  CurrentUser,
  JwtGuard,
  type JwtPayload,
  MEDIA_CLIENT_TOKEN,
  MEDIA_PATTERNS,
  STORAGE_PROVIDER_TOKEN,
  USER_CLIENT_TOKEN,
  USER_PATTERNS,
} from '@org/core';
import type { IStorageProvider } from '@org/core';
import type { FileCategory, LinkPreview } from '@org/common';

@Controller()
@UseGuards(JwtGuard)
export class MediaGatewayController {
  constructor(
    @Inject(MEDIA_CLIENT_TOKEN) private readonly mediaClient: ClientProxy,
    @Inject(CHAT_CLIENT_TOKEN) private readonly chatClient: ClientProxy,
    @Inject(STORAGE_PROVIDER_TOKEN) private readonly storage: IStorageProvider,
    @Inject(USER_CLIENT_TOKEN) private readonly userClient: ClientProxy,
  ) {}

  @Post('media/init-upload')
  async initUpload(
    @Body() body: { originalName: string; mimeType: string; size: number; category: FileCategory; chatId?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    if (body.chatId) {
      const isMember = await this.send<boolean>(
        this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
          chatId: body.chatId,
          userId: user.sub,
        }),
      );

      if (!isMember) {
        throw new HttpException('Forbidden: not a chat member', HttpStatus.FORBIDDEN);
      }
    }

    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.INIT_UPLOAD, {
        originalName: body.originalName,
        mimeType: body.mimeType,
        size: body.size,
        category: body.category,
        chatId: body.chatId,
        uploaderId: user.sub,
      }),
    );
  }

  @Post('media/confirm')
  async confirmUpload(@Body() body: { fileId: string }) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.CONFIRM_UPLOAD, { fileId: body.fileId }),
    );
  }

  @Post('media/upload-avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new HttpException('File is required', HttpStatus.BAD_REQUEST);
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new HttpException('Only image files are allowed', HttpStatus.BAD_REQUEST);
    }

    const ext = extname(file.originalname);
    const key = `avatars/${user.sub}/${randomUUID()}${ext}`;
    const bucket = this.storage.getAvatarsBucket();

    await this.storage.putObject(bucket, key, file.buffer, file.mimetype);
    const publicUrl = this.storage.getPublicUrl(bucket, key);

    const created = await this.send<Record<string, unknown>>(
      this.mediaClient.send(MEDIA_PATTERNS.CREATE_FILE, {
        bucket,
        key,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.buffer.length,
        url: publicUrl,
        uploaderId: user.sub,
        category: 'AVATAR',
      }),
    );

    await this.send(
      this.userClient.send(USER_PATTERNS.UPDATE, {
        id: user.sub,
        dto: { avatarUrl: publicUrl },
      }),
    );

    return created;
  }

  @Get('media/files/:fileId/url')
  async getFileUrl(@Param('fileId') fileId: string, @CurrentUser() user: JwtPayload) {
    const fileInfo = await this.send<{ id: string; chatId: string | null; uploaderId: string | null } | null>(
      this.mediaClient.send(MEDIA_PATTERNS.GET_BY_ID, { id: fileId }),
    );

    if (!fileInfo) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    if (fileInfo.chatId) {
      const isMember = await this.send<boolean>(
        this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
          chatId: fileInfo.chatId,
          userId: user.sub,
        }),
      );

      if (!isMember) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
    }

    return { url: `/api/media/files/${fileId}/content`, expiresIn: null };
  }

  @Get('media/link-preview')
  async getLinkPreview(@Query('url') rawUrl?: string): Promise<LinkPreview> {
    if (!rawUrl) {
      throw new HttpException('url query param is required', HttpStatus.BAD_REQUEST);
    }

    const targetUrl = normalizeExternalUrl(rawUrl);
    const fallback = buildFallbackPreview(targetUrl);

    try {
      const response = await fetch(targetUrl.toString(), {
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
        headers: {
          'user-agent': 'PolygonBot/1.0 (+https://polygon.local/link-preview)',
          accept: 'text/html,application/xhtml+xml',
        },
      });

      if (!response.ok) {
        return fallback;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html')) {
        return fallback;
      }

      const html = await response.text();
      return buildPreviewFromHtml(response.url, html);
    } catch {
      return fallback;
    }
  }

  @Get('media/files/:fileId/content')
  async getFileContent(@Param('fileId') fileId: string, @CurrentUser() user: JwtPayload, @Req() req: Request, @Res() res: Response) {
    const fileInfo = await this.send<{ id: string; bucket: string; key: string; mimeType: string; size: number; chatId: string | null } | null>(
      this.mediaClient.send(MEDIA_PATTERNS.GET_BY_ID, { id: fileId }),
    );

    if (!fileInfo) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    if (fileInfo.chatId) {
      const isMember = await this.send<boolean>(
        this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
          chatId: fileInfo.chatId,
          userId: user.sub,
        }),
      );

      if (!isMember) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
    }

    const etag = `"${fileId}-${fileInfo.size}"`;

    if (req.headers['if-none-match'] === etag) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    const rangeHeader = req.headers['range'] as string | undefined;
    let range: { start: number; end: number } | undefined;

    if (rangeHeader) {
      const parsed = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (parsed) {
        const start = parseInt(parsed[1], 10);
        const end = parsed[2] ? parseInt(parsed[2], 10) : fileInfo.size - 1;
        if (start < fileInfo.size && end < fileInfo.size && start <= end) {
          range = { start, end };
        }
      }
    }

    const fileStream = await this.storage.getFileStream(fileInfo.bucket, fileInfo.key, range);

    if (range) {
      res.status(HttpStatus.PARTIAL_CONTENT);
      res.setHeader('Content-Range', `bytes ${range.start}-${Math.min(range.end, fileStream.size - 1)}/${fileStream.size}`);
      res.setHeader('Content-Length', Math.min(range.end, fileStream.size - 1) - range.start + 1);
    } else {
      res.setHeader('Content-Length', fileStream.size);
    }

    res.setHeader('Content-Type', fileStream.contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('ETag', etag);

    fileStream.stream.pipe(res).on('error', () => {
      if (!res.headersSent) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).end();
      }
    });
  }

  @Delete('media/:id')
  async delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const fileInfo = await this.send<{
      id: string;
      chatId: string | null;
      uploaderId: string | null;
      url: string | null;
      category: string | null;
    } | null>(
      this.mediaClient.send(MEDIA_PATTERNS.GET_BY_ID, { id }),
    );

    if (!fileInfo) {
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }

    if (fileInfo.uploaderId !== user.sub) {
      throw new HttpException('Forbidden: not the file owner', HttpStatus.FORBIDDEN);
    }

    if (fileInfo.chatId) {
      const isMember = await this.send<boolean>(
        this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
          chatId: fileInfo.chatId,
          userId: user.sub,
        }),
      );

      if (!isMember) {
        throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      }
    }

    let previousAvatarUrl: string | null | undefined;

    if (fileInfo.category === 'AVATAR' && fileInfo.url) {
      const currentUser = await this.send<{ avatarUrl: string | null }>(
        this.userClient.send(USER_PATTERNS.GET_BY_ID, { id: user.sub }),
      );

      if (fileInfo.url === currentUser.avatarUrl) {
        const history = await this.send<Array<{ url: string; createdAt: string }>>(
          this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, {
            uploaderId: user.sub,
            category: 'AVATAR',
          }),
        );

        const previous = history.find((f) => f.url !== fileInfo.url);
        previousAvatarUrl = previous?.url ?? null;

        await this.send(
          this.userClient.send(USER_PATTERNS.UPDATE, {
            id: user.sub,
            dto: { avatarUrl: previousAvatarUrl },
          }),
        );
      }
    }

    await this.send(this.mediaClient.send(MEDIA_PATTERNS.DELETE, { id }));

    return { success: true, previousAvatarUrl };
  }

  @Get('media/history')
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: FileCategory,
  ) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, { uploaderId: user.sub, category }),
    );
  }

  @Get('chats/:chatId/media/history')
  async getChatHistory(
    @Param('chatId') chatId: string,
    @CurrentUser() user: JwtPayload,
    @Query('category') category?: FileCategory,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    const isMember = await this.send<boolean>(
      this.chatClient.send(CHAT_PATTERNS.CHECK_MEMBERSHIP, {
        chatId,
        userId: user.sub,
      }),
    );

    if (!isMember) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    return this.send(
      this.mediaClient.send('media.getChatHistory', {
        chatId,
        uploaderId: user.sub,
        category,
        take: take ? parseInt(take, 10) : 50,
        skip: skip ? parseInt(skip, 10) : 0,
      }),
    );
  }

  @Get('users/:userId/avatars')
  async getUserAvatars(@Param('userId') userId: string) {
    return this.send(
      this.mediaClient.send(MEDIA_PATTERNS.GET_HISTORY, {
        uploaderId: userId,
        category: 'AVATAR',
      }),
    );
  }

  private async send<T>(observable: Observable<T>): Promise<T> {
    try {
      return await lastValueFrom(observable);
    } catch (err) {
      const error = err as { statusCode?: number; message?: string };
      throw new HttpException(error.message ?? 'Internal server error', error.statusCode ?? 500);
    }
  }
}

function normalizeExternalUrl(rawUrl: string): URL {
  const normalizedInput = rawUrl.startsWith('www.') ? `https://${rawUrl}` : rawUrl;

  let url: URL;
  try {
    url = new URL(normalizedInput);
  } catch {
    throw new HttpException('Invalid URL', HttpStatus.BAD_REQUEST);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new HttpException('Only http/https URLs are allowed', HttpStatus.BAD_REQUEST);
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.endsWith('.local')
  ) {
    throw new HttpException('Preview is not allowed for local addresses', HttpStatus.BAD_REQUEST);
  }

  return url;
}

function buildFallbackPreview(url: URL): LinkPreview {
  const youtubePreview = getYouTubePreview(url);

  return {
    url: url.toString(),
    canonicalUrl: null,
    title: null,
    description: null,
    imageUrl: youtubePreview?.imageUrl ?? null,
    siteName: youtubePreview?.siteName ?? null,
    hostname: url.hostname,
  };
}

function buildPreviewFromHtml(finalUrl: string, html: string): LinkPreview {
  const url = new URL(finalUrl);
  const youtubePreview = getYouTubePreview(url);
  const title = readMetaContent(html, ['og:title', 'twitter:title']) ?? readTitle(html);
  const description = readMetaContent(html, ['og:description', 'description', 'twitter:description']);
  const image = youtubePreview?.imageUrl ?? readMetaContent(html, ['og:image', 'twitter:image', 'image']);
  const canonicalUrl = readCanonicalUrl(html, url);
  const siteName = youtubePreview?.siteName ?? readMetaContent(html, ['og:site_name']) ?? url.hostname;

  return {
    url: url.toString(),
    canonicalUrl,
    title: youtubePreview?.title ?? title,
    description,
    imageUrl: resolveUrl(image, url),
    siteName,
    hostname: url.hostname,
  };
}

function readTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtml(match?.[1] ?? '').trim() || null;
}

function readMetaContent(html: string, names: string[]): string | null {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name|itemprop)=["']${escapeRegExp(name)}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+(?:property|name|itemprop)=["']${escapeRegExp(name)}["'][^>]*>`,
        'i',
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      const value = decodeHtml(match?.[1] ?? '').trim();
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function readCanonicalUrl(html: string, baseUrl: URL): string | null {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  return resolveUrl(match?.[1] ?? null, baseUrl);
}

function resolveUrl(value: string | null, baseUrl: URL): string | null {
  if (!value) return null;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getYouTubePreview(url: URL): { imageUrl: string; title: string | null; siteName: string } | null {
  const hostname = url.hostname.toLowerCase();
  const isYouTube = hostname.includes('youtube.com') || hostname === 'youtu.be' || hostname.endsWith('.youtu.be');

  if (!isYouTube) {
    return null;
  }

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    return null;
  }

  return {
    imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    title: null,
    siteName: 'YouTube',
  };
}

function extractYouTubeVideoId(url: URL): string | null {
  if (url.hostname === 'youtu.be' || url.hostname.endsWith('.youtu.be')) {
    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  }

  if (url.pathname === '/watch') {
    return url.searchParams.get('v');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const markerIndex = parts.findIndex((part) => ['embed', 'shorts', 'live'].includes(part));
  if (markerIndex >= 0) {
    return parts[markerIndex + 1] ?? null;
  }

  return null;
}
