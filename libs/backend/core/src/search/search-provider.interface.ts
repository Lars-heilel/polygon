export interface SearchDocument {
  id: string;
  [key: string]: unknown;
}

export interface SearchHit<T = SearchDocument> {
  id: string;
  document: T;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

export interface ISearchProvider {
  upsert(index: string, doc: SearchDocument): Promise<void>;
  delete(index: string, id: string): Promise<void>;
  getById<T = SearchDocument>(index: string, id: string): Promise<T | null>;
  search<T = SearchDocument>(
    index: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchHit<T>[]>;
  bulkUpsert(index: string, docs: SearchDocument[]): Promise<void>;
}
