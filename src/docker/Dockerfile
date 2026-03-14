FROM debian:sid-slim

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install System Dependencies & Emacs 30.2
RUN apt-get update && \
    apt-get install -y bash ca-certificates curl unzip xvfb imagemagick fonts-dejavu-core git emacs && \
    rm -rf /var/lib/apt/lists/*

# Install Bun
ENV BUN_INSTALL=/root/.bun
ENV PATH=$BUN_INSTALL/bin:$PATH
RUN curl -fsSL --retry 3 --output /tmp/bun-install.sh https://bun.sh/install && \
    bash /tmp/bun-install.sh && \
    rm -f /tmp/bun-install.sh

# Set working directory
WORKDIR /app

# Copy dependency definitions
COPY package.json bun.lock ./

# Install Project Deps
RUN bun ci

# Copy project files
COPY . .

# Set entrypoint to run the screenshot generation script
ENTRYPOINT ["bun", "src/core/generate-screenshots.ts"]
