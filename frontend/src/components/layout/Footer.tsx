import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 mt-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        <div>
          <span>Intelligent Inventory & Demand Forecasting System</span>
          <span className="mx-2 text-slate-300">|</span>
          <span className="font-mono text-[11px] text-slate-400">FastAPI & MongoDB Atlas & scikit-learn</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/privacy"
            className="hover:text-slate-900 underline underline-offset-2 transition-colors"
          >
            Privacy Policy
          </Link>
          <span className="text-slate-300">/</span>
          <Link
            to="/terms"
            className="hover:text-slate-900 underline underline-offset-2 transition-colors"
          >
            Terms and Conditions
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-400">Production Build v1.0.0</span>
        </div>
      </div>
    </footer>
  );
};
