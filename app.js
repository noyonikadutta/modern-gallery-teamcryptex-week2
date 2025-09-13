/* ============================
   app.js - Shared frontend logic
   Put this file in the same folder as your HTML pages.
   Edit API_BASE below to point to your backend (e.g. http://65.2.187.93)
   ============================ */

/*
  NOTES:
  - This file implements most of the app features client-side.
  - For each API call we first try a fetch to API_BASE; if it fails, we fallback to localStorage.
  - Many functions are commented with TODO: server so you know what to implement on backend.
*/

const API_BASE = window.API_BASE || 'http://65.2.187.93'; // <-- CHANGE if needed
const LOCAL_KEY = 'mg_images_v2';
const LOCAL_USERS = 'mg_users_v2';
const LOCAL_NOTIFS = 'mg_notifs_v2';
const LOCAL_FOLLOWS = 'mg_follows_v2';
const LOCAL_DRAFTS = 'mg_drafts_v2';
const IMAGES_PAGE_SIZE = 12;

// Helper: API request with fallback to localStorage
async function apiRequest(path, options = {}, fallbackToLocal = false) {
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    // If server unreachable, and fallback requested, simulate local
    if (fallbackToLocal) {
      console.warn('apiRequest fallback to local for', path, err.message);
      return simulateLocalApi(path, options);
    }
    throw err;
  }
}

// ---------- LocalStore simulation utilities (fallback) ----------
function loadLocalImages() {
  return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
}
function saveLocalImages(images) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(images));
}
function loadLocalUsers() {
  return JSON.parse(localStorage.getItem(LOCAL_USERS) || '[]');
}
function saveLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS, JSON.stringify(users));
}
function loadNotifs() {
  return JSON.parse(localStorage.getItem(LOCAL_NOTIFS) || '[]');
}
function saveNotifs(n) {
  localStorage.setItem(LOCAL_NOTIFS, JSON.stringify(n));
}

// Simulate a few API endpoints locally
function simulateLocalApi(path, options) {
  // very small router for local fallback
  const method = (options.method || 'GET').toUpperCase();
  if (path.startsWith('/gallery')) {
    // return paginated images from local
    const imgs = loadLocalImages();
    return {
      items: imgs,
      total: imgs.length
    };
  }
  if (path.startsWith('/upload') && method === 'POST') {
    // parse formdata (we can't parse real FormData easily here)
    // Options: we expected a FormData object; instead we handle upload via uploadImage()
    return { ok: false, message: 'Upload via local simulated function only' };
  }
  // likes
  if (path.match(/^\/images\/\d+\/like/)) {
    const id = Number(path.split('/')[2]);
    let imgs = loadLocalImages();
    const img = imgs.find(i => i.id === id);
    if (!img) return { message: 'not found' };
    img.likes = (img.likes || 0) + 1;
    saveLocalImages(imgs);
    return { likes: img.likes };
  }
  if (path.match(/^\/images\/\d+\/comment/) && method === 'POST') {
    const id = Number(path.split('/')[2]);
    const body = options.body ? JSON.parse(options.body) : {};
    let imgs = loadLocalImages();
    const img = imgs.find(i => i.id === id);
    if (!img) return { message: 'not found' };
    img.comments = img.comments || [];
    const comment = {
      id: Date.now(),
      text: body.text || 'local comment',
      user: localStorage.getItem('currentUser') || 'demo',
      createdAt: new Date().toISOString()
    };
    img.comments.push(comment);
    saveLocalImages(imgs);
    return { comment };
  }
  if (path === '/auth/login' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const users = loadLocalUsers();
    const user = users.find(u => u.email === body.email && u.password === body.password);
    if (user) return { token: `local-${user.email}`, user };
    return { message: 'Invalid credentials' };
  }
  if (path === '/auth/register' && method === 'POST') {
    const body = JSON.parse(options.body || '{}');
    const users = loadLocalUsers();
    if (users.find(u => u.email === body.email)) return { message: 'exists' };
    const newUser = { username: body.username, email: body.email, password: body.password, bio: '', avatar: '' };
    users.push(newUser);
    saveLocalUsers(users);
    return { token: `local-${body.email}`, user: newUser };
  }
  // default fallback
  return { message: 'unhandled', path };
}

// ---------- Auth helpers ----------
function isAuthenticated() {
  return !!localStorage.getItem('token');
}
function currentUser() {
  return localStorage.getItem('currentUser') || null;
}
async function login(email, password) {
  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    }, true);
    if (res.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('currentUser', res.user?.email || email);
      return { ok: true, user: res.user || { email } };
    }
    return { ok: false, message: res.message || 'Login failed' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
async function registerUser(username, email, password) {
  try {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    }, true);
    if (res.token) {
      localStorage.setItem('token', res.token);
      localStorage.setItem('currentUser', res.user?.email || email);
      return { ok: true, user: res.user || { email, username } };
    }
    return { ok: false, message: res.message || 'Register failed' };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
}

// ---------- Image operations ----------
/*
 image structure (normalized):
 {
   id: Number,
   title: String,
   description: String,
   uploader: String (email),
   imageUrl: String (s3 url or dataUrl),
   thumbUrl: String,
   tags: [String],
   album: 'album name' or id,
   privacy: 'public'|'private'|'unlisted',
   likes: Number,
   likedBy: [emails],
   comments: [ { id, text, user, createdAt, parentId } ],
   views: Number,
   createdAt: ISOString,
   exif: {...}
 }
*/

async function fetchGallery({ page = 1, limit = IMAGES_PAGE_SIZE, q = '', tag = '', album = '', sort = 'newest' } = {}) {
  // Try real API, else fallback to local
  try {
    const res = await apiRequest(`/gallery?page=${page}&limit=${limit}&q=${encodeURIComponent(q)}&tag=${encodeURIComponent(tag)}&album=${encodeURIComponent(album)}&sort=${sort}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    }, true);
    // If server returns {items, total}
    if (res.items) return res.items;
    // If server returns array
    if (Array.isArray(res)) return res;
    return [];
  } catch (e) {
    console.error('fetchGallery failed', e);
    return [];
  }
}

async function uploadImage({ files, title, description, tags = [], album = null, privacy = 'public', watermark = false, scheduleAt = null }) {
  // files: File[] or FileList
  // If backend supports /upload multipart, use it (with progress)
  if (!files || files.length === 0) throw new Error('No files provided');

  const token = localStorage.getItem('token');

  // If backend available, try real upload
  try {
    const form = new FormData();
    for (const f of files) form.append('images', f);
    form.append('title', title || '');
    form.append('description', description || '');
    form.append('tags', JSON.stringify(tags));
    form.append('album', album || '');
    form.append('privacy', privacy);
    form.append('watermark', watermark ? '1' : '0');
    if (scheduleAt) form.append('scheduleAt', scheduleAt);

    // Use fetch with progress: not all browsers give progress events for fetch; XHR needed for progress
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload`, true);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    return await new Promise((resolve, reject) => {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          // dispatch progress event for UI
          document.dispatchEvent(new CustomEvent('upload-progress', { detail: { pct } }));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const json = JSON.parse(xhr.responseText || '{}');
          resolve(json);
        } else {
          reject(new Error(`Upload failed ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload network error'));
      xhr.send(form);
    });
  } catch (err) {
    // Fallback: store image(s) locally
    console.warn('uploadImage fallback', err.message);
    let imgs = loadLocalImages();
    const readerPromises = Array.from(files).map(f => {
      return new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => {
          // Optionally apply watermark on client if requested
          if (watermark) {
            const watermarkedData = applyWatermarkToDataURL(reader.result, `${currentUser() || 'u'}`);
            res({ dataUrl: watermarkedData });
          } else res({ dataUrl: reader.result });
        };
        reader.onerror = rej;
        reader.readAsDataURL(f);
      });
    });
    const readers = await Promise.all(readerPromises);
    for (const r of readers) {
      const newImg = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title,
        description,
        uploader: localStorage.getItem('currentUser') || 'localuser',
        imageUrl: r.dataUrl,
        thumbUrl: r.dataUrl,
        tags,
        album,
        privacy,
        likes: 0,
        likedBy: [],
        comments: [],
        views: 0,
        createdAt: new Date().toISOString()
      };
      imgs.unshift(newImg);
    }
    saveLocalImages(imgs);
    // Notify UI
    document.dispatchEvent(new CustomEvent('upload-complete', { detail: { success: true } }));
    return { ok: true, items: imgs.slice(0, 10) };
  }
}

async function toggleLike(imageId) {
  const token = localStorage.getItem('token') || '';
  try {
    const res = await apiRequest(`/images/${imageId}/like`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }, true);
    return res;
  } catch (e) {
    // fallback handled in simulateLocalApi
    console.error(e);
    return null;
  }
}

async function postComment(imageId, text, parentId = null) {
  const token = localStorage.getItem('token') || '';
  try {
    const res = await apiRequest(`/images/${imageId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ text, parentId })
    }, true);
    // emit event to UI
    document.dispatchEvent(new CustomEvent('comment-added', { detail: { imageId, comment: res.comment } }));
    return res;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// edit metadata
async function editImageMetadata(imageId, metadata) {
  // TODO: backend endpoint PATCH /images/:id
  try {
    return await apiRequest(`/images/${imageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify(metadata)
    }, true);
  } catch (e) {
    // local fallback
    let imgs = loadLocalImages();
    const idx = imgs.findIndex(i => i.id == imageId);
    if (idx > -1) {
      imgs[idx] = { ...imgs[idx], ...metadata };
      saveLocalImages(imgs);
      return imgs[idx];
    }
    throw e;
  }
}

// delete image
async function deleteImageApi(imageId) {
  try {
    const res = await apiRequest(`/images/${imageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    }, true);
    // local fallback handled above
    return res;
  } catch (e) {
    console.error('deleteImageApi failed', e);
    return null;
  }
}

// Auto-tagging: call server or fallback
async function autotagBase64(base64) {
  try {
    const res = await apiRequest('/ai/autotag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ imageBase64: base64 })
    }, true);
    return res.tags || [];
  } catch (e) {
    // fallback: naive tags by keywords (demo)
    return ['demo', 'auto'];
  }
}

// NSFW check (server recommended)
async function nsfwCheck(base64) {
  try {
    const res = await apiRequest('/ai/nsfw', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`},
      body: JSON.stringify({ imageBase64: base64 })
    }, true);
    return res;
  } catch (e) {
    return { nsfwScore: 0.01, label: 'safe' };
  }
}

// watermark helper (canvas)
function applyWatermarkToDataURL(dataUrl, watermarkText = 'ImageGallery') {
  const img = new Image();
  img.src = dataUrl;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  // synchronous hack: create a promise that resolves onload
  // but we call createWatermark which returns a promise
  throw new Error('Use applyWatermarkAsync instead');
}
function applyWatermarkAsync(dataUrl, watermarkText='ImageGallery') {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      // watermark style
      ctx.font = `${Math.max(20, Math.round(w/40))}px Arial`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'right';
      ctx.fillText(watermarkText, w - 10, h - 10);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

// share link
async function shareImageLink(imageUrl) {
  try {
    await navigator.clipboard.writeText(imageUrl);
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

// download
function downloadDataUrl(dataUrl, filename='image.jpg') {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Reporting
async function reportImageApi(imageId, reason, details='') {
  try {
    const res = await apiRequest(`/images/${imageId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
      body: JSON.stringify({ reason, details })
    }, true);
    return res;
  } catch (e) {
    // local fallback store
    const reports = JSON.parse(localStorage.getItem('mg_reports')||'[]');
    reports.push({ id: Date.now(), imageId, reason, details, reporter: localStorage.getItem('currentUser') || 'local' });
    localStorage.setItem('mg_reports', JSON.stringify(reports));
    return { ok: true };
  }
}

// Follow/unfollow simulation
function followUser(targetUsername) {
  let follows = JSON.parse(localStorage.getItem(LOCAL_FOLLOWS) || '[]');
  const me = localStorage.getItem('currentUser') || 'local';
  let rec = follows.find(f => f.user === me);
  if (!rec) {
    rec = { user: me, following: [] };
    follows.push(rec);
  }
  if (!rec.following.includes(targetUsername)) rec.following.push(targetUsername);
  localStorage.setItem(LOCAL_FOLLOWS, JSON.stringify(follows));
  return true;
}
function unfollowUser(targetUsername) {
  let follows = JSON.parse(localStorage.getItem(LOCAL_FOLLOWS) || '[]');
  const me = localStorage.getItem('currentUser') || 'local';
  let rec = follows.find(f => f.user === me);
  if (rec) {
    rec.following = rec.following.filter(x => x !== targetUsername);
    localStorage.setItem(LOCAL_FOLLOWS, JSON.stringify(follows));
  }
  return true;
}

// Notifications (local)
function pushNotification({ title, body, url = null }) {
  const nots = loadNotifs();
  nots.unshift({ id: Date.now(), title, body, url, read: false, at: new Date().toISOString() });
  saveNotifs(nots);
  document.dispatchEvent(new CustomEvent('notifications-updated', { detail: nots }));
}

// Activity log
function pushActivity(text) {
  let act = JSON.parse(localStorage.getItem('mg_activity') || '[]');
  act.unshift({ ts: new Date().toISOString(), text });
  localStorage.setItem('mg_activity', JSON.stringify(act));
}

// Image view increment
async function incrementView(imageId) {
  try {
    await apiRequest(`/images/${imageId}/view`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } }, true);
  } catch (e) {
    // local fallback: increase views
    let imgs = loadLocalImages();
    const i = imgs.find(it => it.id == imageId);
    if (i) {
      i.views = (i.views || 0) + 1;
      saveLocalImages(imgs);
    }
  }
}

// Search helper
async function searchImages(q) {
  const imgs = loadLocalImages();
  if (!q) return imgs;
  q = q.toLowerCase();
  return imgs.filter(i => (i.title||'').toLowerCase().includes(q) || (i.description||'').toLowerCase().includes(q) || (i.tags || []).join(' ').toLowerCase().includes(q));
}

// Trending computation (client)
function computeTrending() {
  const imgs = loadLocalImages();
  // simplistic score: likes + sqrt(views) + recent weight
  return imgs.slice().sort((a,b) => ((b.likes||0) + Math.sqrt(b.views||0) + (new Date(b.createdAt).getTime()/1e12)) - ((a.likes||0) + Math.sqrt(a.views||0) + (new Date(a.createdAt).getTime()/1e12)));
}

// Infinite scroll utility
function attachInfiniteScroll(containerEl, loaderCb, threshold = 300) {
  window.addEventListener('scroll', () => {
    if ((window.innerHeight + window.scrollY) >= (document.body.offsetHeight - threshold)) {
      // reached near bottom
      loaderCb();
    }
  });
}

// Utility: format date
function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return `${Math.floor(diff/1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h`;
  return `${Math.floor(diff/86400000)}d`;
}

/* ------------------------------
   SERVICE WORKER / PWA (simple)
   ------------------------------ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(() => {
      console.log('sw registered');
    }).catch(()=>{});
  });
}

/* Export some helpers to global so pages can call them */
window.MG = {
  apiRequest, fetchGallery, uploadImage, toggleLike, postComment, editImageMetadata,
  deleteImageApi, autotagBase64, nsfwCheck, applyWatermarkAsync, shareImageLink, downloadDataUrl,
  reportImageApi, followUser, unfollowUser, pushNotification, pushActivity, incrementView, searchImages,
  attachInfiniteScroll, computeTrending, isAuthenticated, login, registerUser, logout, loadLocalImages
};
