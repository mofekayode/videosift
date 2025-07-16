#!/bin/bash

# Test cron job locally
echo "🧪 Testing cron job locally..."
curl http://localhost:3000/api/cron/process-channels

# Test on production (replace with your domain)
echo -e "\n\n🚀 Testing cron job on production..."
curl https://vidsift.com/api/cron/process-channels \
  -H "Authorization: Bearer $CRON_SECRET"