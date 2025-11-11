# Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy patches directory (required by pnpm-workspace.yaml)
COPY patches ./patches

# Install dependencies
RUN pnpm install --frozen-lockfile

# Install missing peer dependency for @nuxt/ui
RUN pnpm add -D tailwindcss@next

# Copy source files
COPY . .

# Build the application with increased memory limit and optimizations
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN pnpm run build

# Production stage
FROM node:22-alpine AS runner

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.19.0 --activate

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/.output /app/.output

# Expose port (Nuxt default is 3000)
EXPOSE 3000

# Set environment variables
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Start the application
CMD ["node", ".output/server/index.mjs"]
