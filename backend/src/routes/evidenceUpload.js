import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadEvidenceFile } from '../services/storageService.js';
import { extractTextFromImage } from '../services/ocrService.js';
import { analyzeVideoEvidence } from '../services/videoAnalysisService.js';

const router = Router();

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 40 * 1024 * 1024; // 40MB — under Supabase's 50MB bucket ceiling

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// Multer needs one ceiling to allocate against — use the larger of the two,
// then enforce the correct per-type limit explicitly below.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE },
});

const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please wait before trying again.' },
});

function sanitizeFilename(name) {
  const base = name.replace(/^.*[\\/]/, '');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

router.post('/', requireAuth, uploadRateLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const evidenceType = req.body.evidence_type;
  if (!['screenshot', 'video'].includes(evidenceType)) {
    return res.status(400).json({ error: 'evidence_type must be screenshot or video' });
  }

  // --- Per-type size enforcement (multer's own limit only catches the
  //     video ceiling; images have a stricter limit checked here) ---
  const maxSize = evidenceType === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (req.file.size > maxSize) {
    return res.status(400).json({
      error: `File too large. ${evidenceType === 'video' ? 'Videos' : 'Images'} must be under ${Math.round(maxSize / (1024 * 1024))}MB.`,
    });
  }

  try {
    const detected = await fileTypeFromBuffer(req.file.buffer);

    if (!detected) {
      return res.status(400).json({ error: 'Could not verify file type. The file may be corrupted or is not a supported format.' });
    }

    const allowedTypes = evidenceType === 'screenshot' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    if (!allowedTypes.includes(detected.mime)) {
      return res.status(400).json({
        error: `File content does not match an allowed ${evidenceType} format. Detected: ${detected.mime}. Allowed: ${allowedTypes.join(', ')}`,
      });
    }

    let safeBuffer = req.file.buffer;
    let finalMime = detected.mime;

    if (evidenceType === 'screenshot') {
      safeBuffer = await sharp(req.file.buffer)
        .rotate()
        .toFormat('jpeg', { quality: 90 })
        .toBuffer();
      finalMime = 'image/jpeg';
    }
    // Video is not re-encoded here — magic-byte verification is the
    // primary safeguard for video in this milestone. Real processing
    // (transcription, frame analysis) arrives in Milestone 6.

    const safeFilename = sanitizeFilename(req.file.originalname);

    const storagePath = await uploadEvidenceFile({
      userId: req.user.id,
      fileBuffer: safeBuffer,
      originalName: safeFilename,
      mimeType: finalMime,
    });

    let ocrText = null;
    let videoAnalysisText = null;

    if (evidenceType === 'screenshot') {
      try {
        ocrText = await extractTextFromImage({
          fileBuffer: safeBuffer,
          originalName: safeFilename,
          mimeType: finalMime,
        });
      } catch (ocrErr) {
        console.error('OCR extraction failed (continuing without it):', ocrErr.message);
      }
    }

    if (evidenceType === 'video') {
      try {
        videoAnalysisText = await analyzeVideoEvidence({
          fileBuffer: safeBuffer,
          mimeType: finalMime,
        });
      } catch (videoErr) {
        console.error('Video analysis failed (continuing without it):', videoErr.message);
        // Upload still succeeds even if analysis fails — same honest
        // partial-result pattern as OCR.
      }
    }

    res.json({
      storage_path: storagePath,
      file_name: safeFilename,
      ocr_text: ocrText,
      video_analysis_text: videoAnalysisText,
    });
  } catch (err) {
    console.error('Evidence upload failed:', err.message);
    res.status(502).json({ error: 'Failed to process evidence file. Please try again.' });
  }
});

export default router;