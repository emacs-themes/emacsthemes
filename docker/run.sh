#!/bin/bash
# Build the image ensuring linux/amd64 platform
docker build --platform linux/amd64 -t emacsthemes-local -f docker/Dockerfile .

# Run the container with volume mount, persisting the container after exit (no --rm)
docker run --platform linux/amd64 -v $(pwd):/app emacsthemes-local
