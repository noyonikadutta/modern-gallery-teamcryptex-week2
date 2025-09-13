import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Image from '../models/Image.js';

const router = Router();

router.delete('/image/:id', auth, async (req, res) => {
  try {
    const img = await Image.findById(req.params.id);
    if (!img) return res.status(404).json({ message: 'Not found' });
    if (String(img.uploader) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' });
    await img.deleteOne();
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Delete failed' });
  }
});

router.post('/image/:id/like', auth, async (req, res) => {
  try {
    const img = await Image.findById(req.params.id);
    if (!img) return res.status(404).json({ message: 'Not found' });

    const uid = String(req.user._id);
    const hasLiked = img.likedBy.some((u) => String(u) === uid);
    if (hasLiked) {
      img.likedBy = img.likedBy.filter((u) => String(u) !== uid);
      img.likes = Math.max(0, (img.likes || 0) - 1);
    } else {
      img.likedBy.push(req.user._id);
      img.likes = (img.likes || 0) + 1;
    }
    await img.save();
    return res.json({ likes: img.likes });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Like failed' });
  }
});

router.post('/image/:id/comment', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: 'Missing comment text' });
    const img = await Image.findById(req.params.id);
    if (!img) return res.status(404).json({ message: 'Not found' });

    img.comments.push({ user: req.user._id, username: req.user.username, text });
    await img.save();
    return res.status(201).json({ count: img.comments.length });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Comment failed' });
  }
});

export default router;
