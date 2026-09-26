import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({
    message: 'You are authenticated.',
    userId: req.user.id,
    email: req.user.email,
  });
});

export default router;