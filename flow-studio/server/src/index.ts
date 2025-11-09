import express from 'express';
import dotenv from 'dotenv';
import { corsMiddleware } from './middleware/cors';
import authRoutes from './routes/auth';
import assetsRoutes from './routes/assets';
import syncRoutes from './routes/sync';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/sync', syncRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Flow Studio Backend Server`);
  console.log(`   Running on: http://localhost:${PORT}`);
  console.log(`   Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5174'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
