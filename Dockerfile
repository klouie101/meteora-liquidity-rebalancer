# Build stage
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set PNPM environment variables
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Set CI env variable to disable interactive prompts
ENV CI=true

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and configure it
RUN npm install -g pnpm
RUN pnpm config set auto-install-peers true
RUN pnpm config set strict-peer-dependencies false

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript code using the build script
RUN pnpm run build

# Create a temporary tsconfig for examples with adjusted rootDir
RUN echo '{"extends": "./tsconfig.json", "include": ["src/**/*", "examples/**/*"], "compilerOptions": {"rootDir": ".", "outDir": "./dist"}}' > tsconfig.examples.json

# Build examples
RUN npx tsc -p tsconfig.examples.json

# Production stage
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set PNPM environment variables and disable interactivity
ENV PNPM_HOME=/usr/local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true

# Install pnpm and configure it
RUN npm install -g pnpm
RUN pnpm config set auto-install-peers true
RUN pnpm config set strict-peer-dependencies false

# Copy package files, built code, and node_modules with bindings
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/node_modules ./node_modules/

# Create logs directory
RUN mkdir -p logs

# Set environment variables
ENV NODE_ENV=production

# Run the example with appropriate flags
CMD ["node", "--trace-warnings", "dist/examples/example.js"]