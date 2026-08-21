const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'monitor.log');
const APP_LOG_FILE = path.join(__dirname, 'app.log');
const MAX_RESTARTS = 10;
const RESTART_WINDOW = 60000; // 1 minute
let restartCount = 0;
let restartTimes = [];

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

function cleanupOldRestarts() {
  const now = Date.now();
  restartTimes = restartTimes.filter(time => now - time < RESTART_WINDOW);
  restartCount = restartTimes.length;
}

function shouldRestart() {
  cleanupOldRestarts();
  return restartCount < MAX_RESTARTS;
}

function startApp() {
  log('Starting PixelPulse application...');
  
  const app = spawn('node', ['src/index.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env }
  });

  app.on('error', (err) => {
    log(`Failed to start app: ${err.message}`);
    scheduleRestart();
  });

  app.on('exit', (code, signal) => {
    log(`App exited with code ${code}, signal ${signal}`);
    
    if (code !== 0 && signal !== 'SIGTERM') {
      restartTimes.push(Date.now());
      restartCount++;
      
      if (shouldRestart()) {
        log(`Restarting app (restart ${restartCount}/${MAX_RESTARTS} in window)`);
        scheduleRestart();
      } else {
        log(`Too many restarts (${restartCount} in ${RESTART_WINDOW/1000}s). Stopping monitor.`);
        process.exit(1);
      }
    } else {
      log('App exited normally. Stopping monitor.');
      process.exit(0);
    }
  });

  return app;
}

function scheduleRestart() {
  setTimeout(() => {
    startApp();
  }, 5000); // Wait 5 seconds before restart
}

function healthCheck() {
  const http = require('http');
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/',
    method: 'GET',
    timeout: 5000
  };

  const req = http.request(options, (res) => {
    if (res.statusCode === 200) {
      log('Health check passed');
    } else {
      log(`Health check failed with status ${res.statusCode}`);
    }
  });

  req.on('error', (err) => {
    log(`Health check failed: ${err.message}`);
  });

  req.on('timeout', () => {
    log('Health check timed out');
    req.destroy();
  });

  req.end();
}

// Main monitoring loop
function startMonitoring() {
  log('Starting PixelPulse monitor...');
  
  // Start the app
  let app = startApp();
  
  // Health check every 30 seconds
  setInterval(() => {
    healthCheck();
  }, 30000);
  
  // Handle monitor shutdown
  process.on('SIGTERM', () => {
    log('Received SIGTERM. Shutting down monitor...');
    if (app) {
      app.kill('SIGTERM');
    }
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    log('Received SIGINT. Shutting down monitor...');
    if (app) {
      app.kill('SIGTERM');
    }
    process.exit(0);
  });
}

startMonitoring();
