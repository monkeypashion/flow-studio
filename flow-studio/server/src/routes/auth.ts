import { Router, Request, Response } from 'express';

const router = Router();

interface TestConnectionRequest {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

router.post('/test', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret } = req.body as TestConnectionRequest;

    // Validate request
    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    // Create base64 encoded authorization header
    const credentials = `${clientId}:${clientSecret}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');

    // Build URL with tenant ID
    const url = `https://${tenantId}.piam.eu1.mindsphere.io/oauth/token`;

    // Make the API request to MindSphere
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${base64Credentials}`,
      },
      body: new URLSearchParams({
        'grant_type': 'client_credentials'
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return res.json({
        success: true,
        message: 'Connection successful',
        data
      });
    } else {
      const errorText = await response.text();
      return res.status(response.status).json({
        success: false,
        message: `Authentication failed (${response.status}): ${errorText || 'Invalid credentials'}`
      });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    return res.status(500).json({
      success: false,
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  }
});

export default router;
