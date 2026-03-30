# Setup

## Prerequisites

- Docker & Docker Compose
- Node.js 20.x
- npm

---

## 1. Environment Variables

```bash
cp .env.example .env
```

All services share a single `.env` at the repository root. Configure it for your local environment — all variables and descriptions are in `.env.example`.

---

## 2. Bootstrap

Run once after cloning:

```bash
./scripts/bootstrap.sh
```

What it does:
1. Checks Docker and Docker Compose availability
2. Starts containers (PostgreSQL, Redis, RabbitMQ)
3. Creates a database for each service
4. Generates Prisma clients for all backend services
5. Applies Prisma migrations

> ⚠️ Run only once after cloning. Re-running `init-db.sh` will delete all database data.

### Infrastructure

| Service    | Port(s)      | Purpose                                          |
| ---------- | ------------ | ------------------------------------------------ |
| PostgreSQL | 5432         | Primary database                                 |
| Redis      | 6379         | Cache                                            |
| RabbitMQ   | 5672 / 15672 | Message broker — UI at http://localhost:15672    |

---

## 3. Running Dev Servers

```bash
# Terminal 1 — API Gateway (port 3000)
npx nx serve @org/gateway

# Terminal 2 — React SPA (port 4200)
npx nx serve @org/messenger
```

App is available at **http://localhost:4200**.

> The Vite dev server proxies `/api` and `/socket.io` to the gateway on `localhost:3000` — only port 4200 needs to be exposed or tunneled.

---

## 4. Remote Testing (ngrok)

To test on other devices (phone, tablet, another machine) over the internet:

**Prerequisites:** [ngrok](https://ngrok.com) installed and authenticated.

```bash
ngrok config add-authtoken <your-token>
```

**Start the tunnel** (while dev servers are already running):

```bash
./scripts/tunnel.sh
```

ngrok will print a public HTTPS URL like `https://xxxx-xx-xx.ngrok-free.app` — open it on any device.

Vite's dev proxy handles all API and WebSocket traffic internally, so no extra configuration is needed.

> The public URL changes on every ngrok restart (free tier). A paid plan gives a fixed domain.
