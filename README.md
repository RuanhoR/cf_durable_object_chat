# HauChat

A real-time chat application built with Cloudflare Workers, Durable Objects (SQLite), and Vue.js.

## Architecture

- **Backend**: Cloudflare Workers with Durable Objects (SQLite storage)
- **Frontend**: Vue.js 3 + Vite + vue-router
- **Auth**: OAuth 2.0 proxied through the Worker (bypass CORS)
- **Real-time**: WebSocket via Durable Objects
- **Database**: SQLite embedded in Durable Objects (single "main" instance)

## Project Structure

```
├── src/
│   ├── index.ts          # Worker entry point + API routes
│   ├── chat-do.ts        # Durable Object with SQLite operations
│   ├── config.ts         # Worker-side config (non-secret)
│   ├── framework.ts      # ResponseFrame HTTP router
│   ├── framework-utils/  # HTTP utilities
│   └── types.ts          # Shared types
├── frontend/
│   ├── src/
│   │   ├── App.vue           # Root layout
│   │   ├── components/       # Vue components
│   │   ├── utils/            # Login, request, storage helpers
│   │   ├── i18n/             # zh.json + en.json translations
│   │   ├── router/           # Vue Router setup
│   │   └── config.ts         # Frontend-side config
│   ├── index.html
│   └── vite.config.ts
├── wrangler.example.jsonc # Wrangler config template (copy to wrangler.jsonc)
├── worker-configuration.d.ts # TypeScript types for Worker env bindings
└── package.json
```

## Setup

### Prerequisites

- Node.js >= 20
- pnpm
- A Cloudflare account with Workers paid plan (for Durable Objects SQLite)
- A Supabase project (for user management) or a compatible OAuth provider

### Installation

```bash
pnpm install
cd frontend && pnpm install && cd ..
```

### Configuration

1. Copy the wrangler config template and fill in your values:

```bash
cp wrangler.example.jsonc wrangler.jsonc
```

2. Set the required vars in `wrangler.jsonc`:
   - `API_BASE`: Your API base URL
   - `OAUTH_CLIENT_ID`: OAuth client ID
   - `OAUTH_REDIRECT_URI`: OAuth callback URL

3. Update `frontend/src/config.ts` with your frontend-specific config.

### Development

```bash
# Start the Worker locally
pnpm dev

# Start frontend dev server (separate terminal)
pnpm frontend:dev

# Generate TypeScript types from wrangler config
pnpm cf-typegen
```

### Deploy

```bash
# Build frontend and deploy Worker
pnpm deploy
```

### Lint

```bash
pnpm lint
```

### Test

```bash
pnpm test
```

## API Endpoints

All API routes require `Authorization: Bearer <token>` header (except OAuth endpoints).

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/oauth/token` | Proxy OAuth token exchange |
| POST | `/api/auth/logout` | Proxy logout |
| GET | `/api/user/info` | Get current user info |
| GET | `/api/user/profile?uid=N` | Get user profile |
| GET | `/api/chat/rooms` | Get user's rooms |
| GET | `/api/chat/rooms/all` | List all rooms |
| POST | `/api/chat/rooms/create` | Create a room |
| POST | `/api/chat/rooms/join` | Join a room |
| POST | `/api/chat/rooms/leave` | Leave a room |
| GET | `/api/chat/rooms/members?room_id=N` | Get room members |
| POST | `/api/chat/rooms/update` | Update room settings |
| POST | `/api/chat/rooms/dissolve` | Dissolve a room |
| POST | `/api/chat/rooms/mute` | Mute a member |
| POST | `/api/chat/rooms/unmute` | Unmute a member |
| POST | `/api/chat/rooms/role` | Set member role |
| POST | `/api/chat/rooms/private` | Create private chat |
| GET | `/api/chat/rooms/private/list` | List private chats |
| GET | `/api/chat/rooms/private/peer?room_id=N` | Get private chat peer |
| GET | `/api/chat/messages?room_id=N` | Get room messages |
| POST | `/api/chat/messages/send` | Send a message |
| GET | `/api/chat/rooms/search?q=QUERY` | Search rooms |
| GET | `/api/chat/users/search?q=QUERY` | Search users |
| WS | `/api/chat/ws?room_id=N&token=TOKEN` | WebSocket real-time connection |

## WebSocket Protocol

Connect to `wss://your-domain/api/chat/ws?room_id=N&token=TOKEN`.

Server pushes JSON events:
- `{ "type": "new_message", "message": ChatMessage }`
- `{ "type": "member_joined", "user_id": number }`
- `{ "type": "role_updated", "user_id": number, "role": string }`

## Features

- Room-based group chat with owner/admin/member roles
- Private chat (1-on-1, auto-creates on first message)
- Real-time message delivery via WebSocket
- Markdown message rendering (headers, bold, italic, code blocks, links)
- Member mute/unmute with duration
- Room search and user search
- Dark mode
- i18n (Chinese / English)
- Mobile-responsive layout
- OAuth 2.0 authentication

## License

MIT
