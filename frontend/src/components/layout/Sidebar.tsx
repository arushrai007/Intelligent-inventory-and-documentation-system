import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Truck,
  TrendingUp,
  AlertCircle,
  ClipboardList,
  BarChart3,
  Database,
  Sliders,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useSystem } from '../../context/SystemContext';

export const Sidebar: React.FC = () => {
  const { isOnline, isDemoMode } = useSystem();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/products', label: 'Products', icon: Package },
    { to: '/sales', label: 'Sales & POS', icon: ShoppingCart },
    { to: '/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/forecasts', label: 'Demand Forecasts', icon: TrendingUp },
    { to: '/recommendations', label: 'Reorder Advice', icon: AlertCircle },
    { to: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
    { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/database-performance', label: 'DB Performance', icon: Database },
    { to: '/settings', label: 'Settings', icon: Sliders },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500 flex items-center justify-center font-bold text-slate-900 text-xs">
              II
            </div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">
              Inventory IQ
            </h1>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-mono">Demand Forecasting</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Core Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Compliance & Legal
        </div>
        <NavLink
          to="/privacy"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors ${
              isActive
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`
          }
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>Privacy Policy</span>
        </NavLink>
        <NavLink
          to="/terms"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 text-xs font-medium rounded transition-colors ${
              isActive
                ? 'bg-slate-800 text-emerald-400 font-semibold'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
            }`
          }
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Terms & Conditions</span>
        </NavLink>
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">Database</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {isOnline ? 'MongoDB Atlas' : 'Local / Cache'}
          </span>
        </div>
        {isDemoMode && (
          <div className="mt-2 text-[10px] bg-amber-950/40 text-amber-300 border border-amber-800/50 px-2 py-1 rounded">
            Displaying labeled demo dataset. Connect MongoDB backend for live updates.
          </div>
        )}
      </div>
    </aside>
  );
};
