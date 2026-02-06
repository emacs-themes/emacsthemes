#!/bin/bash
# Build the image ensuring linux/amd64 platform
# Using --progress=plain to ensure "DEBUG EMACS" logs from the smoke test are visible
docker build --platform linux/amd64 --progress=plain -t emacsthemes-local -f src/docker/Dockerfile .

echo "Starting screenshot generation in Docker..."
# Run the container with volume mount, removing the container after exit (with --rm)
docker run --rm --platform linux/amd64 -v $(pwd):/app -v /app/node_modules emacsthemes-local