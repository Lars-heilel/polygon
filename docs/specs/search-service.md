# Search Service Specification

## Purpose

The Search Service indexes user profiles in Meilisearch and returns user results for direct-chat creation and administrative lookup.

## Implemented Capabilities

- Indexes user data from the implemented user-related RabbitMQ events.
- Searches users by the indexed profile fields.
- Reindexes user data through the authorized gateway surface.
- Returns profile results that the Messenger SPA can use to open a profile or direct chat.

## Runtime Contracts

- Meilisearch is the search backend for this service.
- Gateway search and reindex operations require a valid active session; administrative operations use the administrative guard surface.
- Search results are profile data and do not include session secrets.

## Acceptance Criteria

- **SEARCH-1:** User search returns profiles suitable for direct-chat creation and administrative lookup.
- **SEARCH-2:** User indexing follows the implemented RabbitMQ user events and can be re-run through the authorized reindex route.

## Exclusions

Message search, message indexing, chat-scoped full-text search, and result highlighting are not current product behavior.
