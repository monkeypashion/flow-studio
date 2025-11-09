import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';

interface AssetType {
  id: string;
  name: string;
  description: string;
  parentTypeId: string | null;
  children?: AssetType[];  // Child types in hierarchy
}

interface Asset {
  assetId: string;
  name: string;
  typeId: string;
  description: string;
  tenantId?: string;  // Track which tenant this asset came from
}

interface TenantNode {
  id: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  region: string;
  color?: string;
  name: string;
  expanded: boolean;
  loading: boolean;
  assetTypes: AssetType[];
}

interface TypeNode {
  id: string;
  name: string;
  expanded: boolean;
  loading: boolean;
  assets: Asset[];
}

interface AssetWithPath {
  asset: Asset;
  tenantId: string;
  tenantName: string;
  typePath: string[];  // Array of type names from root to leaf
  tenantColor?: string;
}

interface RecentAsset {
  assetId: string;
  assetName: string;
  tenantId: string;
  tenantName: string;
  typeId: string;
  typePath: string;
  timestamp: number;
}

type ViewMode = 'tree' | 'list';

interface AssetPickerModalProps {
  jobId: string;
  onClose: () => void;
}

const RECENT_ASSETS_KEY = 'flowStudio_recentAssets';
const MAX_RECENT_ASSETS = 20;

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({ jobId, onClose }) => {
  const { tenants, addAssetsToJob } = useAppStore();

  const [tenantNodes, setTenantNodes] = useState<Record<string, TenantNode>>({});
  const [typeNodes, setTypeNodes] = useState<Record<string, TypeNode>>({});
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [recentAssets, setRecentAssets] = useState<RecentAsset[]>([]);
  const [isExpandingAll, setIsExpandingAll] = useState(false);
  const [searchResults, setSearchResults] = useState<Asset[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());

  // Load recent assets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_ASSETS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentAsset[];
        setRecentAssets(parsed.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECENT_ASSETS));
      }
    } catch (error) {
      console.error('Error loading recent assets:', error);
    }
  }, []);

  // Save recent asset to localStorage
  const saveRecentAsset = (asset: Asset, tenantId: string, tenantName: string, typePath: string[]) => {
    const recentAsset: RecentAsset = {
      assetId: asset.assetId,
      assetName: asset.name,
      tenantId,
      tenantName,
      typeId: asset.typeId,
      typePath: typePath.join(' > '),
      timestamp: Date.now()
    };

    const updated = [
      recentAsset,
      ...recentAssets.filter(r => r.assetId !== asset.assetId)
    ].slice(0, MAX_RECENT_ASSETS);

    setRecentAssets(updated);
    localStorage.setItem(RECENT_ASSETS_KEY, JSON.stringify(updated));
  };

  // Initialize tenant nodes
  useEffect(() => {
    const nodes: Record<string, TenantNode> = {};
    tenants.forEach(tenant => {
      nodes[tenant.id] = {
        id: tenant.id,
        tenantId: tenant.tenantId,
        clientId: tenant.clientId,
        clientSecret: tenant.clientSecret,
        region: tenant.region || '',
        color: tenant.color,
        name: tenant.tenantId,
        expanded: false,
        loading: false,
        assetTypes: []
      };
    });
    setTenantNodes(nodes);

    // Select all tenants by default
    setSelectedTenantIds(new Set(tenants.map(t => t.id)));
  }, [tenants]);

  // Build hierarchical tree from flat list of asset types
  const buildTypeHierarchy = (types: AssetType[]): AssetType[] => {
    const typeMap = new Map<string, AssetType>();
    const rootTypes: AssetType[] = [];

    // First pass: create map and initialize children arrays
    types.forEach(type => {
      typeMap.set(type.id, { ...type, children: [] });
    });

    // Second pass: build parent-child relationships
    types.forEach(type => {
      const typeNode = typeMap.get(type.id)!;
      if (type.parentTypeId && typeMap.has(type.parentTypeId)) {
        // Add to parent's children
        const parent = typeMap.get(type.parentTypeId)!;
        parent.children!.push(typeNode);
      } else {
        // No parent or parent not found = root type
        rootTypes.push(typeNode);
      }
    });

    return rootTypes;
  };

  // Get breadcrumb path for a type (array of type names from root to this type)
  const getTypePath = (types: AssetType[], typeId: string): string[] => {
    const path: string[] = [];
    const typeMap = new Map<string, AssetType>();

    // Build flat map first
    const collectTypes = (typeList: AssetType[]) => {
      typeList.forEach(type => {
        typeMap.set(type.id, type);
        if (type.children) collectTypes(type.children);
      });
    };
    collectTypes(types);

    // Build path from leaf to root, then reverse
    let currentTypeId: string | null = typeId;
    while (currentTypeId) {
      const type = typeMap.get(currentTypeId);
      if (!type) break;
      path.unshift(type.name);
      currentTypeId = type.parentTypeId;
    }

    return path;
  };

  // Flatten all assets from all tenants with their paths
  const getAllAssetsFlattened = (): AssetWithPath[] => {
    const allAssets: AssetWithPath[] = [];

    Object.values(tenantNodes).forEach(tenant => {
      const allTypeIds = collectAllTypeIds(tenant.assetTypes);

      allTypeIds.forEach(typeId => {
        const nodeKey = `${tenant.id}_${typeId}`;
        const typeNode = typeNodes[nodeKey];

        if (typeNode && typeNode.assets.length > 0) {
          typeNode.assets.forEach(asset => {
            allAssets.push({
              asset,
              tenantId: tenant.id,
              tenantName: tenant.name,
              typePath: getTypePath(tenant.assetTypes, asset.typeId),
              tenantColor: tenant.color
            });
          });
        }
      });
    });

    return allAssets;
  };

  // Fetch asset types for a tenant
  const fetchAssetTypes = async (tenantId: string) => {
    const tenant = tenantNodes[tenantId];
    if (!tenant || tenant.loading || tenant.assetTypes.length > 0) return;

    setTenantNodes(prev => ({
      ...prev,
      [tenantId]: { ...prev[tenantId], loading: true }
    }));

    try {
      const response = await fetch('http://localhost:3000/api/assets/types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          clientId: tenant.clientId,
          clientSecret: tenant.clientSecret
        })
      });

      const data = await response.json();

      if (data.success && data.assetTypes) {
        console.log('Flat asset types:', data.assetTypes);
        console.log('Sample type:', data.assetTypes[0]);
        console.log('BasicDevice type:', data.assetTypes.find((t: any) => t.name === 'BasicDevice'));

        // Build hierarchy from flat list
        const hierarchicalTypes = buildTypeHierarchy(data.assetTypes);

        console.log('Hierarchical asset types:', hierarchicalTypes);

        setTenantNodes(prev => ({
          ...prev,
          [tenantId]: {
            ...prev[tenantId],
            loading: false,
            assetTypes: hierarchicalTypes
          }
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch asset types');
      }
    } catch (error) {
      console.error('Error fetching asset types:', error);
      setTenantNodes(prev => ({
        ...prev,
        [tenantId]: { ...prev[tenantId], loading: false }
      }));
    }
  };

  // Fetch assets for a type
  const fetchAssets = async (tenantId: string, typeId: string) => {
    const nodeKey = `${tenantId}_${typeId}`;
    const existingNode = typeNodes[nodeKey];

    if (existingNode && (existingNode.loading || existingNode.assets.length > 0)) return;

    const tenant = tenantNodes[tenantId];
    if (!tenant) return;

    // Initialize or update type node
    setTypeNodes(prev => ({
      ...prev,
      [nodeKey]: {
        id: nodeKey,
        name: tenant.assetTypes.find(t => t.id === typeId)?.name || typeId,
        expanded: prev[nodeKey]?.expanded || false,
        loading: true,
        assets: prev[nodeKey]?.assets || []
      }
    }));

    try {
      const response = await fetch('http://localhost:3000/api/assets/by-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          clientId: tenant.clientId,
          clientSecret: tenant.clientSecret,
          assetTypeId: typeId
        })
      });

      const data = await response.json();

      if (data.success && data.assets) {
        setTypeNodes(prev => ({
          ...prev,
          [nodeKey]: {
            ...prev[nodeKey],
            loading: false,
            assets: data.assets
          }
        }));
      } else {
        throw new Error(data.message || 'Failed to fetch assets');
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      setTypeNodes(prev => ({
        ...prev,
        [nodeKey]: { ...prev[nodeKey], loading: false }
      }));
    }
  };

  // Toggle tenant expansion
  const toggleTenant = (tenantId: string) => {
    const tenant = tenantNodes[tenantId];
    if (!tenant) return;

    const willExpand = !tenant.expanded;

    setTenantNodes(prev => ({
      ...prev,
      [tenantId]: { ...prev[tenantId], expanded: willExpand }
    }));

    if (willExpand && tenant.assetTypes.length === 0) {
      fetchAssetTypes(tenantId);
    }
  };

  // Helper to find a type by ID recursively
  const findTypeById = (types: AssetType[], typeId: string): AssetType | null => {
    for (const type of types) {
      if (type.id === typeId) return type;
      if (type.children) {
        const found = findTypeById(type.children, typeId);
        if (found) return found;
      }
    }
    return null;
  };

  // Toggle type expansion
  const toggleType = (tenantId: string, typeId: string) => {
    const nodeKey = `${tenantId}_${typeId}`;
    const existing = typeNodes[nodeKey];
    const willExpand = !existing?.expanded;

    // Find the type to check if it has children
    const tenant = tenantNodes[tenantId];
    const typeInfo = tenant ? findTypeById(tenant.assetTypes, typeId) : null;
    const hasChildren = typeInfo?.children && typeInfo.children.length > 0;

    console.log(`toggleType: ${typeInfo?.name}, willExpand: ${willExpand}, hasChildren: ${hasChildren}, existing assets: ${existing?.assets?.length || 0}`);

    setTypeNodes(prev => ({
      ...prev,
      [nodeKey]: {
        ...prev[nodeKey],
        id: nodeKey,
        name: typeInfo?.name || typeId,
        expanded: willExpand,
        loading: prev[nodeKey]?.loading || false,
        assets: prev[nodeKey]?.assets || []
      }
    }));

    // Fetch assets for ALL types (not just leaf types)
    // This allows seeing asset instances at intermediate hierarchy levels
    const shouldFetch = willExpand && (!existing || existing.assets.length === 0);
    console.log(`Should fetch? willExpand=${willExpand}, !existing=${!existing}, assetsLength=${existing?.assets?.length}`);

    if (shouldFetch) {
      console.log(`Fetching assets for type: ${typeInfo?.name}`);
      fetchAssets(tenantId, typeId);
    } else {
      console.log(`NOT fetching - condition not met`);
    }
  };

  // Toggle asset selection
  const toggleAsset = (assetId: string, assetWithPath?: AssetWithPath) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
        // Save to recent assets when selected
        if (assetWithPath) {
          saveRecentAsset(
            assetWithPath.asset,
            assetWithPath.tenantId,
            assetWithPath.tenantName,
            assetWithPath.typePath
          );
        }
      }
      return next;
    });
  };

  // Handle clicking a recent asset - auto-loads the data if needed
  const handleRecentAssetClick = async (recent: RecentAsset) => {
    // Toggle selection immediately for responsive UI
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(recent.assetId)) {
        next.delete(recent.assetId);
      } else {
        next.add(recent.assetId);
      }
      return next;
    });

    // Ensure tenant is expanded and data is loaded
    const tenant = tenantNodes[recent.tenantId];
    if (!tenant) return;

    // Expand tenant if not expanded
    if (!tenant.expanded) {
      setTenantNodes(prev => ({
        ...prev,
        [recent.tenantId]: { ...prev[recent.tenantId], expanded: true }
      }));
    }

    // Load asset types if not loaded
    if (tenant.assetTypes.length === 0 && !tenant.loading) {
      await fetchAssetTypes(recent.tenantId);
    }

    // Load assets for this type if not loaded
    const nodeKey = `${recent.tenantId}_${recent.typeId}`;
    const typeNode = typeNodes[nodeKey];
    if (!typeNode || typeNode.assets.length === 0) {
      // Expand the type node to trigger loading
      setTypeNodes(prev => ({
        ...prev,
        [nodeKey]: {
          ...prev[nodeKey],
          id: nodeKey,
          name: recent.typePath.split(' > ').pop() || recent.typeId,
          expanded: true,
          loading: false,
          assets: prev[nodeKey]?.assets || []
        }
      }));
      await fetchAssets(recent.tenantId, recent.typeId);
    }
  };

  // Helper to recursively collect all type IDs from hierarchy
  const collectAllTypeIds = (types: AssetType[]): string[] => {
    const ids: string[] = [];
    const traverse = (typeList: AssetType[]) => {
      typeList.forEach(type => {
        ids.push(type.id);
        if (type.children && type.children.length > 0) {
          traverse(type.children);
        }
      });
    };
    traverse(types);
    return ids;
  };

  // Handle add assets - works with both tree-loaded assets and search results
  const handleAddAssets = async () => {
    if (selectedAssets.size === 0) return;

    setIsLoading(true);

    try {
      // Group assets by tenant
      // First check tree-loaded assets
      const assetsByTenant: Record<string, Set<string>> = {};

      Object.values(tenantNodes).forEach(tenant => {
        // Get ALL type IDs (including nested children)
        const allTypeIds = collectAllTypeIds(tenant.assetTypes);

        allTypeIds.forEach(typeId => {
          const nodeKey = `${tenant.id}_${typeId}`;
          const typeNode = typeNodes[nodeKey];
          if (typeNode) {
            typeNode.assets.forEach(asset => {
              if (selectedAssets.has(asset.assetId)) {
                if (!assetsByTenant[tenant.id]) {
                  assetsByTenant[tenant.id] = new Set();
                }
                assetsByTenant[tenant.id].add(asset.assetId);
              }
            });
          }
        });
      });

      // Also include search results (which may not be in tree)
      searchResults.forEach(asset => {
        if (selectedAssets.has(asset.assetId) && asset.tenantId) {
          // Asset is tagged with tenant ID from search
          if (!assetsByTenant[asset.tenantId]) {
            assetsByTenant[asset.tenantId] = new Set();
          }
          assetsByTenant[asset.tenantId].add(asset.assetId);
        }
      });

      // Fetch full asset data for each tenant's assets
      for (const [tenantId, assetIdsSet] of Object.entries(assetsByTenant)) {
        const tenant = tenantNodes[tenantId];
        if (!tenant) continue;

        // Convert Set to Array for API call
        const assetIds = Array.from(assetIdsSet);

        const response = await fetch('http://localhost:3000/api/assets/load', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: tenant.tenantId,
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            assetIds: assetIds
          })
        });

        const data = await response.json();

        if (data.success && data.groups) {
          // Attach tenant information and credentials to each group
          const groupsWithTenantInfo = data.groups.map((group: any) => ({
            ...group,
            tenantId: tenant.tenantId,
            tenantColor: tenant.color,
            clientId: tenant.clientId,
            clientSecret: tenant.clientSecret,
            region: tenant.region
          }));
          addAssetsToJob(jobId, groupsWithTenantInfo);
        }
      }

      onClose();
    } catch (error) {
      console.error('Error adding assets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter logic
  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  // Perform server-side search using API filtering
  const performSearch = async (query: string) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      // Search across selected tenants only
      const allResults: Asset[] = [];

      await Promise.all(
        Object.values(tenantNodes)
          .filter(tenant => selectedTenantIds.has(tenant.id))
          .map(async (tenant) => {
          try {
            const response = await fetch('http://localhost:3000/api/assets/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId: tenant.tenantId,
                clientId: tenant.clientId,
                clientSecret: tenant.clientSecret,
                searchTerm: query
              })
            });

            const data = await response.json();
            if (data.success && data.assets) {
              // Tag each asset with the tenant ID so we know where it came from
              const taggedAssets = data.assets.map((asset: Asset) => ({
                ...asset,
                tenantId: tenant.id  // Store the tenant node ID
              }));
              allResults.push(...taggedAssets);
            }
          } catch (error) {
            console.error(`Error searching tenant ${tenant.tenantId}:`, error);
          }
        })
      );

      // Auto-load asset types for tenants that have search results
      // This ensures the tree view can show the hierarchy
      const tenantsWithResults = new Set(allResults.map(asset => asset.tenantId));
      const loadPromises: Promise<void>[] = [];

      for (const tenantId of tenantsWithResults) {
        const tenant = tenantNodes[tenantId as string];
        if (tenant && tenant.assetTypes.length === 0 && !tenant.loading) {
          // Load asset types for this tenant if not already loaded
          loadPromises.push(fetchAssetTypes(tenantId as string));
        }
      }

      // Wait for all asset types to load before showing results
      await Promise.all(loadPromises);

      console.log('Search results with tenant/type info:', allResults.map(a => ({
        name: a.name,
        typeId: a.typeId,
        tenantId: a.tenantId
      })));

      setSearchResults(allResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle tenant selection for search
  const toggleTenantFilter = (tenantId: string) => {
    setSelectedTenantIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tenantId)) {
        newSet.delete(tenantId);
      } else {
        newSet.add(tenantId);
      }
      return newSet;
    });
  };

  // Re-run search when tenant selection changes
  useEffect(() => {
    if (searchQuery.trim() && searchResults.length >= 0) {
      // Debounce slightly to avoid rapid re-searches
      const timer = setTimeout(() => {
        performSearch(searchQuery);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedTenantIds]);

  // Debounced search handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Set new timer for debounced search
    if (query.trim()) {
      const timer = setTimeout(() => {
        performSearch(query);
      }, 300); // 300ms debounce
      setSearchDebounceTimer(timer);
    } else {
      setSearchResults([]);
    }
  };

  // Load all assets from all tenants
  const loadAllAssets = async () => {
    if (isExpandingAll) return;

    setIsExpandingAll(true);

    try {
      const allResults: Asset[] = [];

      await Promise.all(
        Object.values(tenantNodes).map(async (tenant) => {
          try {
            const response = await fetch('http://localhost:3000/api/assets/load-all', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                tenantId: tenant.tenantId,
                clientId: tenant.clientId,
                clientSecret: tenant.clientSecret,
                maxAssets: 500 // Limit per tenant
              })
            });

            const data = await response.json();
            if (data.success && data.assets) {
              // Tag each asset with the tenant ID
              const taggedAssets = data.assets.map((asset: Asset) => ({
                ...asset,
                tenantId: tenant.id
              }));
              allResults.push(...taggedAssets);
            }
          } catch (error) {
            console.error(`Error loading assets for tenant ${tenant.tenantId}:`, error);
          }
        })
      );

      // Store results as search results for display
      setSearchResults(allResults);
      setSearchQuery(''); // Clear search to show all
    } catch (error) {
      console.error('Load all error:', error);
    } finally {
      setIsExpandingAll(false);
    }
  };

  // Legacy: Expand all tenants to load hierarchy (keep for tree view)
  const expandAllTenants = async () => {
    if (isExpandingAll) return;

    setIsExpandingAll(true);
    const tenantsToExpand = Object.values(tenantNodes).filter(t => !t.expanded);

    if (tenantsToExpand.length === 0) {
      setIsExpandingAll(false);
      return;
    }

    try {
      // Expand all tenants visually
      setTenantNodes(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          updated[id] = { ...updated[id], expanded: true };
        });
        return updated;
      });

      // Load asset types for all unexpanded tenants
      await Promise.all(
        tenantsToExpand.map(tenant => fetchAssetTypes(tenant.id))
      );
    } finally {
      setIsExpandingAll(false);
    }
  };

  // Filter search results by selected tenants for immediate visual feedback
  const filteredSearchResults = searchResults.filter(asset =>
    selectedTenantIds.has(asset.tenantId || '')
  );

  // Helper: Check if an asset is in search results
  const isInSearchResults = (assetId: string): boolean => {
    return filteredSearchResults.some(result => result.assetId === assetId);
  };

  // Helper: Check if type or any of its descendants has search result assets
  const typeHasSearchResults = (type: AssetType, tenantId: string): boolean => {
    // When we have search results, check if any match this type's typeId
    const hasDirectMatch = filteredSearchResults.some(asset =>
      asset.typeId === type.id && asset.tenantId === tenantId
    );

    if (hasDirectMatch) {
      console.log(`Type ${type.name} (${type.id}) has direct search result match`);
      return true;
    }

    // Check children recursively
    if (type.children) {
      const childHasResults = type.children.some(child => typeHasSearchResults(child, tenantId));
      if (childHasResults) {
        console.log(`Type ${type.name} has child with search results`);
        return true;
      }
    }

    return false;
  };

  // Helper: Check if tenant has any search result assets
  const tenantHasSearchResults = (tenantId: string): boolean => {
    return filteredSearchResults.some(result => result.tenantId === tenantId);
  };

  // Recursive function to render asset type hierarchy
  const renderAssetType = (type: AssetType, tenantId: string, depth: number = 0): React.ReactNode => {
    // When filtering by search results, only show types that have matching assets
    if (filteredSearchResults.length > 0) {
      const hasResults = typeHasSearchResults(type, tenantId);
      console.log(`Checking type ${type.name} (${type.id}) for tenant ${tenantId}: hasResults=${hasResults}`);
      if (!hasResults) {
        return null;
      }
    } else {
      // Regular search filtering
      if (!matchesSearch(type.name)) return null;
    }

    const nodeKey = `${tenantId}_${type.id}`;
    const typeNode = typeNodes[nodeKey];
    const hasChildren = type.children && type.children.length > 0;

    // Auto-expand when search results present
    const shouldExpand = filteredSearchResults.length > 0 ? true : typeNode?.expanded;

    console.log(`Rendering type: ${type.name}, hasChildren: ${hasChildren}, children count: ${type.children?.length || 0}, shouldExpand: ${shouldExpand}`);

    return (
      <div key={type.id}>
        {/* Type row */}
        <div className="flex items-center px-2 py-1.5 hover:bg-gray-750 transition-colors" style={{ marginLeft: `${depth * 16}px` }}>
          <button
            onClick={() => toggleType(tenantId, type.id)}
            className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1"
          >
            <svg
              className={`w-3 h-3 text-gray-500 transition-transform ${
                shouldExpand ? 'rotate-90' : ''
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          <span className="text-xs text-gray-400">{type.name}</span>

          {typeNode?.loading && (
            <svg className="ml-2 w-3 h-3 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </div>

        {shouldExpand && (
          <>
            {/* Show assets for this type */}
            {(() => {
              let assetsToShow: Asset[] = [];

              if (filteredSearchResults.length > 0) {
                // When showing search results, get assets from filtered search results that match this type and tenant
                assetsToShow = filteredSearchResults.filter(asset =>
                  asset.typeId === type.id && asset.tenantId === tenantId
                );
                console.log(`Type ${type.name}: Found ${assetsToShow.length} assets from search results`);
              } else if (typeNode?.assets) {
                // Normal mode: get from typeNode, filter to only show assets DIRECTLY of this type
                assetsToShow = typeNode.assets.filter(asset =>
                  asset.typeId === type.id && matchesSearch(asset.name)
                );
              }

              if (assetsToShow.length > 0) {
                console.log(`Rendering ${assetsToShow.length} assets for type ${type.name}:`, assetsToShow.map(a => a.name));
              }

              return assetsToShow.map(asset => {
                const isSelected = selectedAssets.has(asset.assetId);
                const tenant = tenantNodes[tenantId];
                const typePath = tenant ? getTypePath(tenant.assetTypes, asset.typeId) : [];
                const assetWithPath: AssetWithPath = {
                  asset,
                  tenantId: tenant.id,
                  tenantName: tenant.name,
                  typePath,
                  tenantColor: tenant.color
                };

                return (
                  <div key={asset.assetId}>
                    <div className="flex items-center px-2 py-1.5 hover:bg-gray-750 transition-colors" style={{ marginLeft: `${(depth + 1) * 16}px` }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAsset(asset.assetId, assetWithPath)}
                        className="mr-2 w-3.5 h-3.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                      />
                      <span className="text-xs text-gray-300">{asset.name}</span>
                    </div>
                  </div>
                );
              });
            })()}

            {/* If type has children, render them recursively after the assets */}
            {hasChildren && type.children!.map(childType =>
              renderAssetType(childType, tenantId, depth + 1)
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900 rounded-t-lg">
          <h2 className="text-sm font-semibold text-gray-200">Add Assets to Job</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search bar and view toggle */}
        <div className="px-4 py-3 border-b border-gray-700 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder={`Search assets in selected tenant${selectedTenantIds.size !== 1 ? 's' : ''}...`}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full px-3 py-2 pr-8 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {isSearching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
            </div>
            {/* REMOVED: Confusing "Load All" button */}
            {false && <button
              onClick={loadAllAssets}
              disabled={isExpandingAll}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 text-xs font-medium rounded transition-colors whitespace-nowrap"
              title="Load all assets from all tenants"
            >
              {isExpandingAll ? (
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading...
                </div>
              ) : (
                'Load All'
              )}
            </button>}
            {/* View toggles - show context of search results */}
            <div className="flex border border-gray-600 rounded overflow-hidden">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === 'tree'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title="Tree View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
                title="List View"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {filteredSearchResults.length > 0
                ? viewMode === 'tree'
                  ? `Found ${filteredSearchResults.length} asset${filteredSearchResults.length !== 1 ? 's' : ''}. Tree view shows the hierarchical context of each result. Switch to List view for a flat table.`
                  : `Found ${filteredSearchResults.length} asset${filteredSearchResults.length !== 1 ? 's' : ''}. List view shows results in a flat table. Switch to Tree view to see where each asset lives in the hierarchy.`
                : searchQuery && isSearching
                ? 'Searching across selected tenants...'
                : searchQuery && !isSearching
                ? 'No assets found matching your search in selected tenants.'
                : viewMode === 'list'
                ? 'List view shows assets you\'ve loaded by expanding tenants. Use search above to find assets instantly.'
                : 'Type above to search instantly across all tenants, or expand tenants below to browse by hierarchy.'
              }
            </span>
          </div>

          {/* Tenant Filters */}
          {Object.keys(tenantNodes).length > 0 && (
            <div className="flex items-center gap-3 flex-wrap pt-2">
              <span className="text-xs text-gray-400 font-medium">Search in:</span>
              {Object.values(tenantNodes).map(tenant => (
                <label
                  key={tenant.id}
                  className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-750 px-2 py-1 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedTenantIds.has(tenant.id)}
                    onChange={() => toggleTenantFilter(tenant.id)}
                    className="w-3.5 h-3.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-xs text-gray-300">{tenant.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Tree View */}
          {viewMode === 'tree' && (
            <>
              {Object.values(tenantNodes).map(tenant => {
                // When search results present, only show tenants with matching assets
                if (filteredSearchResults.length > 0) {
                  if (!tenantHasSearchResults(tenant.id)) return null;
                } else {
                  // Regular search filtering
                  if (!matchesSearch(tenant.name)) return null;
                }

                // Auto-expand tenants with search results
                const shouldExpand = filteredSearchResults.length > 0 ? true : tenant.expanded;

                console.log('Tree view - Tenant:', tenant.name, 'Asset types:', tenant.assetTypes.length, 'Should expand:', shouldExpand, 'Filtered results:', filteredSearchResults.length);

                return (
                  <div key={tenant.id}>
                    {/* Tenant row */}
                    <div className="flex items-center px-2 py-1.5 hover:bg-gray-750 transition-colors">
                      <button
                        onClick={() => toggleTenant(tenant.id)}
                        className="p-0.5 hover:bg-gray-700 rounded transition-colors flex-shrink-0 mr-1"
                      >
                        <svg
                          className={`w-3 h-3 text-gray-500 transition-transform ${
                            shouldExpand ? 'rotate-90' : ''
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>

                      <span className="text-xs text-gray-300 font-medium">{tenant.name}</span>

                      {tenant.loading && (
                        <svg className="ml-2 w-3 h-3 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                    </div>

                    {/* Asset types (hierarchical) */}
                    {shouldExpand && (
                      <div>
                        {tenant.assetTypes.length === 0 && (
                          <div className="text-xs text-gray-500 px-2 py-2 ml-4">Loading asset types...</div>
                        )}
                        {tenant.assetTypes.map(type => renderAssetType(type, tenant.id, 1))}
                      </div>
                    )}
                  </div>
                );
              })}

              {Object.keys(tenantNodes).length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No tenant credentials configured. Add credentials in Settings first.
                </div>
              )}
            </>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="border border-gray-700 rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-900 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left text-gray-400 font-medium w-8"></th>
                    <th className="px-2 py-2 text-left text-gray-400 font-medium">Asset</th>
                    <th className="px-2 py-2 text-left text-gray-400 font-medium">
                      {filteredSearchResults.length > 0 ? 'Type' : 'Path'}
                    </th>
                    <th className="px-2 py-2 text-left text-gray-400 font-medium">
                      {filteredSearchResults.length > 0 ? 'Description' : 'Tenant'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSearchResults.length > 0 ? (
                    // Show filtered search results
                    filteredSearchResults.map((asset) => {
                      const isSelected = selectedAssets.has(asset.assetId);
                      const tenant = Object.values(tenantNodes).find(t => t.id === asset.tenantId);
                      return (
                        <tr
                          key={asset.assetId}
                          className="border-t border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
                          onClick={() => toggleAsset(asset.assetId)}
                        >
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800 pointer-events-none"
                            />
                          </td>
                          <td className="px-2 py-2 text-gray-300">{asset.name}</td>
                          <td className="px-2 py-2 text-gray-500">{asset.typeId}</td>
                          <td className="px-2 py-2 text-gray-500 truncate max-w-xs">
                            {asset.description || '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    // Show flattened assets from expanded tree
                    getAllAssetsFlattened()
                      .filter(item =>
                        matchesSearch(item.asset.name) ||
                        matchesSearch(item.tenantName) ||
                        item.typePath.some(t => matchesSearch(t))
                      )
                      .map(item => {
                        const isSelected = selectedAssets.has(item.asset.assetId);
                        return (
                          <tr
                            key={item.asset.assetId}
                            className="border-t border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
                            onClick={() => toggleAsset(item.asset.assetId, item)}
                          >
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-3.5 h-3.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800 pointer-events-none"
                              />
                            </td>
                            <td className="px-2 py-2 text-gray-300">{item.asset.name}</td>
                            <td className="px-2 py-2 text-gray-500">{item.typePath.join(' > ')}</td>
                            <td className="px-2 py-2">
                              <span className="text-gray-400">{item.tenantName}</span>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
              {filteredSearchResults.length === 0 && getAllAssetsFlattened().length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No assets loaded. Expand tenants to load assets.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-700 bg-gray-900 rounded-b-lg flex items-center justify-between">
          <span className="text-xs text-gray-400">
            Selected: {selectedAssets.size} asset{selectedAssets.size !== 1 ? 's' : ''}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddAssets}
              disabled={selectedAssets.size === 0 || isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Adding...' : 'Add to Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
