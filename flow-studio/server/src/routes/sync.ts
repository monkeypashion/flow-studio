import { Router, Request, Response } from 'express';

const router = Router();

const SYNC_API_BASE = 'http://localhost:8000';

// Proxy: Trigger sync job
router.post('/trigger', async (req: Request, res: Response) => {
  try {
    console.log('\n=== Proxying Sync Request ===');
    console.log('Payload:', JSON.stringify(req.body, null, 2));

    const response = await fetch(`${SYNC_API_BASE}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sync API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        message: 'Sync API request failed',
        error: errorText
      });
    }

    const result = await response.json();
    console.log('Sync API response:', result);
    console.log('================================\n');

    res.json(result);

  } catch (error: any) {
    console.error('Error proxying sync request:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to proxy sync request'
    });
  }
});

// Proxy: Get sync job status
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    console.log(`\n=== Getting Job Status: ${jobId} ===`);

    const response = await fetch(`${SYNC_API_BASE}/api/sync/${jobId}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Status API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        message: 'Status API request failed',
        error: errorText
      });
    }

    const result = await response.json();
    res.json(result);

  } catch (error: any) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get job status'
    });
  }
});

// Proxy: List recent jobs
router.get('/jobs', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit || 50;
    console.log(`\n=== Listing Recent Jobs (limit: ${limit}) ===`);

    const response = await fetch(`${SYNC_API_BASE}/api/jobs?limit=${limit}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Jobs API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        message: 'Jobs API request failed',
        error: errorText
      });
    }

    const result = await response.json();
    res.json(result);

  } catch (error: any) {
    console.error('Error listing jobs:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list jobs'
    });
  }
});

// Proxy: Get sync state info
router.get('/state/:syncKey', async (req: Request, res: Response) => {
  try {
    const { syncKey } = req.params;
    console.log(`\n=== Getting Sync State: ${syncKey} ===`);

    const response = await fetch(`${SYNC_API_BASE}/api/sync-state/${syncKey}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sync state API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        message: 'Sync state API request failed',
        error: errorText
      });
    }

    const result = await response.json();
    res.json(result);

  } catch (error: any) {
    console.error('Error getting sync state:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get sync state'
    });
  }
});

// Proxy: Delete sync state
router.delete('/state/:syncKey', async (req: Request, res: Response) => {
  try {
    const { syncKey } = req.params;
    console.log(`\n=== Deleting Sync State: ${syncKey} ===`);

    const response = await fetch(`${SYNC_API_BASE}/api/sync-state/${syncKey}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Delete sync state API error:', response.status, errorText);
      return res.status(response.status).json({
        success: false,
        message: 'Delete sync state API request failed',
        error: errorText
      });
    }

    const result = await response.json();
    res.json(result);

  } catch (error: any) {
    console.error('Error deleting sync state:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete sync state'
    });
  }
});

export default router;
