import { Router, Request, Response } from 'express';

const router = Router();

// Token cache
interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

// Helper: Get OAuth token with caching
async function getAccessToken(tenant: string, clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();

  // Reuse cached token if still valid (with 5-minute buffer)
  if (tokenCache && tokenCache.expiresAt > now + (5 * 60 * 1000)) {
    console.log('Using cached token');
    return tokenCache.token;
  }

  console.log('Fetching new token...');
  const tokenUrl = `https://${tenant}.piam.eu1.mindsphere.io/oauth/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token error:', response.status, errorText);
      throw new Error('Failed to get access token');
    }

    const data = await response.json();
    const token = data.access_token;
    const expiresIn = data.expires_in || 1800; // Default 30 minutes

    // Cache token
    tokenCache = {
      token,
      expiresAt: now + (expiresIn * 1000)
    };

    console.log(`Token cached, expires in ${expiresIn} seconds`);
    return token;
  } catch (error: any) {
    console.error('Token error:', error.message);
    throw new Error('Failed to get access token');
  }
}

// Helper: Get assets by type
async function getAssetsByType(typeId: string, accessToken: string): Promise<any[]> {
  const filter = { hasType: typeId };
  const encodedFilter = encodeURIComponent(JSON.stringify(filter));
  const url = `https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets?filter=${encodedFilter}&size=100`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Assets fetch error:', response.status, errorText);
      throw new Error('Failed to fetch assets');
    }

    const data = await response.json();

    if (data._embedded && data._embedded.assets) {
      return data._embedded.assets;
    }

    return [];
  } catch (error: any) {
    console.error('Assets fetch error:', error.message);
    throw new Error('Failed to fetch assets');
  }
}

// Helper: Get aspects for an asset
async function getAssetAspects(asset: any, accessToken: string): Promise<any> {
  if (!asset._links || !asset._links.aspects) {
    console.warn(`No aspects link for asset ${asset.name}`);
    return null;
  }

  const aspectsUrl = asset._links.aspects.href + '?size=100';

  try {
    const response = await fetch(aspectsUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Aspects fetch error for ${asset.name}:`, response.status, errorText);
      return null;
    }

    const data = await response.json();

    const assetInfo = {
      assetId: asset.assetId,
      name: asset.name,
      description: asset.description,
      timezone: asset.timezone,
      parentId: asset.parentId,
      typeId: asset.typeId,
      location: asset.location,
      aspects: [] as any[]
    };

    if (data._embedded && data._embedded.aspects) {
      for (const aspect of data._embedded.aspects) {
        const variables = aspect.variables || [];

        assetInfo.aspects.push({
          aspectId: aspect.aspectId,
          aspectTypeId: aspect.aspectTypeId,
          name: aspect.name,
          variables: variables.map((v: any) => ({
            name: v.name,
            dataType: v.dataType,
            unit: v.unit || '',
            searchable: v.searchable,
            length: v.length,
            qualityCode: v.qualityCode
          }))
        });
      }
    }

    return assetInfo;
  } catch (error: any) {
    console.error(`Aspects fetch error for ${asset.name}:`, error.message);
    return null;
  }
}

// Data type mapping: MindSphere → Flow Studio
function mapDataType(mindSphereType: string): string {
  const typeMap: Record<string, string> = {
    'BOOLEAN': 'Boolean',
    'INT': 'Int',
    'LONG': 'Long',
    'DOUBLE': 'Double',
    'STRING': 'String',
    'BIG_STRING': 'Big_string',
    'TIMESTAMP': 'Timestamp'
  };

  return typeMap[mindSphereType] || 'String';
}

// Transform MindSphere data to Flow Studio structure
function transformToFlowStudioStructure(assets: any[]): any[] {
  return assets.map((asset, assetIndex) => {
    const group = {
      id: `group_${asset.assetId}`,
      name: asset.name,
      assetId: asset.assetId,
      expanded: true,
      visible: true,
      index: assetIndex,
      aspects: [] as any[]
    };

    asset.aspects.forEach((aspect: any, aspectIndex: number) => {
      const aspectObj = {
        id: `aspect_${aspect.aspectId}`,
        groupId: group.id,
        name: aspect.name,
        aspectType: aspect.aspectTypeId,
        expanded: true,
        visible: true,
        index: aspectIndex,
        tracks: [] as any[]
      };

      aspect.variables.forEach((variable: any, varIndex: number) => {
        const track = {
          id: `track_${aspect.aspectId}_${variable.name}`,
          aspectId: aspectObj.id,
          name: variable.name,
          property: variable.name,
          unit: variable.unit || undefined,
          dataType: mapDataType(variable.dataType),
          index: varIndex,
          muted: false,
          locked: false,
          visible: true,
          height: 80,
          clips: []
        };

        aspectObj.tracks.push(track);
      });

      group.aspects.push(aspectObj);
    });

    return group;
  });
}

// Main route: Load assets
router.post('/load', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret, assetTypeId } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    const typeId = assetTypeId || 'spx.SPX_Generic_Industrial_Machine';

    console.log(`\n=== Loading Assets ===`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Type: ${typeId}`);

    // Step 1: Get access token
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);

    // Step 2: Get assets
    console.log(`Fetching assets...`);
    const assets = await getAssetsByType(typeId, accessToken);
    console.log(`Found ${assets.length} assets`);

    if (assets.length === 0) {
      return res.json({
        success: true,
        message: 'No assets found',
        typeId: typeId,
        groups: []
      });
    }

    // Step 3: Get aspects for each asset
    console.log('Fetching aspects for each asset...');
    const consolidatedAssets = [];

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      console.log(`${i + 1}/${assets.length}: ${asset.name}`);

      const assetWithAspects = await getAssetAspects(asset, accessToken);
      if (assetWithAspects) {
        consolidatedAssets.push(assetWithAspects);
      }
    }

    // Step 4: Transform to Flow Studio structure
    console.log('Transforming data...');
    const groups = transformToFlowStudioStructure(consolidatedAssets);

    console.log(`Complete! Loaded ${groups.length} groups`);
    console.log(`======================\n`);

    // Return results
    res.json({
      success: true,
      message: 'Assets loaded successfully',
      typeId: typeId,
      totalAssets: groups.length,
      groups: groups
    });

  } catch (error: any) {
    console.error('Error loading assets:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load assets'
    });
  }
});

export default router;
