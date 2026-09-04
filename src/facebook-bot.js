const https = require('https');
const querystring = require('querystring');

const FB_PAGE_ID = process.env.FB_PAGE_ID || null;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || null;
const FB_GRAPH_VERSION = process.env.FB_GRAPH_VERSION || 'v18.0';

function graphRequest(path, method, data) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({ ...data, access_token: FB_PAGE_ACCESS_TOKEN });
    const options = {
      hostname: 'graph.facebook.com',
      path: `/${FB_GRAPH_VERSION}${path}`,
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(json.error?.message || `HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function isConfigured() {
  return !!(FB_PAGE_ID && FB_PAGE_ACCESS_TOKEN);
}

async function postToPage(message, opts = {}) {
  if (!isConfigured()) {
    console.warn('[Facebook] FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN not set, skipping feed post');
    return;
  }
  try {
    const data = { message };
    if (opts.link) data.link = opts.link;
    if (opts.published !== undefined) data.published = opts.published;
    const result = await graphRequest(`/${FB_PAGE_ID}/feed`, 'POST', data);
    console.log('[Facebook] Posted to page feed:', result.id);
    return result;
  } catch (err) {
    console.error('[Facebook] Failed to post to page feed:', err.message);
  }
}

async function postPhotoToPage(photoUrl, message) {
  if (!isConfigured()) {
    console.warn('[Facebook] FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN not set, skipping photo post');
    return;
  }
  if (!photoUrl) return postToPage(message);
  try {
    const result = await graphRequest(`/${FB_PAGE_ID}/photos`, 'POST', { url: photoUrl, message });
    console.log('[Facebook] Posted photo to page:', result.id);
    return result;
  } catch (err) {
    console.error('[Facebook] Failed to post photo:', err.message);
  }
}

async function postDiscussionToPage(title, body, link) {
  const message = `📢 ${title}\n\n${body}\n\n${link ? '🔗 ' + link : ''}`;
  return postToPage(message, { link });
}

async function postPollToPage(question, options) {
  const opts = (options || []).map((o, i) => `${i + 1}. ${o}`).join('\n');
  const message = `📊 POLL: ${question}\n\n${opts}\n\n👉 Vote by commenting the number below!`;
  return postToPage(message);
}

module.exports = {
  isConfigured,
  postToPage,
  postPhotoToPage,
  postDiscussionToPage,
  postPollToPage
};
