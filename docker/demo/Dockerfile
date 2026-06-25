# ================================================================
# Polygon — Monolithic Demo Backend (Multi-stage Build)
# ================================================================

# ---- Stage 1: Builder ----
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Layer 1: Dependency manifests (for build cache)
COPY package.json package-lock.json .npmrc ./
COPY tsconfig.base.json tsconfig.json nx.json ./
COPY jest.preset.js jest.config.ts .eslintrc.json .prettierrc ./
COPY apps/backend/gateway/package.json apps/backend/gateway/
COPY apps/backend/auth-service/package.json apps/backend/auth-service/
COPY apps/backend/user-service/package.json apps/backend/user-service/
COPY apps/backend/chat-service/package.json apps/backend/chat-service/
COPY apps/backend/media-service/package.json apps/backend/media-service/
COPY apps/backend/notification-service/package.json apps/backend/notification-service/
COPY apps/backend/search-service/package.json apps/backend/search-service/
COPY libs/common/package.json libs/common/
COPY libs/backend/core/package.json libs/backend/core/
COPY libs/backend/auth/package.json libs/backend/auth/
COPY libs/backend/user/package.json libs/backend/user/
COPY libs/backend/chat/package.json libs/backend/chat/
COPY libs/backend/media/package.json libs/backend/media/
COPY libs/backend/notification/package.json libs/backend/notification/
COPY libs/backend/search/package.json libs/backend/search/

# Layer 2: Dependencies
RUN npm ci

# Layer 3: Source code
COPY . .

# Layer 4: Generate Prisma clients
RUN ./node_modules/.bin/prisma generate --config libs/backend/auth/prisma.config.ts && \
    ./node_modules/.bin/prisma generate --config libs/backend/user/prisma.config.ts && \
    ./node_modules/.bin/prisma generate --config libs/backend/chat/prisma.config.ts && \
    ./node_modules/.bin/prisma generate --config libs/backend/media/prisma.config.ts && \
    ./node_modules/.bin/prisma generate --config libs/backend/notification/prisma.config.ts

# Layer 5: Build @org/common (externalized by all webpack bundles)
RUN ./node_modules/.bin/tsc -p libs/common/tsconfig.build.json

# Layer 6: Sync TS project references, then build all backend apps
RUN ./node_modules/.bin/nx sync && \
    ./node_modules/.bin/nx build @org/gateway --skip-nx-cache && \
    ./node_modules/.bin/nx build @org/auth-service --skip-nx-cache && \
    ./node_modules/.bin/nx build @org/user-service --skip-nx-cache && \
    ./node_modules/.bin/nx build @org/chat-service --skip-nx-cache && \
    ./node_modules/.bin/nx build @org/media-service --skip-nx-cache && \
    ./node_modules/.bin/nx build @org/notification-service --skip-nx-cache && \
    ./node_modules/.bin/nx build @org/search-service --skip-nx-cache

# Layer 7: Prepare runtime assets (keep prisma CLI for migrations)
RUN node -e "const p=require('./package.json');p.dependencies.prisma=p.devDependencies.prisma;delete p.devDependencies.prisma;require('fs').writeFileSync('package.json',JSON.stringify(p,null,2))" && \
    npm prune --omit=dev && \
    mkdir /tmp/runtime && \
    cp -rL node_modules /tmp/runtime/node_modules

# ---- Stage 2: Runtime ----
FROM node:22-alpine

RUN apk add --no-cache postgresql-client curl tini

WORKDIR /app

# Copy built app bundles
COPY --from=builder /app/apps/backend/gateway/dist/main.js ./gateway/main.js
COPY --from=builder /app/apps/backend/auth-service/dist/main.js ./auth-service/main.js
COPY --from=builder /app/apps/backend/user-service/dist/main.js ./user-service/main.js
COPY --from=builder /app/apps/backend/chat-service/dist/main.js ./chat-service/main.js
COPY --from=builder /app/apps/backend/media-service/dist/main.js ./media-service/main.js
COPY --from=builder /app/apps/backend/notification-service/dist/main.js ./notification-service/main.js
COPY --from=builder /app/apps/backend/search-service/dist/main.js ./search-service/main.js

# Copy production node_modules (includes prisma CLI for migrations)
COPY --from=builder /tmp/runtime/node_modules ./node_modules

# Copy Prisma schemas and migrations for runtime migrations
COPY --from=builder /app/libs/backend/auth/prisma.config.ts ./libs/backend/auth/
COPY --from=builder /app/libs/backend/auth/src/database/prisma/schema.prisma ./libs/backend/auth/src/database/prisma/
COPY --from=builder /app/libs/backend/auth/src/database/prisma/migrations ./libs/backend/auth/src/database/prisma/migrations
COPY --from=builder /app/libs/backend/user/prisma.config.ts ./libs/backend/user/
COPY --from=builder /app/libs/backend/user/src/database/prisma/schema.prisma ./libs/backend/user/src/database/prisma/
COPY --from=builder /app/libs/backend/user/src/database/prisma/migrations ./libs/backend/user/src/database/prisma/migrations
COPY --from=builder /app/libs/backend/chat/prisma.config.ts ./libs/backend/chat/
COPY --from=builder /app/libs/backend/chat/src/database/prisma/schema.prisma ./libs/backend/chat/src/database/prisma/
COPY --from=builder /app/libs/backend/chat/src/database/prisma/migrations ./libs/backend/chat/src/database/prisma/migrations
COPY --from=builder /app/libs/backend/notification/prisma.config.ts ./libs/backend/notification/
COPY --from=builder /app/libs/backend/notification/src/database/prisma/schema.prisma ./libs/backend/notification/src/database/prisma/
COPY --from=builder /app/libs/backend/notification/src/database/prisma/migrations ./libs/backend/notification/src/database/prisma/migrations
COPY --from=builder /app/libs/backend/media/prisma.config.ts ./libs/backend/media/
COPY --from=builder /app/libs/backend/media/src/database/prisma/schema.prisma ./libs/backend/media/src/database/prisma/
COPY --from=builder /app/libs/backend/media/src/database/prisma/migrations ./libs/backend/media/src/database/prisma/migrations

# Copy generated Prisma clients (referenced at runtime)
COPY --from=builder /app/libs/backend/auth/src/database/prisma/generated ./libs/backend/auth/src/database/prisma/generated
COPY --from=builder /app/libs/backend/user/src/database/generated ./libs/backend/user/src/database/generated
COPY --from=builder /app/libs/backend/chat/src/database/generated ./libs/backend/chat/src/database/generated
COPY --from=builder /app/libs/backend/notification/src/database/generated ./libs/backend/notification/src/database/generated
COPY --from=builder /app/libs/backend/media/src/database/prisma/generated ./libs/backend/media/src/database/prisma/generated

# Copy start script
COPY docker/demo/start.sh ./

RUN chmod +x start.sh

EXPOSE 3000 3001 3002 3003 3004 3005 3006

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -s -o /dev/null http://localhost:${GATEWAY_PORT:-3000}/api || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./start.sh"]
