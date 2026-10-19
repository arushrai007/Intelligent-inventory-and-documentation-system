import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Database, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { useSystem } from '../../context/SystemContext';
import { api } from '../../api/client';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const location = useLocation();
  const { isOnline, isDemoMode, triggerRefresh, showToast } = useSystem();
  const [isSeeding, setIsSeeding] = useState(false);

  // Map route to clear human readable title
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/':
        return 'Operations Dashboard';
      case '/products':
        return 'Product Catalog & Inventory';
      case '/sales':
        return 'Sales History & Transaction Recording';
      case '/suppliers':
        return 'Supplier Directory & Lead Times';
      case '/forecasts':
        return 'Machine Learning Demand Forecasts';
      case '/recommendations':
        return 'Intelligent Reorder Recommendations';
      case '/purchase-orders':
        return 'Purchase Orders & Stock Receiving';
      case '/analytics':
        return 'MongoDB Aggregation Analytics';
      case '/database-performance':
        return 'Database Performance & Query Optimization';
      case '/settings':
        return 'System & Inventory Assumptions';
      case '/privacy':
        return 'Privacy Policy';
      case '/terms':
        return 'Terms and Conditions';
      default:
        return 'Inventory System';
    }
  };

  const handleSeedDatabase = async () => {
    setIsSeeding(true);
    try {
      await api.seedDatabase(true);
      showToast('Database reset and seeded with 180 days of realistic sales data.', 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed to seed database', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">
          {getPageTitle(location.pathname)}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        {isDemoMode && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-medium">
            Demo Data Active
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={handleSeedDatabase}
          isLoading={isSeeding}
          title="Regenerates 180 days of historical sales for ML model testing"
        >
          <Database className="w-3.5 h-3.5 mr-1 text-slate-500" />
          Seed 180-Day Dataset
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={triggerRefresh}
          title="Refresh current view data"
        >
          <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
        </Button>
      </div>
    </header>
  );
};
