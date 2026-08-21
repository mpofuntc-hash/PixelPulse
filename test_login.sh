#!/bin/bash
curl -s -X POST http://localhost:3000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"chester.nt@zentriva.online","password":"123tryme"}'
echo ""
