# Insights Hub Asset Management API Guide
## Complete Guide for Building Asset Structure with Node.js/Express

**Purpose**: This document explains how to authenticate with Insights Hub and retrieve a complete asset structure (Assets → Aspects → Variables) using the Asset Management API v3.

**Target**: Node.js/Express backend server implementation

---

## Table of Contents
1. [Authentication Flow](#authentication-flow)
2. [Asset Management API Overview](#asset-management-api-overview)
3. [Step-by-Step Implementation](#step-by-step-implementation)
4. [Complete Node.js Code Example](#complete-nodejs-code-example)
5. [API Reference](#api-reference)
6. [Common Errors & Solutions](#common-errors--solutions)
7. [Best Practices](#best-practices)

---

## Authentication Flow

### 1. OAuth2 Client Credentials Grant

Insights Hub uses OAuth2 client credentials flow for service-to-service authentication.

**Endpoint**: `https://{tenant}.piam.eu1.mindsphere.io/oauth/token`

**Method**: POST

**Headers**:
```
Content-Type: application/x-www-form-urlencoded
```

**Body** (form-urlencoded):
```
grant_type=client_credentials
client_id={your_client_id}
client_secret={your_client_secret}
```

**Example with Node.js (axios)**:
```javascript
const axios = require('axios');

async function getAccessToken(tenant, clientId, clientSecret) {
  const tokenUrl = `https://${tenant}.piam.eu1.mindsphere.io/oauth/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  const response = await axios.post(tokenUrl, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data.access_token;
}

// Example usage
const token = await getAccessToken('spx', 'spx-pennington', 'WbZgnQUInYs1SjL5IB5qbSB3cTBm7y77wQT4ktlndvPHxOjeuT');
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsImprdS...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "scope": "mdsp:core:assetmanagement.admin mdsp:core:iot.timAdmin ..."
}
```

**Important Notes**:
- Tokens expire after ~30 minutes (`expires_in: 1800` seconds)
- Store the token and reuse it until expiration
- Required scopes: `mdsp:core:assetmanagement.admin` (or appropriate read permissions)
- Always use HTTPS

---

## Asset Management API Overview

### API Base URL
```
https://gateway.eu1.mindsphere.io/api/assetmanagement/v3
```

### Key Concepts

1. **Assets**: Physical or logical objects (machines, sensors, systems)
2. **Aspects**: Data categories attached to assets (e.g., OEE_Data, Electric_Motor_Data)
3. **Variables**: Individual data points within an aspect (e.g., Temperature, Speed_RPM)
4. **Asset Types**: Templates defining what aspects/variables an asset has (e.g., `spx.SPX_Generic_Industrial_Machine`)

### HAL/HATEOAS Pattern

The API follows HAL (Hypertext Application Language) pattern with `_links` and `_embedded` fields:

```json
{
  "_embedded": {
    "assets": [...]
  },
  "_links": {
    "self": {"href": "..."},
    "next": {"href": "..."}
  }
}
```

**Key Pattern**: To get related resources, follow the links in `_links` field.

---

## Step-by-Step Implementation

### Step 1: Get Assets Filtered by Type

**Endpoint**: `GET /api/assetmanagement/v3/assets`

**Query Parameter**: `filter` (URL-encoded JSON)

**Filter Format**:
```json
{
  "hasType": "spx.SPX_Generic_Industrial_Machine"
}
```

**Full Implementation**:
```javascript
async function getAssetsByType(typeId, accessToken) {
  // Build filter object
  const filter = {
    hasType: typeId
  };

  // URL encode the filter
  const encodedFilter = encodeURIComponent(JSON.stringify(filter));

  // Make API request
  const url = `https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets?filter=${encodedFilter}`;

  const response = await axios.get(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Extract assets from HAL response
  if (response.data._embedded && response.data._embedded.assets) {
    return response.data._embedded.assets;
  }

  return [];
}
```

**Example Response**:
```json
{
  "_embedded": {
    "assets": [
      {
        "assetId": "a7c8f619847d4e63b0be5c010e09a89f",
        "name": "X_Hydraulic Press",
        "description": "",
        "typeId": "spx.SPX_Hydraulic_Press",
        "parentId": "34c42664bb77444cbd8137f849e9a9cd",
        "timezone": "Europe/Berlin",
        "location": null,
        "_links": {
          "self": {"href": "https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets/a7c8f619847d4e63b0be5c010e09a89f"},
          "aspects": {"href": "https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets/a7c8f619847d4e63b0be5c010e09a89f/aspects"}
        }
      }
    ]
  },
  "page": {
    "size": 10,
    "totalElements": 10,
    "totalPages": 1,
    "number": 0
  }
}
```

**Key Points**:
- Assets are in `_embedded.assets` array
- Each asset has `_links.aspects.href` to get its aspects
- Pagination info is in `page` field

### Step 2: Get Aspects for Each Asset

**Endpoint**: Use the `href` from `asset._links.aspects.href`

**Method**: GET

**Query Parameter**: `size=100` (to get all aspects in one call)

**Implementation**:
```javascript
async function getAssetAspects(asset, accessToken) {
  // Check if aspects link exists
  if (!asset._links || !asset._links.aspects) {
    console.warn(`No aspects link for asset ${asset.name}`);
    return null;
  }

  // Get aspects URL and add size parameter
  const aspectsUrl = asset._links.aspects.href + '?size=100';

  const response = await axios.get(aspectsUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Build consolidated asset structure
  const assetInfo = {
    assetId: asset.assetId,
    name: asset.name,
    description: asset.description,
    timezone: asset.timezone,
    parentId: asset.parentId,
    typeId: asset.typeId,
    location: asset.location,
    aspects: []
  };

  // Process aspects
  if (response.data._embedded && response.data._embedded.aspects) {
    for (const aspect of response.data._embedded.aspects) {
      // Extract variable names
      const variables = aspect.variables
        ? aspect.variables.map(v => v.name)
        : [];

      assetInfo.aspects.push({
        aspectId: aspect.aspectId,
        aspectTypeId: aspect.aspectTypeId,
        name: aspect.name,
        variables: variables
      });
    }
  }

  return assetInfo;
}
```

**Example Aspects Response**:
```json
{
  "_embedded": {
    "aspects": [
      {
        "aspectId": "29fa2bfc566041d697e823c75d3c9ee8",
        "aspectTypeId": "spx.Electric_Motor_Data",
        "name": "Electric_Motor_Data",
        "variables": [
          {
            "name": "Bearing_Fault_Detection",
            "dataType": "BOOLEAN",
            "unit": "",
            "searchable": false,
            "length": 1,
            "defaultValue": null,
            "qualityCode": false
          },
          {
            "name": "Running_Hours",
            "dataType": "DOUBLE",
            "unit": "h",
            "searchable": false,
            "length": 1,
            "defaultValue": null,
            "qualityCode": false
          },
          {
            "name": "Speed_RPM",
            "dataType": "DOUBLE",
            "unit": "rpm",
            "searchable": false,
            "length": 1,
            "defaultValue": null,
            "qualityCode": false
          }
        ]
      },
      {
        "aspectId": "8519067139d44578a2b20d9ed1561c6d",
        "aspectTypeId": "spx.OEE_Data",
        "name": "OEE_Data",
        "variables": [
          {
            "name": "BadParts",
            "dataType": "INT",
            "unit": "",
            "searchable": false,
            "length": 1,
            "defaultValue": null,
            "qualityCode": false
          },
          {
            "name": "GoodParts",
            "dataType": "INT",
            "unit": "",
            "searchable": false,
            "length": 1,
            "defaultValue": null,
            "qualityCode": false
          }
        ]
      }
    ]
  }
}
```

**Key Points**:
- Aspects are in `_embedded.aspects` array
- Each aspect has a `variables` array
- Variable objects contain `name`, `dataType`, `unit`, etc.
- Extract just the variable names for your structure

### Step 3: Build Complete Structure

**Implementation**:
```javascript
async function buildAssetStructure(typeId, tenant, clientId, clientSecret) {
  // Step 1: Get access token
  console.log('Getting access token...');
  const accessToken = await getAccessToken(tenant, clientId, clientSecret);

  // Step 2: Get all assets of specified type
  console.log(`Fetching assets with type: ${typeId}`);
  const assets = await getAssetsByType(typeId, accessToken);
  console.log(`Found ${assets.length} assets`);

  if (assets.length === 0) {
    return [];
  }

  // Step 3: Get aspects for each asset
  console.log('Fetching aspects for each asset...');
  const consolidatedAssets = [];

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    console.log(`${i + 1}/${assets.length}: ${asset.name} (ID: ${asset.assetId})`);

    const assetWithAspects = await getAssetAspects(asset, accessToken);

    if (assetWithAspects) {
      consolidatedAssets.push(assetWithAspects);
    }
  }

  console.log(`Complete! Retrieved ${consolidatedAssets.length} assets`);
  return consolidatedAssets;
}
```

---

## Complete Node.js Code Example

### Express Route Handler

```javascript
const express = require('express');
const axios = require('axios');

const router = express.Router();

// Helper function: Get OAuth token
async function getAccessToken(tenant, clientId, clientSecret) {
  const tokenUrl = `https://${tenant}.piam.eu1.mindsphere.io/oauth/token`;

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);

  try {
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Token error:', error.response?.data || error.message);
    throw new Error('Failed to get access token');
  }
}

// Helper function: Get assets by type
async function getAssetsByType(typeId, accessToken) {
  const filter = { hasType: typeId };
  const encodedFilter = encodeURIComponent(JSON.stringify(filter));
  const url = `https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets?filter=${encodedFilter}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data._embedded && response.data._embedded.assets) {
      return response.data._embedded.assets;
    }

    return [];
  } catch (error) {
    console.error('Assets fetch error:', error.response?.data || error.message);
    throw new Error('Failed to fetch assets');
  }
}

// Helper function: Get aspects for asset
async function getAssetAspects(asset, accessToken) {
  if (!asset._links || !asset._links.aspects) {
    console.warn(`No aspects link for asset ${asset.name}`);
    return null;
  }

  const aspectsUrl = asset._links.aspects.href + '?size=100';

  try {
    const response = await axios.get(aspectsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const assetInfo = {
      assetId: asset.assetId,
      name: asset.name,
      description: asset.description,
      timezone: asset.timezone,
      parentId: asset.parentId,
      typeId: asset.typeId,
      location: asset.location,
      aspects: []
    };

    if (response.data._embedded && response.data._embedded.aspects) {
      for (const aspect of response.data._embedded.aspects) {
        const variables = aspect.variables
          ? aspect.variables.map(v => v.name)
          : [];

        assetInfo.aspects.push({
          aspectId: aspect.aspectId,
          aspectTypeId: aspect.aspectTypeId,
          name: aspect.name,
          variables: variables
        });
      }
    }

    return assetInfo;
  } catch (error) {
    console.error(`Aspects fetch error for ${asset.name}:`, error.response?.data || error.message);
    return null;
  }
}

// Main route: Get asset structure
router.get('/asset-structure', async (req, res) => {
  try {
    // Configuration (should come from environment variables)
    const tenant = process.env.INSIGHTS_HUB_TENANT || 'spx';
    const clientId = process.env.INSIGHTS_HUB_CLIENT_ID;
    const clientSecret = process.env.INSIGHTS_HUB_CLIENT_SECRET;
    const typeId = req.query.typeId || 'spx.SPX_Generic_Industrial_Machine';

    if (!clientId || !clientSecret) {
      return res.status(500).json({
        error: 'Missing Insights Hub credentials'
      });
    }

    // Step 1: Get access token
    const accessToken = await getAccessToken(tenant, clientId, clientSecret);

    // Step 2: Get assets
    const assets = await getAssetsByType(typeId, accessToken);

    if (assets.length === 0) {
      return res.json({
        message: 'No assets found',
        typeId: typeId,
        assets: []
      });
    }

    // Step 3: Get aspects for each asset
    const consolidatedAssets = [];

    for (const asset of assets) {
      const assetWithAspects = await getAssetAspects(asset, accessToken);
      if (assetWithAspects) {
        consolidatedAssets.push(assetWithAspects);
      }
    }

    // Return results
    res.json({
      message: 'Success',
      typeId: typeId,
      totalAssets: consolidatedAssets.length,
      assets: consolidatedAssets
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch asset structure'
    });
  }
});

module.exports = router;
```

### Environment Variables (.env)

```bash
# Insights Hub Credentials
INSIGHTS_HUB_TENANT=spx
INSIGHTS_HUB_CLIENT_ID=spx-pennington
INSIGHTS_HUB_CLIENT_SECRET=WbZgnQUInYs1SjL5IB5qbSB3cTBm7y77wQT4ktlndvPHxOjeuT
```

### Usage in Express App

```javascript
const express = require('express');
const assetRoutes = require('./routes/assets');

const app = express();

app.use('/api', assetRoutes);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Example API Call

```bash
# Get all assets of default type
curl http://localhost:3000/api/asset-structure

# Get assets of specific type
curl http://localhost:3000/api/asset-structure?typeId=spx.SPX_Hydraulic_Press
```

---

## API Reference

### OAuth Token Endpoint

```
POST https://{tenant}.piam.eu1.mindsphere.io/oauth/token
```

**Request**:
- Headers: `Content-Type: application/x-www-form-urlencoded`
- Body: `grant_type=client_credentials&client_id={id}&client_secret={secret}`

**Response**:
```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 1800,
  "scope": "..."
}
```

### Get Assets

```
GET https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets?filter={encodedFilter}
```

**Request**:
- Headers: `Authorization: Bearer {token}`, `Content-Type: application/json`
- Query: `filter` (URL-encoded JSON: `{"hasType":"type.id"}`)

**Response**:
```json
{
  "_embedded": {
    "assets": [
      {
        "assetId": "...",
        "name": "...",
        "typeId": "...",
        "_links": {
          "aspects": {"href": "..."}
        }
      }
    ]
  }
}
```

### Get Aspects

```
GET https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets/{assetId}/aspects?size=100
```

**Request**:
- Headers: `Authorization: Bearer {token}`, `Content-Type: application/json`

**Response**:
```json
{
  "_embedded": {
    "aspects": [
      {
        "aspectId": "...",
        "aspectTypeId": "...",
        "name": "...",
        "variables": [
          {
            "name": "Temperature",
            "dataType": "DOUBLE",
            "unit": "°C"
          }
        ]
      }
    ]
  }
}
```

---

## Common Errors & Solutions

### Error 1: 401 Unauthorized - Invalid Token

**Error**:
```json
{
  "error": "invalid_token",
  "error_description": "Invalid token!"
}
```

**Causes**:
- Token expired (30-minute lifetime)
- Wrong token used
- Token not passed in Authorization header

**Solution**:
- Refresh token before each request or cache with expiry tracking
- Ensure `Authorization: Bearer {token}` header is set
- Verify token generation succeeded

### Error 2: 401 Unauthorized - Bad Credentials

**Error**:
```json
{
  "error": "unauthorized",
  "error_description": "Bad credentials"
}
```

**Causes**:
- Wrong client_id or client_secret
- Credentials expired or revoked

**Solution**:
- Verify credentials in Insights Hub Settings & Configuration
- Check tenant name matches credentials
- Regenerate credentials if needed

### Error 3: 403 Forbidden

**Error**:
```json
{
  "errors": [
    {
      "code": "mdsp.core.generic.forbidden",
      "message": "Forbidden"
    }
  ]
}
```

**Causes**:
- Insufficient permissions/scopes
- User/service doesn't have access to resource

**Solution**:
- Verify token has required scopes: `mdsp:core:assetmanagement.admin` (or `.standarduser`)
- Check user/service has Asset Management permissions in tenant
- Regenerate token after permission changes

### Error 4: 400 Bad Request - Invalid Filter

**Error**:
```json
{
  "errors": [
    {
      "code": "mdsp.core.am.validation.invalidFilterExpression",
      "message": "Invalid filter expression"
    }
  ]
}
```

**Causes**:
- Filter JSON not properly formatted
- Filter not URL-encoded
- Invalid filter field name

**Solution**:
```javascript
// CORRECT
const filter = { hasType: "spx.Type" };
const encoded = encodeURIComponent(JSON.stringify(filter));

// WRONG
const filter = "hasType:spx.Type";
```

### Error 5: Empty Results

**No error, but `_embedded.assets` is empty or missing**

**Causes**:
- No assets match the filter
- Wrong type ID
- Assets exist but in different tenant

**Solution**:
- Verify type ID is correct (case-sensitive)
- Check assets exist in Asset Manager UI
- Try without filter to see all assets: `GET /assets` (no filter param)

---

## Best Practices

### 1. Token Management

**Cache tokens and reuse**:
```javascript
let cachedToken = null;
let tokenExpiry = null;

async function getToken() {
  const now = Date.now();

  // Reuse token if still valid (with 5-minute buffer)
  if (cachedToken && tokenExpiry && now < tokenExpiry - 300000) {
    return cachedToken;
  }

  // Get new token
  const response = await getAccessToken(tenant, clientId, clientSecret);
  cachedToken = response;
  tokenExpiry = now + (1800 * 1000); // 30 minutes

  return cachedToken;
}
```

### 2. Error Handling

**Always handle API errors gracefully**:
```javascript
try {
  const response = await axios.get(url, config);
  return response.data;
} catch (error) {
  if (error.response) {
    // API returned error response
    console.error('API Error:', error.response.status, error.response.data);
    throw new Error(`API Error: ${error.response.status}`);
  } else if (error.request) {
    // No response received
    console.error('Network Error:', error.message);
    throw new Error('Network error - no response from API');
  } else {
    // Request setup error
    console.error('Request Error:', error.message);
    throw error;
  }
}
```

### 3. Pagination

**Handle paginated results**:
```javascript
async function getAllAssets(typeId, accessToken) {
  let allAssets = [];
  let nextUrl = null;

  do {
    const filter = { hasType: typeId };
    const encodedFilter = encodeURIComponent(JSON.stringify(filter));
    const url = nextUrl || `https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets?filter=${encodedFilter}&size=100`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.data._embedded?.assets) {
      allAssets = allAssets.concat(response.data._embedded.assets);
    }

    // Check for next page
    nextUrl = response.data._links?.next?.href || null;

  } while (nextUrl);

  return allAssets;
}
```

### 4. Rate Limiting

**Respect API rate limits**:
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many requests, please try again later'
});

router.get('/asset-structure', apiLimiter, async (req, res) => {
  // Your handler
});
```

### 5. Security

**Never expose credentials in client-side code**:
- ✅ Store in environment variables
- ✅ Use backend API routes
- ✅ Add authentication to your Express routes
- ❌ Don't send credentials to frontend
- ❌ Don't commit credentials to git

**Example with authentication middleware**:
```javascript
const authenticateUser = (req, res, next) => {
  // Your authentication logic
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.get('/asset-structure', authenticateUser, async (req, res) => {
  // Only authenticated users can access
});
```

---

## Output Structure

**Final JSON structure returned**:

```json
{
  "message": "Success",
  "typeId": "spx.SPX_Generic_Industrial_Machine",
  "totalAssets": 10,
  "assets": [
    {
      "assetId": "a7c8f619847d4e63b0be5c010e09a89f",
      "name": "X_Hydraulic Press",
      "description": "",
      "timezone": "Europe/Berlin",
      "parentId": "34c42664bb77444cbd8137f849e9a9cd",
      "typeId": "spx.SPX_Hydraulic_Press",
      "location": null,
      "aspects": [
        {
          "aspectId": "29fa2bfc566041d697e823c75d3c9ee8",
          "aspectTypeId": "spx.Electric_Motor_Data",
          "name": "Electric_Motor_Data",
          "variables": [
            "Bearing_Fault_Detection",
            "Running_Hours",
            "Speed_RPM",
            "Temperature",
            "Torque",
            "Torque_Average",
            "Torque_Dynamic",
            "Torque_Maximum",
            "Torque_Minimum",
            "Torque_PeakPeak"
          ]
        },
        {
          "aspectId": "8519067139d44578a2b20d9ed1561c6d",
          "aspectTypeId": "spx.OEE_Data",
          "name": "OEE_Data",
          "variables": [
            "BadParts",
            "GoodParts",
            "OrderID",
            "ProductCode",
            "Status"
          ]
        }
      ]
    }
  ]
}
```

---

## Example: Real Results from SPX Tenant

**Query**: `typeId=spx.SPX_Generic_Industrial_Machine`

**Results**: 10 assets retrieved

**Sample assets**:
1. X_Hydraulic Press - 10 aspects (Electric_Motor_Data, OEE_Data, OEE_KPIs, etc.)
2. 5-Axis CNC Machining Centre - 9 aspects
3. Capping Machine (2 instances) - 10 aspects each
4. CNC Machine Haas VF-2SS - 9 aspects
5. Conveyor - 9 aspects
6. Cooking Kettle (2 instances) - 10 aspects each
7. Cooling System (2 instances) - 10 aspects each

**Common aspects across all assets**:
- **OEE_Data**: BadParts, GoodParts, OrderID, ProductCode, Status
- **OEE_KPIs**: Availability, OEE, Performance, Quality
- **Electric_Motor_Data**: 10 variables including Bearing_Fault_Detection, Running_Hours, Speed_RPM, Temperature, Torque
- **SPX_Power_Monitoring**: Power, Power_Factor, Voltage
- **SPX_KPI_kWh_One_Minute**: Energy
- **status**: connection, connection_timestamp, health, health_timestamp

**Machine-specific aspects**:
- **SPX_Hydraulic_Press**: CBControlCommand, CVControlCommand, CycleActive, CycleCounter, Force
- **FB_CappingMachine**: cap_presence_detected, cap_torque_Nm, capping_speed_bpm
- **FB_CookingKettle**: agitator_rpm, cooking_time_s, energy_consumption_kWh, kettle_temperature_C, steam_pressure_bar
- **FB_CoolingSystem**: coolant_flow_rate_lpm, energy_consumption_kWh, product_outlet_temperature_C

---

## Additional Resources

### Insights Hub Documentation
- Asset Management API: https://developer.mindsphere.io/apis/advanced-assetmanagement/api-assetmanagement-overview.html
- Authentication: https://developer.mindsphere.io/concepts/concept-authentication.html

### Required Node.js Packages
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "axios": "^1.6.0",
    "dotenv": "^16.0.0"
  }
}
```

### Testing with cURL

**Get token**:
```bash
curl -X POST 'https://spx.piam.eu1.mindsphere.io/oauth/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials&client_id=spx-pennington&client_secret=WbZgnQUInYs1SjL5IB5qbSB3cTBm7y77wQT4ktlndvPHxOjeuT'
```

**Get assets**:
```bash
curl -X GET 'https://gateway.eu1.mindsphere.io/api/assetmanagement/v3/assets?filter=%7B%22hasType%22%3A%22spx.SPX_Generic_Industrial_Machine%22%7D' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json'
```

---

## Summary Checklist

When implementing Asset Management API in Node.js/Express:

- [ ] Set up environment variables for credentials
- [ ] Implement token generation with caching
- [ ] Create function to filter assets by type with proper URL encoding
- [ ] Follow `_links.aspects.href` to get aspects for each asset
- [ ] Extract variable names from aspect.variables array
- [ ] Build consolidated JSON structure (Asset → Aspects → Variables)
- [ ] Add error handling for 401, 403, 400 errors
- [ ] Implement pagination if expecting >100 assets
- [ ] Add rate limiting to protect your server
- [ ] Secure credentials (never expose to frontend)
- [ ] Test with curl/Postman before integrating

---

**Document Version**: 1.0
**Last Updated**: October 14, 2025
**Tested On**: Insights Hub EU1 region, SPX tenant
**API Version**: Asset Management v3
