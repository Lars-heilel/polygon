// CJS stub for the ESM-only meilisearch package — used in Jest unit tests via moduleNameMapper

export class Meilisearch {
  index() {
    return {
      addDocuments: () => Promise.resolve({}),
      search: () => Promise.resolve({ hits: [] }),
      deleteDocument: () => Promise.resolve({}),
    };
  }

  health() {
    return Promise.resolve({ status: 'available' });
  }
}
