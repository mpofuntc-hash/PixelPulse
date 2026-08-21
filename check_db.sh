#!/bin/bash
cd ~/PixelPulse
node -e '
const Database = require("better-sqlite3");
const db = new Database("./data/pixelpulse.db");
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type=\"table\"").all();
console.log("Tables:", JSON.stringify(tables));
const cols = db.prepare("PRAGMA table_info(users)").all();
console.log("users columns:", JSON.stringify(cols));
const bmCols = db.prepare("PRAGMA table_info(betting_markets)").all();
console.log("betting_markets columns:", JSON.stringify(bmCols));
'
