import { Router } from 'express';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { getS3, S3_BUCKET } from '../config/s3.js';
import { auth } from '../middleware/auth.js';
import Image from '../models/Image.js';

const router = Router();
const s3 = getS3();

const upload = multer({
  storage: multerS3({
    s3,
    bucket: S3_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const ext = file.originalname.split('.').pop();
      const key = `uploads/${req.user._id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      cb(null, key);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !req.file) return res.status(400).json({ message: 'Missing title or file' });

    const image = await Image.create({
      title,
      description,
      uploader: req.user._id,
      uploaderName: req.user.username,
      imageUrl: req.file.location,
    });

    return res.status(201).json({ id: image._id, imageUrl: image.imageUrl });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

export default router;
