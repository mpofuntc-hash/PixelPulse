const { spawn } = require('child_process');
const path = require('path');
const { setTimeout: delay } = require('timers/promises');

const root = path.resolve(__dirname, '..');
const port = 3456;
const adminEmail = 'admin@local.test';
const adminPassword = 'Passw0rd!123';
const uniqueEmail = `smoke-${Date.now()}@local.test`;
const username = 'SmokeUser';

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`);
      if (res.ok) return;
    } catch (error) {
      // retry until server starts
    }
    await delay(250);
  }
  throw new Error('Server did not start in time');
}

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch (error) {
    payload = { raw: text };
  }
  return { status: res.status, payload };
}

(async () => {
  const env = {
    ...process.env,
    PORT: String(port),
    TELEGRAM_BOT_TOKEN: '',
    PANDASCORE_API_KEY: '',
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    NODE_ENV: 'test'
  };

  const child = spawn(process.execPath, ['src/index.js'], { cwd: root, env, stdio: 'inherit' });
  try {
    await waitForServer();

    const register = await jsonFetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'Sm0kePass!', username, isAdult: true })
    });
    if (register.status !== 200) throw new Error(`Register failed: ${JSON.stringify(register.payload)}`);

    const login = await jsonFetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: uniqueEmail, password: 'Sm0kePass!' })
    });
    if (login.status !== 200) throw new Error(`Login failed: ${JSON.stringify(login.payload)}`);

    const sessionToken = login.payload.sessionToken;
    const me = await jsonFetch(`http://127.0.0.1:${port}/api/auth/me`, {
      headers: { Authorization: `Bearer ${sessionToken}` }
    });
    if (me.status !== 200) throw new Error(`Auth me failed: ${JSON.stringify(me.payload)}`);

    const adminLogin = await jsonFetch(`http://127.0.0.1:${port}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    if (adminLogin.status !== 200) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.payload)}`);

    const profileUpdate = await jsonFetch(`http://127.0.0.1:${port}/api/profile/${me.payload.user.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ username, bio: 'Smoke test profile', cover_image: '', profile_image: '' })
    });
    if (profileUpdate.status !== 200) throw new Error(`Profile update failed: ${JSON.stringify(profileUpdate.payload)}`);

    const chatMessage = await jsonFetch(`http://127.0.0.1:${port}/api/chat/community`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({ message: 'Hello from smoke test' })
    });
    if (chatMessage.status !== 200) throw new Error(`Community chat failed: ${JSON.stringify(chatMessage.payload)}`);

    const clipUpload = await jsonFetch(`http://127.0.0.1:${port}/api/clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        title: 'Smoke Clip',
        description: 'Clip uploaded via smoke test',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        game_type: 'CS2',
        thumbnail_url: 'https://example.com/thumb.jpg'
      })
    });
    if (clipUpload.status !== 200) throw new Error(`Clip upload failed: ${JSON.stringify(clipUpload.payload)}`);

    console.log('Smoke tests passed');
  } finally {
    child.kill('SIGTERM');
  }
})();
