<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Workspace Reference Documents

Before implementing features, fixing bugs, or refactoring in this repository, you **MUST** read and understand the following documents to align with the project's architecture, design patterns, and monorepo quirks:

- **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**: Outlines the system architecture, including the API Gateway, microservices (Auth, User, Chat, Media, Notification, Search), database-per-service pattern, communication (RabbitMQ events, Socket.IO WebSockets), cookie-based session flow, and client-side FSD layers with sliced packages.
- **[`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)**: Details the coding conventions, directory layout, TypeScript & NestJS standards (e.g., repository pattern), module boundary rules, package hoisting in the monorepo, and common CLI commands.
- **[`docs/MONOREPO_GOTCHAS.md`](docs/MONOREPO_GOTCHAS.md)**: Highlights critical, non-obvious gotchas such as Tailwind v4 `@source` setup, Vite Dev Proxy for APIs/WebSockets, environment variable parsing across services/Prisma, MSW mocks in multi-lib layouts, and Gateway supertest strategies.

Always check these documents first to preserve established conventions!
