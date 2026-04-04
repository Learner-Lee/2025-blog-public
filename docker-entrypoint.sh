#!/bin/sh
set -e

# On first run (empty volume), copy initial blog content to the mounted data directory
if [ -z "$(ls -A /app/public/blogs 2>/dev/null)" ]; then
  echo "Initializing blog data..."
  cp -r /app/public-initial/blogs/. /app/public/blogs/
  echo "Blog data initialized."
fi

# On first run, copy initial config/data JSON files
if [ -z "$(ls -A /app/public/data 2>/dev/null)" ]; then
  echo "Initializing config data..."
  cp -r /app/public-initial/data/. /app/public/data/
  echo "Config data initialized."
fi

# On first run, copy initial images
if [ -z "$(ls -A /app/public/images 2>/dev/null)" ]; then
  echo "Initializing images..."
  cp -r /app/public-initial/images/. /app/public/images/
  echo "Images initialized."
fi

exec "$@"
