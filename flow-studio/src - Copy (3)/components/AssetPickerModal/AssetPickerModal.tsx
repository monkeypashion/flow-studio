import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { Group } from '../../types/index';

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
}

interface TenantNode {
  id: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
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

interface AssetPickerModalProps {
  jobId: string;
  onClose: () => void;
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({ jobId, onClose }) => {
  const { tenants, addAssetsToJob } = useAppStore();

  const [tenantNodes, setTenantNodes] = useState<Record<string, TenantNode>>({});
  const [typeNodes, setTypeNodes] = useState<Record<string, TypeNode>>({});
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Initialize tenant nodes
  useEffect(() => {
    const nodes: Record<string, TenantNode> = {};
    tenants.forEach(tenant => {
      nodes[tenant.id] = {
        id: tenant.id,
        tenantId: tenant.tenantId,
        clientId: tenant.clientId,
        clientSecret: tenant.clientSecret,
        color: tenant.color,
        name: tenant.tenantId,
        expanded: false,
        loading: false,
        assetTypes: []
      };
    });
    setTenantNodes(nodes);
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

    // Only fetch assets for LEAF types (types with no children)
    const shouldFetch = willExpand && !hasChildren && (!existing || existing.assets.length === 0);
    console.log(`Should fetch? willExpand=${willExpand}, !hasChildren=${!hasChildren}, !existing=${!existing}, assetsLength=${existing?.assets?.length}`);

    if (shouldFetch) {
      console.log(`Fetching assets for leaf type: ${typeInfo?.name}`);
      fetchAssets(tenantId, typeId);
    } else {
      console.log(`NOT fetching - condition not met`);
    }
  };

  // Toggle asset selection
  const toggleAsset = (assetId: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
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

  // Handle add assets
  const handleAddAssets = async () => {
    if (selectedAssets.size === 0) return;

    setIsLoading(true);

    try {
      // Group assets by tenant
      const assetsByTenant: Record<string, string[]> = {};

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
                  assetsByTenant[tenant.id] = [];
                }
                assetsByTenant[tenant.id].push(asset.assetId);
              }
            });
          }
        });
      });

      // Fetch full asset data for each tenant's assets
      for (const [tenantId, assetIds] of Object.entries(assetsByTenant)) {
        const tenant = tenantNodes[tenantId];
        if (!tenant) continue;

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
          // Attach tenant information to each group
          const groupsWithTenantInfo = data.groups.map((group: any) => ({
            ...group,
            tenantId: tenant.tenantId,
            tenantColor: tenant.color
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

  // Recursive function to render asset type hierarchy
  const renderAssetType = (type: AssetType, tenantId: string, depth: number = 0): React.ReactNode => {
    if (!matchesSearch(type.name)) return null;

    const nodeKey = `${tenantId}_${type.id}`;
    const typeNode = typeNodes[nodeKey];
    const hasChildren = type.children && type.children.length > 0;

    console.log(`Rendering type: ${type.name}, hasChildren: ${hasChildren}, children count: ${type.children?.length || 0}`);

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
                typeNode?.expanded ? 'rotate-90' : ''
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

        {typeNode?.expanded && (
          <>
            {/* If type has children, render them recursively */}
            {hasChildren && type.children!.map(childType =>
              renderAssetType(childType, tenantId, depth + 1)
            )}

            {/* If type has NO children (leaf node), show assets */}
            {!hasChildren && typeNode.assets.map(asset => {
              if (!matchesSearch(asset.name)) return null;

              const isSelected = selectedAssets.has(asset.assetId);

              return (
                <div key={asset.assetId}>
                  <div className="flex items-center px-2 py-1.5 hover:bg-gray-750 transition-colors" style={{ marginLeft: `${(depth + 1) * 16}px` }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAsset(asset.assetId)}
                      className="mr-2 w-3.5 h-3.5 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
                    />
                    <span className="text-xs text-gray-300">{asset.name}</span>
                  </div>
                </div>
              );
            })}
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

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tree content */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.values(tenantNodes).map(tenant => {
            if (!matchesSearch(tenant.name)) return null;

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
                        tenant.expanded ? 'rotate-90' : ''
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
                {tenant.expanded && (
                  <div>
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
