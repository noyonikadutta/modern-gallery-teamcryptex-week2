import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import Image from '../models/Image.js';

const router = Router();

router.get('/gallery', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '12', 10);
    const skip = (page - 1) * limit;
    const items = await Image.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const mapped = items.map((it) => ({
      id: it._id,
      title: it.title,
      uploader: it.uploaderName,
      imageUrl: it.imageUrl,
      likes: it.likes || 0,
      comments: (it.comments || []).length,
      isOwner: String(it.uploader) === String(req.user._id),
      timestamp: it.createdAt,
    }));

    return res.json({ items: mapped });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Failed to load gallery' });
  }
});

export default router;
