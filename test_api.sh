#!/bin/bash
echo "=== Testing admin login ==="
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"chester.nt@zentriva.online","password":"123tryme"}'
echo ""
echo "=== Testing regular login ==="
curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"test"}'
echo ""
echo "=== Server log ==="
tail -20 ~/PixelPulse/server.log
