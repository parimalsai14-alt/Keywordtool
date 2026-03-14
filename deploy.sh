#!/bin/bash
# Run this on your VPS (after copying the project there)
set -e
echo "Building and starting Keyword Tool..."
docker compose up -d --build
echo "Done. Open http://$(hostname -I | awk '{print $1}'):3000 in your browser (or use your VPS IP)."
