const express = require('express');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const mongoose = require('mongoose');
const exifr = require('exifr');

const router = express.Router();

const mongoUri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB || undefined;

const storage = new GridFsStorage({
  url: mongoUri,
  options: { dbName },
  file: (req, file) => {
    return {
      bucketName: 'uploads',
      filename: `${Date.now()}-${file.originalname}`
    };
  }
});

const upload = multer({ storage });

const ReportSchema = new mongoose.Schema({
  filename: String,
  fileId: mongoose.Schema.Types.ObjectId,
  mimetype: String,
  size: Number,
  userId: String,
  latitude: Number,
  longitude: Number,
  distanceKm: Number,
  createdAt: { type: Date, default: Date.now }
});

const Report = mongoose.models.Report || mongoose.model('Report', ReportSchema);

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    // extract EXIF GPS
    let latitude = null, longitude = null;
    try {
      const gps = await exifr.gps(file.stream || file);
      if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
        latitude = gps.latitude;
        longitude = gps.longitude;
      }
    } catch (_) {}

    const doc = await Report.create({
      filename: file.filename,
      fileId: file.id,
      mimetype: file.mimetype,
      size: file.size,
      userId: (req.user && req.user.id) || null,
      latitude,
      longitude
    });

    return res.json({ success: true, report: doc });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;


