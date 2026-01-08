#!/bin/bash
# Build the image ensuring linux/amd64 platform
docker build --platform linux/amd64 -t emacsthemes-local -f src/docker/Dockerfile .

# Run the container with volume mount, removing the container after exit (with --rm)
docker run --rm --platform linux/amd64 -v $(pwd):/app -v /app/node_modules emacsthemes-local