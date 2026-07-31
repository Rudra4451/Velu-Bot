# Use Node.js 22 alpine image for modern dependencies
FROM node:22-alpine AS builder

WORKDIR /app

# Install python3 and build tools for youtube-dl-exec and native packages
RUN apk add --no-cache python3 make g++

ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

# Copy package manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for building TypeScript)
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript to dist directory
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Install FFmpeg, Python3, and native build dependencies for audio playback
RUN apk add --no-cache ffmpeg python3 make g++

ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built dist files from builder stage
COPY --from=builder /app/dist ./dist

# Environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Start the bot
CMD ["npm", "start"]
