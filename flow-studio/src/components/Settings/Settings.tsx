import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import type { TenantCredential } from '../../types/index';

export const Settings: React.FC = () => {
  const {
    settingsVisible,
    toggleSettings,
    tenants,
    addTenant,
    updateTenant,
    deleteTenant,
    setDefaultTenant,
    testTenantConnection,
    loadTenantsFromStorage,
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [showCurl, setShowCurl] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    tenantId: '',
    clientId: '',
    clientSecret: '',
    color: '#3b82f6', // blue-500
  });

  // Load tenants from localStorage on mount
  useEffect(() => {
    loadTenantsFromStorage();
  }, [loadTenantsFromStorage]);

  const resetForm = () => {
    setFormData({
      tenantId: '',
      clientId: '',
      clientSecret: '',
      color: '#3b82f6',
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (tenant: TenantCredential) => {
    setFormData({
      tenantId: tenant.tenantId,
      clientId: tenant.clientId,
      clientSecret: tenant.clientSecret,
      color: tenant.color || '#3b82f6',
    });
    setIsEditing(true);
    setEditingId(tenant.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      // Update existing tenant
      updateTenant(editingId, formData);
    } else {
      // Add new tenant
      addTenant(formData);
    }

    resetForm();
  };

  const handleDelete = (tenantId: string) => {
    if (window.confirm('Are you sure you want to delete this tenant credential?')) {
      deleteTenant(tenantId);
    }
  };

  const handleTest = async (tenantId: string) => {
    setTesting(tenantId);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[tenantId];
      return next;
    });

    const result = await testTenantConnection(tenantId);
    setTestResults((prev) => ({ ...prev, [tenantId]: result }));
    setTesting(null);
  };

  const togglePasswordVisibility = (tenantId: string) => {
    setShowPassword((prev) => ({ ...prev, [tenantId]: !prev[tenantId] }));
  };

  const toggleCurlCommand = (tenantId: string) => {
    setShowCurl((prev) => ({ ...prev, [tenantId]: !prev[tenantId] }));
  };

  const generateCurlCommand = (tenant: TenantCredential): string => {
    const credentials = `${tenant.clientId}:${tenant.clientSecret}`;
    const base64Credentials = btoa(credentials);
    return `curl --location 'https://${tenant.tenantId}.piam.eu1.mindsphere.io/oauth/token' \\
--header 'Content-Type: application/x-www-form-urlencoded' \\
--header 'Authorization: Basic ${base64Credentials}' \\
--data-urlencode 'grant_type=client_credentials'`;
  };

  const copyCurlCommand = (tenant: TenantCredential) => {
    const command = generateCurlCommand(tenant);
    navigator.clipboard.writeText(command);
  };

  if (!settingsVisible) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-800 border-l border-gray-700 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-200">Settings</h2>
        <button
          onClick={toggleSettings}
          className="p-1 hover:bg-gray-800 rounded transition-colors"
          title="Close settings"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Add/Edit Tenant Form */}
        <div className="mb-6">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            {isEditing ? 'Edit Tenant Credential' : 'Add Tenant Credential'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Tenant ID</label>
              <input
                type="text"
                value={formData.tenantId}
                onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
                placeholder="e.g., spx"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Client ID</label>
              <input
                type="text"
                value={formData.clientId}
                onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                placeholder="Enter client ID"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Client Secret</label>
              <input
                type="password"
                value={formData.clientSecret}
                onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                placeholder="Enter client secret"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Color Tag</label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-10 px-1 bg-gray-700 border border-gray-600 rounded cursor-pointer"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
              >
                {isEditing ? 'Update' : 'Add'} Credential
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Tenant List */}
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            Saved Credentials ({tenants.length})
          </h3>

          {tenants.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No tenant credentials saved yet.
            </div>
          ) : (
            <div className="space-y-3">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="bg-gray-700 rounded-lg p-3 border border-gray-600"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tenant.color || '#3b82f6' }}
                      />
                      <h4 className="text-sm font-medium text-gray-200">{tenant.tenantId}</h4>
                      {tenant.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                          Default
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-gray-400 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Client ID:</span>
                      <span className="font-mono text-gray-300">{tenant.clientId}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Client Secret:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-300">
                          {showPassword[tenant.id] ? tenant.clientSecret : '••••••••••••'}
                        </span>
                        <button
                          onClick={() => togglePasswordVisibility(tenant.id)}
                          className="p-0.5 hover:bg-gray-600 rounded"
                          title={showPassword[tenant.id] ? 'Hide' : 'Show'}
                        >
                          {showPassword[tenant.id] ? (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                                clipRule="evenodd"
                              />
                              <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                              <path
                                fillRule="evenodd"
                                d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {tenant.lastUsed && (
                      <div className="text-gray-500 pt-1">
                        Last used: {new Date(tenant.lastUsed).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Test Result */}
                  {testResults[tenant.id] && (
                    <div
                      className={`mb-3 px-2 py-1.5 rounded text-xs ${
                        testResults[tenant.id].success
                          ? 'bg-green-900/30 text-green-300 border border-green-700'
                          : 'bg-red-900/30 text-red-300 border border-red-700'
                      }`}
                    >
                      {testResults[tenant.id].message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleTest(tenant.id)}
                        disabled={testing === tenant.id}
                        className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testing === tenant.id ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {!tenant.isDefault && (
                        <button
                          onClick={() => setDefaultTenant(tenant.id)}
                          className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs font-medium rounded transition-colors"
                          title="Set as default"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(tenant)}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-gray-200 text-xs font-medium rounded transition-colors"
                        title="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tenant.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition-colors"
                        title="Delete"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
