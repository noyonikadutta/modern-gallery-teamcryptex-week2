// server/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectMongo } from './config/mongo.js';
import authRoutes from './routes/auth.js';
import uploadRoutes from './routes/upload.js';
import galleryRoutes from './routes/gallery.js';
import imageRoutes from './routes/image.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === Middleware ===
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req, res, next) => {
  console.log(`📥 Request: ${req.method} ${req.url}`);
  next();
});

// === Static frontend path ===
const staticPath = path.join(__dirname, '../public');

// === Force "/" to serve register.html ===
app.get('/', (req, res) => {
  const target = path.join(staticPath, 'register.html');
  console.log('➡️ Serving root page:', target);
  res.sendFile(target, (err) => {
    if (err) {
      console.error('❌ Error sending register.html', err);
      res.status(500).send('Failed to load signup page');
    }
  });
});

// === Friendly static page aliases ===
app.get('/login', (req, res) => res.sendFile(path.join(staticPath, 'login.html')));
app.get('/gallery', (req, res) => res.sendFile(path.join(staticPath, 'gallery.html')));
app.get('/upload', (req, res) => res.sendFile(path.join(staticPath, 'upload.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(staticPath, 'profile.html')));
app.get('/grid', (req, res) => res.sendFile(path.join(staticPath, 'grid.html')));

// Serve static assets (css/js/icons/images)
app.use(express.static(staticPath, { index: false }));

// === API routes ===
app.use('/', authRoutes);          // includes POST /register, POST /login
app.use('/upload', uploadRoutes);
app.use('/gallery', galleryRoutes);
app.use('/image', imageRoutes);

// === 404 fallback ===
app.use((req, res) => {
  res.status(404).send('Not found');
});

// === Start server ===
const PORT = process.env.PORT || 5000;
connectMongo()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to start server', err);
    process.exit(1);
  });
