import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tracy-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;