# LootChat Frontend

Modern chat UI built with Nuxt 4 and Vue 3.

## Tech Stack

- **Nuxt 4.2** (Vue 3, TypeScript)
- **Nuxt UI** for components
- **Pinia** for state management
- **WebSocket** for real-time messaging

## Setup

```bash
pnpm install
pnpm dev
```

Frontend runs on `http://localhost:3000`

## Features

- Real-time messaging
- Channel management
- User authentication
- File uploads (images, GIFs)
- Voice channels
- Emoji/reaction support
- Dark mode

## Environment Variables

Create `.env`:

```bash
NUXT_SESSION_PASSWORD=your-session-secret
NUXT_PUBLIC_API_URL=http://localhost:8080
NUXT_PUBLIC_TENOR_API_KEY=your-tenor-key
```
