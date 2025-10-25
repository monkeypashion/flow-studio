import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables BEFORE reading them
dotenv.config();

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5174';

export const corsMiddleware = cors({
  origin: frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
