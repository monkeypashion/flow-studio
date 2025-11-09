import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';

const router = Router();

// Token cache - PER TENANT to avoid cross-tenant contamination
interface TokenCache {
  token: string;
  expiresAt: number;
}

const tokenCacheByTenant: Map<string, TokenCache> = new Map();

// Helper: Get OAuth token with caching (per-tenant)
async function getAccessToken(tenant: string, clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();

  // Create unique cache key for this tenant
  const cacheKey = `${tenant}_${clientId}`;

  // Reuse cached token if still valid (with 5-minute buffer)
  const cached = tokenCacheByTenant.get(cacheKey);
  if (cached && cached.expiresAt > now + (5 * 60 * 1000)) {
    console.log(`Using cached token for tenant: ${tenant}`);
    return cached.token;
  }

  console.log(`Fetching new token for tenant: ${tenant}...`);
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

    // Cache token for this tenant
    tokenCacheByTenant.set(cacheKey, {
      token,
      expiresAt: now + (expiresIn * 1000)
    });

    console.log(`Token cached for ${tenant}, expires in ${expiresIn} seconds`);
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
    // Use randomUUID to ensure unique group IDs even for the same asset
    const groupId = `group_${randomUUID()}`;

    const group = {
      id: groupId,
      name: asset.name,
      assetId: asset.assetId,
      expanded: false,  // Start collapsed
      visible: true,
      visibilityMode: 'explicit',
      index: assetIndex,
      aspects: [] as any[]
    };

    asset.aspects.forEach((aspect: any, aspectIndex: number) => {
      // Use randomUUID for aspects too
      const aspectId = `aspect_${randomUUID()}`;

      const aspectObj = {
        id: aspectId,
        groupId: group.id,
        name: aspect.name,
        aspectType: aspect.aspectTypeId,
        expanded: false,  // Start collapsed
        visible: true,
        visibilityMode: 'explicit',
        index: aspectIndex,
        tracks: [] as any[]
      };

      aspect.variables.forEach((variable: any, varIndex: number) => {
        // Use randomUUID for tracks too
        const trackId = `track_${randomUUID()}`;

        const track = {
          id: trackId,
          aspectId: aspectObj.id,
          name: variable.name,
          property: variable.name,
          unit: variable.unit || undefined,
          dataType: mapDataType(variable.dataType),
          index: varIndex,
          muted: false,
          locked: false,
          visible: true,
          visibilityMode: 'explicit',
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

// Route: Fetch asset types for a tenant
router.post('/types', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    console.log(`\n=== Fetching Asset Types ===`);
    console.log(`Tenant: ${tenantId}`);

    // Get access token
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);

    // Fetch asset types - include explicitOnly=false to get both core and tenant types
    const url = 'https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assettypes?explicitOnly=false&size=2000';
    console.log(`Calling: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Asset types fetch error:', response.status, errorText);
      throw new Error('Failed to fetch asset types');
    }

    const data = await response.json();
    const assetTypes = data._embedded?.assetTypes || [];

    console.log(`Found ${assetTypes.length} asset types`);

    // Log first asset type to see structure
    if (assetTypes.length > 0) {
      console.log('Sample asset type structure:', JSON.stringify(assetTypes[0], null, 2));
    }

    console.log(`===========================\n`);

    // Return asset types with parent info for hierarchy
    const types = assetTypes.map((at: any) => ({
      id: at.id,
      name: at.name,
      description: at.description || '',
      parentTypeId: at.parentTypeId || null  // Parent type for hierarchy
    }));

    res.json({
      success: true,
      assetTypes: types
    });

  } catch (error: any) {
    console.error('Error fetching asset types:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch asset types'
    });
  }
});

// Route: Fetch assets for a specific type
router.post('/by-type', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret, assetTypeId } = req.body;

    if (!tenantId || !clientId || !clientSecret || !assetTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret, assetTypeId'
      });
    }

    console.log(`\n=== Fetching Assets by Type ===`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Type: ${assetTypeId}`);

    // Get access token
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);

    // Fetch assets using the existing helper
    const assets = await getAssetsByType(assetTypeId, accessToken);

    console.log(`Found ${assets.length} assets`);
    console.log(`===============================\n`);

    // Return minimal asset info (no aspects yet)
    const assetList = assets.map((asset: any) => ({
      assetId: asset.assetId,
      name: asset.name,
      typeId: asset.typeId,
      description: asset.description || ''
    }));

    res.json({
      success: true,
      assets: assetList
    });

  } catch (error: any) {
    console.error('Error fetching assets by type:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch assets by type'
    });
  }
});

// Main route: Load assets (with aspects and variables)
router.post('/load', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret, assetTypeId, assetIds } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    console.log(`\n=== Loading Assets ===`);
    console.log(`Tenant: ${tenantId}`);

    // Step 1: Get access token
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);

    let assets: any[] = [];

    // Step 2: Get assets (either by IDs or by type)
    if (assetIds && Array.isArray(assetIds) && assetIds.length > 0) {
      // Load specific assets by ID
      console.log(`Loading ${assetIds.length} specific assets...`);

      for (const assetId of assetIds) {
        try {
          const url = `https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets/${assetId}`;
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const asset = await response.json();
            assets.push(asset);
            console.log(`  ✓ ${asset.name}`);
          } else {
            console.warn(`  ✗ Asset ${assetId} not found`);
          }
        } catch (error: any) {
          console.error(`  ✗ Error loading asset ${assetId}:`, error.message);
        }
      }
    } else {
      // Fallback: Load all assets by type (backward compatibility)
      const typeId = assetTypeId || 'spx.SPX_Generic_Industrial_Machine';
      console.log(`Loading all assets of type: ${typeId}`);
      assets = await getAssetsByType(typeId, accessToken);
    }

    console.log(`Found ${assets.length} assets`);

    if (assets.length === 0) {
      const response: any = {
        success: true,
        message: 'No assets found',
        groups: []
      };
      if (assetTypeId) {
        response.typeId = assetTypeId;
      }
      return res.json(response);
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
    const response: any = {
      success: true,
      message: 'Assets loaded successfully',
      totalAssets: groups.length,
      groups: groups
    };
    if (assetTypeId) {
      response.typeId = assetTypeId;
    }
    res.json(response);

  } catch (error: any) {
    console.error('Error loading assets:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load assets'
    });
  }
});

// Search assets using API filtering
router.post('/search', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret, searchTerm, typeId } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    if (!searchTerm || searchTerm.trim() === '') {
      return res.json({
        success: true,
        assets: []
      });
    }

    console.log(`\n=== Searching Assets ===`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Search term: ${searchTerm}`);

    // Get access token
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);

    // Build filter query
    const filter: any = {
      name: {
        contains: searchTerm
      }
    };

    // Add type filter if specified
    if (typeId) {
      filter.hasType = typeId; // Use hasType to include descendants
    }

    // Call Insights Hub API with filter
    const url = 'https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets';
    const params = new URLSearchParams({
      filter: JSON.stringify(filter),
      size: '100' // Return up to 100 results
    });

    console.log(`API URL: ${url}?${params.toString()}`);

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const assets = data._embedded?.assets || [];

    console.log(`Found ${assets.length} matching assets`);

    // Return simplified asset list with type path info
    const results = assets.map((asset: any) => ({
      assetId: asset.assetId,
      name: asset.name,
      typeId: asset.typeId,
      description: asset.description,
      parentId: asset.parentId
    }));

    res.json({
      success: true,
      assets: results,
      totalResults: data.page?.totalElements || assets.length
    });

  } catch (error: any) {
    console.error('Error searching assets:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search assets'
    });
  }
});

// Load all assets (paginated) for a tenant
router.post('/load-all', async (req: Request, res: Response) => {
  try {
    const { tenantId, clientId, clientSecret, maxAssets = 500 } = req.body;

    if (!tenantId || !clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tenantId, clientId, clientSecret'
      });
    }

    console.log(`\n=== Loading All Assets ===`);
    console.log(`Tenant: ${tenantId}`);
    console.log(`Max assets: ${maxAssets}`);

    // Get access token
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);

    // Fetch assets with pagination
    let allAssets: any[] = [];
    let page = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore && allAssets.length < maxAssets) {
      const url = 'https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets';
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString()
      });

      console.log(`Fetching page ${page}...`);

      const response = await fetch(`${url}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      const assets = data._embedded?.assets || [];

      allAssets.push(...assets);
      console.log(`  Retrieved ${assets.length} assets (total: ${allAssets.length})`);

      // Check if there are more pages
      hasMore = assets.length === pageSize && allAssets.length < maxAssets;
      page++;

      // Safety limit
      if (page >= 10) {
        console.log(`Reached page limit (10 pages)`);
        break;
      }
    }

    console.log(`Loaded ${allAssets.length} total assets`);

    // Return simplified asset list
    const results = allAssets.map((asset: any) => ({
      assetId: asset.assetId,
      name: asset.name,
      typeId: asset.typeId,
      description: asset.description,
      parentId: asset.parentId
    }));

    res.json({
      success: true,
      assets: results,
      totalAssets: allAssets.length
    });

  } catch (error: any) {
    console.error('Error loading all assets:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to load all assets'
    });
  }
});

export default router;
