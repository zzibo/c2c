'use client';

import React, { useState, useEffect } from 'react';

interface SWMetrics {
  cacheHits: number;
  cacheMisses: number;
  networkRequests: number;
  networkFailures: number;
  lruEvictions: number;
  errors: number;
  hitRate: string;
  uptime: string;
  sessionId: string;
  timestamp: string;
}

interface CacheInfo {
  tiles: {
    name: string;
    count: number;
    maxSize: number;
    utilization: string;
  };
  images: {
    name: string;
    count: number;
  };
  lru: {
    entries: number;
  };
  totalSize: string;
  timestamp: string;
}

interface LRUEntry {
  url: string;
  timestamp: number;
  age: string;
}

export function ServiceWorkerInspector() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'cache' | 'lru' | 'actions'>('metrics');
  const [metrics, setMetrics] = useState<SWMetrics | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [lruState, setLruState] = useState<LRUEntry[]>([]);
  const [swStatus, setSwStatus] = useState<'active' | 'installing' | 'none'>('none');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Send message to Service Worker
  const sendSWMessage = async (type: string, payload?: any): Promise<any> => {
    if (!navigator.serviceWorker.controller) {
      console.warn('No active service worker controller');
      return null;
    }

    return new Promise((resolve, reject) => {
      const messageChannel = new MessageChannel();

      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller.postMessage(
        { type, payload },
        [messageChannel.port2]
      );

      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('SW message timeout')), 5000);
    });
  };

  // Fetch metrics from SW
  const fetchMetrics = async () => {
    try {
      const response = await sendSWMessage('GET_METRICS');
      if (response?.type === 'METRICS') {
        setMetrics(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch SW metrics:', error);
    }
  };

  // Fetch cache info from SW
  const fetchCacheInfo = async () => {
    try {
      const response = await sendSWMessage('GET_CACHE_INFO');
      if (response?.type === 'CACHE_INFO') {
        setCacheInfo(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch cache info:', error);
    }
  };

  // Fetch LRU state from SW
  const fetchLRUState = async () => {
    try {
      const response = await sendSWMessage('GET_LRU_STATE');
      if (response?.type === 'LRU_STATE') {
        setLruState(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch LRU state:', error);
    }
  };

  // Clear cache
  const clearCache = async (cacheName?: string) => {
    try {
      const response = await sendSWMessage('CLEAR_CACHE', { cacheName });
      if (response?.data?.success) {
        alert(`Cache cleared: ${cacheName || 'default'}`);
        fetchCacheInfo();
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  // Set log level
  const setLogLevel = async (level: 'debug' | 'info' | 'warn' | 'error') => {
    try {
      await sendSWMessage('SET_LOG_LEVEL', { level });
      alert(`Log level set to: ${level}`);
    } catch (error) {
      console.error('Failed to set log level:', error);
    }
  };

  // Check SW status
  useEffect(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.active) {
          setSwStatus('active');
        } else if (registration.installing) {
          setSwStatus('installing');
        }
      });
    }
  }, []);

  // Auto-refresh metrics
  useEffect(() => {
    if (!autoRefresh || !isOpen) return;

    const interval = setInterval(() => {
      if (activeTab === 'metrics') fetchMetrics();
      if (activeTab === 'cache') fetchCacheInfo();
      if (activeTab === 'lru') fetchLRUState();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, isOpen]);

  // Initial fetch when tab changes
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'metrics') fetchMetrics();
    if (activeTab === 'cache') fetchCacheInfo();
    if (activeTab === 'lru') fetchLRUState();
  }, [activeTab, isOpen]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-c2c-orange text-white px-4 py-2 text-sm font-medium shadow-lg hover:bg-c2c-orange-dark transition-colors z-50"
        title="Open Service Worker Inspector"
      >
        SW Inspector
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[600px] bg-white border-2 border-gray-900 shadow-lg z-50 max-h-[600px] flex flex-col">
      {/* Header */}
      <div className="bg-c2c-base border-b-2 border-gray-900 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">Service Worker Inspector</h3>
          <span
            className={`px-2 py-1 text-xs font-medium ${
              swStatus === 'active'
                ? 'bg-green-100 text-green-700'
                : swStatus === 'installing'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {swStatus}
          </span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-700 hover:text-gray-900 text-xl font-bold"
        >
          ×
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-300">
        {(['metrics', 'cache', 'lru', 'actions'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-c2c-orange border-b-2 border-c2c-orange'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-white">
        {/* Metrics Tab */}
        {activeTab === 'metrics' && metrics && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Cache Hit Rate" value={metrics.hitRate} color="green" />
              <MetricCard label="Uptime" value={metrics.uptime} color="blue" />
              <MetricCard label="Cache Hits" value={metrics.cacheHits.toString()} />
              <MetricCard label="Cache Misses" value={metrics.cacheMisses.toString()} />
              <MetricCard label="Network Requests" value={metrics.networkRequests.toString()} />
              <MetricCard label="Network Failures" value={metrics.networkFailures.toString()} color="red" />
              <MetricCard label="LRU Evictions" value={metrics.lruEvictions.toString()} />
              <MetricCard label="Errors" value={metrics.errors.toString()} color="red" />
            </div>
            <div className="text-xs text-gray-500 mt-4">
              <div>Session ID: {metrics.sessionId}</div>
              <div>Last Updated: {new Date(metrics.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        )}

        {/* Cache Info Tab */}
        {activeTab === 'cache' && cacheInfo && (
          <div className="space-y-4">
            <div className="border border-gray-300 p-3">
              <h4 className="font-semibold text-gray-900 mb-2">Mapbox Tiles</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <div>Cache: {cacheInfo.tiles.name}</div>
                <div>Entries: {cacheInfo.tiles.count} / {cacheInfo.tiles.maxSize}</div>
                <div>Utilization: {cacheInfo.tiles.utilization}</div>
              </div>
            </div>

            <div className="border border-gray-300 p-3">
              <h4 className="font-semibold text-gray-900 mb-2">Images</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <div>Cache: {cacheInfo.images.name}</div>
                <div>Entries: {cacheInfo.images.count}</div>
              </div>
            </div>

            <div className="border border-gray-300 p-3">
              <h4 className="font-semibold text-gray-900 mb-2">LRU Tracker</h4>
              <div className="text-sm text-gray-700">
                Entries in IndexedDB: {cacheInfo.lru.entries}
              </div>
            </div>

            <div className="text-sm text-gray-700">
              <strong>Total Size:</strong> {cacheInfo.totalSize}
            </div>
          </div>
        )}

        {/* LRU State Tab */}
        {activeTab === 'lru' && (
          <div>
            <div className="text-sm text-gray-700 mb-3">
              {lruState.length} entries tracked
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {lruState.slice(0, 50).map((entry, idx) => (
                <div key={idx} className="border border-gray-300 p-2 text-xs">
                  <div className="font-mono text-gray-900 truncate">{entry.url}</div>
                  <div className="text-gray-500 mt-1">Age: {entry.age}</div>
                </div>
              ))}
              {lruState.length > 50 && (
                <div className="text-center text-xs text-gray-500 py-2">
                  ... and {lruState.length - 50} more entries
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="space-y-3">
            <button
              onClick={fetchMetrics}
              className="w-full bg-c2c-orange text-white py-2 px-4 text-sm font-medium hover:bg-c2c-orange-dark transition-colors"
            >
              Refresh Metrics
            </button>

            <button
              onClick={() => clearCache('c2c-map-cache-v1')}
              className="w-full bg-white border border-gray-700 text-gray-900 py-2 px-4 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Clear Tile Cache
            </button>

            <button
              onClick={() => clearCache('c2c-images-v1')}
              className="w-full bg-white border border-gray-700 text-gray-900 py-2 px-4 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Clear Image Cache
            </button>

            <div className="border-t border-gray-300 pt-3 mt-3">
              <div className="text-sm font-medium text-gray-900 mb-2">Set Log Level</div>
              <div className="grid grid-cols-2 gap-2">
                {(['debug', 'info', 'warn', 'error'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setLogLevel(level)}
                    className="bg-gray-200 text-gray-900 py-1 px-3 text-xs font-medium hover:bg-gray-300 transition-colors"
                  >
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-300 pt-3 mt-3">
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                Auto-refresh (2s interval)
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: 'green' | 'blue' | 'red';
}) {
  const colorClasses = {
    green: 'bg-green-50 border-green-300 text-green-700',
    blue: 'bg-blue-50 border-blue-300 text-blue-700',
    red: 'bg-red-50 border-red-300 text-red-700',
  };

  return (
    <div className={`border p-3 ${color ? colorClasses[color] : 'bg-white border-gray-300'}`}>
      <div className="text-xs font-medium text-gray-700 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color ? '' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
