# Flow Studio Backend Server

Backend proxy server for Flow Studio to handle MindSphere API requests and bypass CORS restrictions.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment (optional):
```bash
# .env file is already created with defaults
PORT=3000
FRONTEND_URL=http://localhost:5174
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will run on `http://localhost:3000`

## Production

Build and start:
```bash
npm run build
npm start
```

## API Endpoints

### POST /api/auth/test
Test MindSphere tenant credentials.

**Request:**
```json
{
  "tenantId": "spx",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Connection successful",
  "data": { /* OAuth token response */ }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Authentication failed (401): Invalid credentials"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-14T22:00:00.000Z"
}
```

## Running Both Frontend and Backend

1. Terminal 1 - Backend:
```bash
cd server
npm run dev
```

2. Terminal 2 - Frontend:
```bash
cd ..
npm run dev
```

Frontend will be on `http://localhost:5174`
Backend will be on `http://localhost:3000`
