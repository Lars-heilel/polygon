#!/usr/bin/env bash
set -e

echo "Starting ngrok tunnel on port 4200..."
echo "Once the URL appears, open it on any device."
echo "Press Ctrl+C to stop."
echo ""

ngrok http 4200 --scheme=https
