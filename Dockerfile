# ==========================================
# Stage 1: Build Phase
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definition files to leverage Docker layer caching
COPY package.json package-lock.json* bun.lockb* pnpm-lock.yaml* ./

# Install all dependencies (including devDependencies required for build)
RUN npm ci || npm install

# Copy the rest of the application source code
COPY . .

# Build the TanStack Start / Nitro application (outputs to .output directory)
RUN npm run build

# ==========================================
# Stage 2: Production Runner Phase
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy only the compiled build artifacts from the builder stage
COPY --from=builder /app/.output ./.output

EXPOSE 3000

# Start the application server from the generated build artifact
CMD ["node", ".output/server/index.mjs"]
