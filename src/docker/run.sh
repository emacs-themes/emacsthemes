#!/bin/bash
IMAGE_NAME="emacsthemes-local:latest"

if docker image inspect "$IMAGE_NAME" >/dev/null 2>&1; then
  echo "Using existing Docker image $IMAGE_NAME"
else
  echo "Docker image $IMAGE_NAME not found, building it..."
  # Build the image ensuring linux/amd64 platform
  # Using --progress=plain to ensure "DEBUG EMACS" logs from the smoke test are visible
  docker build --platform linux/amd64 --progress=plain -t emacsthemes-local -f src/docker/Dockerfile .
fi

echo "Starting screenshot generation in Docker..."
# Run the container with volume mount, removing the container after exit (with --rm)
docker run --rm --platform linux/amd64 -v "$(pwd)":/app -v /app/node_modules emacsthemes-local "$@"
