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

# Copy project files
COPY . .

# Install Project Deps
RUN bun install

# Set entrypoint to run the screenshot generation script
ENTRYPOINT ["bun", "src/generate-screenshots.ts"]
