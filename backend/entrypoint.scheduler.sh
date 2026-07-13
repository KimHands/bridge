#!/bin/sh
set -e

echo "Starting scheduler process (single instance)..."
exec python -m app.run_scheduler
