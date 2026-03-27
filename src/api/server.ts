import express from 'express';
import { initDatabase } from './db';
import queueRoutes from './routes/queue';
import renderRoutes from './routes/render';

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(express.json());

// Routes
app.use('/api/queue', queueRoutes);
app.use('/api/render', renderRoutes);

// Health check
app.get('/api/status', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize
initDatabase();

app.listen(PORT, () => {
  console.log(`Video Pipeline API running on port ${PORT}`);
});

export default app;
