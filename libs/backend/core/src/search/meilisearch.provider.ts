import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meilisearch } from 'meilisearch';

import type { Env } from '../config/env.schema';
import type {
  IndexSettings,
  ISearchProvider,
  SearchDocument,
  SearchHit,
  SearchOptions,
} from './search-provider.interface';

@Injectable()
export class MeilisearchProvider implements ISearchProvider, OnModuleInit {
  private client!: Meilisearch;

  constructor(private readonly config: ConfigService<Env>) {}

  onModuleInit(): void {
    this.client = new Meilisearch({
      host: this.config.getOrThrow('MEILISEARCH_URL', { infer: true }),
      apiKey: this.config.get('MEILISEARCH_MASTER_KEY', { infer: true }),
    });
  }

  async upsert(index: string, doc: SearchDocument): Promise<void> {
    await this.client.index(index).addDocuments([doc]);
  }

  async bulkUpsert(index: string, docs: SearchDocument[]): Promise<void> {
    if (docs.length === 0) return;
    await this.client.index(index).addDocuments(docs);
  }

  async delete(index: string, id: string): Promise<void> {
    await this.client.index(index).deleteDocument(id);
  }

  async clearIndex(index: string): Promise<void> {
    await this.client.index(index).deleteAllDocuments();
  }

  async configureIndex(index: string, settings: IndexSettings): Promise<void> {
    await this.client.index(index).updateSettings({
      searchableAttributes: settings.searchableAttributes,
    });
  }

  async getById<T = SearchDocument>(index: string, id: string): Promise<T | null> {
    try {
      const doc = await this.client.index(index).getDocument(id);
      return doc as T;
    } catch {
      return null;
    }
  }

  async search<T = SearchDocument>(
    index: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchHit<T>[]> {
    const result = await this.client.index(index).search(query, {
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
    });

    return result.hits.map((hit) => ({
      id: (hit as unknown as { id: string }).id,
      document: hit as unknown as T,
    }));
  }
}
