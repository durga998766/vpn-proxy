// server.js
require('dotenv').config();
const express = require('express');
const httpProxy = require('http-proxy');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');

const app = express();
const proxy = httpProxy.createProxyServer({});
const PORT = process.env.PORT || 5000;

// Basic security & logging
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Helper: extract & validate target from /p/<encoded-url>
function getTarget(req) {
  const encoded = req.params.url;
  if (!encoded) return null;
  let decoded;
  try { decoded = decodeURIComponent(encoded); } catch { return null; }
  try {
    const u = new URL(decoded);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.toString();
  } catch (e) { return null; }
}

// Proxy route — Express 4 syntax supports :url(*)
app.use('/p/:url(*)', (req, res) => {
  const target = getTarget(req);
  if (!target) return res.status(400).send('Invalid target URL');

  proxy.web(req, res, {
    target,
    changeOrigin: true,
    secure: true,
    ignorePath: true,
    followRedirects: true
  }, (err) => {
    console.error('Proxy error:', err && err.message);
    if (!res.headersSent) res.status(502).send('Upstream proxy error');
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Simple VPN proxy running at http://localhost:${PORT}`);
  console.log('Open http://localhost:' + PORT + ' in browser');
});
