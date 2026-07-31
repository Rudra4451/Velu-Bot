# Use official Node.js LTS alpine image for ultra-light production footprint
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies for building TypeScript)
RUN npm ci

# Copy source files
COPY . .

# Build TypeScript to dist directory
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install FFmpeg and Opus build dependencies for high-fidelity audio playback
RUN apk add --no-cache ffmpeg python3 make g++

COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built dist files from builder stage
COPY --from=builder /app/dist ./dist

# Environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

# Start the bot
CMD ["npm", "start"]
