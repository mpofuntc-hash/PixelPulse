#!/bin/bash
pkill -f node 2>/dev/null
sleep 2
cd ~/PixelPulse
node src/index.js > server.log 2>&1 &
sleep 5
head -10 server.log
echo "---"
curl -s http://localhost:3000/api/admin/fee-pool
echo ""
echo "---"
curl -s http://localhost:3000/ | head -3
