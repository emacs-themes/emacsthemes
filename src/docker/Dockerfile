FROM debian:bookworm-slim

# Install System Dependencies & Emacs
# We install 'emacs' which pulls in the GUI version (emacs-gtk or similar) on Debian.
RUN apt-get update && \
    apt-get install -y curl unzip xvfb imagemagick fonts-dejavu-core git emacs && \
    rm -rf /var/lib/apt/lists/*

# Install Bun
ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH
RUN curl -fsSL https://bun.sh/install | bash

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package.json bun.lock ./

# Install Project Deps
RUN bun ci

# Copy project files
COPY . .

# Validate recipes during build (shows logs in docker build)
RUN bun run validate

# Smoke test: Generate screenshots for a single theme during build to ensure 
# logs are forwarded and the environment is functional.
RUN bun src/core/generate-screenshots.ts almost-mono-black --force

# Set entrypoint to run the screenshot generation script
ENTRYPOINT ["bun", "src/core/generate-screenshots.ts"]
