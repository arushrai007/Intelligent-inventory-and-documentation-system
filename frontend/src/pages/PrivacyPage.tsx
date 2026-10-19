import React from 'react';
import { Card } from '../components/ui/Card';
import { ShieldCheck, Database, Server, Lock, AlertCircle } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Data Governance & Privacy
        </div>
        <h1 className="text-xl font-bold text-slate-900 mt-1">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Last revised: October 2026. This policy describes the actual data processing, storage, and retention practices of this application.
        </p>
      </div>

      <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
        {/* Section 1: Overview */}
        <Card title="1. Purpose and Scope">
          <p>
            The Intelligent Inventory & Demand Forecasting System is an operational business application designed for small retailers, supermarkets, and warehouse inventory managers.
            This policy outlines what operational data is collected, why it is stored, how machine learning forecasting processes this data, and what third-party infrastructure providers host the database and application services.
          </p>
        </Card>

        {/* Section 2: Information Collected */}
        <Card title="2. Information Collected and Stored">
          <p className="mb-3">
            The application collects and processes only operational business data necessary for inventory control, transaction history, and demand forecasting:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <strong>Product Catalog Data:</strong> Stock Keeping Units (SKUs), product titles, categories, selling prices, wholesale acquisition costs, current on-hand quantities, safety stock levels, and reorder thresholds.
            </li>
            <li>
              <strong>Sales Transactions:</strong> Product identifier, quantity sold, sale price, gross transaction amount, timestamp of sale, and transaction idempotency tokens. No personal payment card numbers, customer names, or retail consumer identities are collected or stored.
            </li>
            <li>
              <strong>Supplier Records:</strong> Supplier company names, unique vendor codes, business contact email addresses, business phone numbers, average delivery lead times, and fulfillment variability metrics.
            </li>
            <li>
              <strong>Purchase Orders:</strong> Generated PO reference numbers, ordered line items, delivery status (PENDING, ORDERED, RECEIVED, CANCELLED), and inventory receipt timestamps.
            </li>
            <li>
              <strong>Demand Forecasts:</strong> Daily predicted quantities, upper and lower statistical uncertainty intervals, model versions (e.g. scikit-learn Random Forest), and validation evaluation metrics (MAE, RMSE, MAPE).
            </li>
          </ul>
        </Card>

        {/* Section 3: Machine Learning & Processing */}
        <Card title="3. Processing and Machine Learning Utilization">
          <p className="mb-2">
            All historical sales quantities are analyzed internally using numerical libraries (scikit-learn, pandas, and NumPy) for the purpose of:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Computing historical daily sales averages and variance.</li>
            <li>Fitting machine learning regression models to forecast short-term future demand.</li>
            <li>Calculating statistical Safety Stock and Reorder Points using classical supply-chain equations.</li>
          </ul>
          <p className="mt-2">
            Historical sales data is processed directly inside the application backend and is never sold, licensed, or shared with external third-party advertising networks.
          </p>
        </Card>

        {/* Section 4: Third-Party Infrastructure */}
        <Card title="4. Hosting and Database Infrastructure">
          <p className="mb-2">
            The application relies on verified third-party cloud infrastructure to operate:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 border border-slate-200 rounded bg-slate-50">
              <strong className="block text-slate-900 mb-1">Database Storage</strong>
              <span>MongoDB Atlas (Free Shared Tier) persists product collections, sales ledgers, and forecast outputs.</span>
            </div>
            <div className="p-3 border border-slate-200 rounded bg-slate-50">
              <strong className="block text-slate-900 mb-1">Application API</strong>
              <span>Render Free Web Services host the Python FastAPI REST application and scikit-learn processing engine.</span>
            </div>
            <div className="p-3 border border-slate-200 rounded bg-slate-50">
              <strong className="block text-slate-900 mb-1">Client Interface</strong>
              <span>Vercel Hobby hosts the compiled static React TypeScript single-page application.</span>
            </div>
          </div>
        </Card>

        {/* Section 5: Data Retention & Security Limitations */}
        <Card title="5. Data Retention, Deletion, and Security Safeguards">
          <p className="mb-2">
            Operational data remains stored in the database until explicitly updated, archived, or deleted by authorized administrators, or reset through the system seed utility.
          </p>
          <p className="mb-2">
            Standard technical safeguards include database collection-level JSON Schema validation, indexed uniqueness constraints, CORS restrictions to authorized frontend origins, and centralized server-side error handling.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 mt-3">
            <strong>Security Limitations Notice:</strong> In demonstration and educational deployments, database access occurs over internet-accessible cloud endpoints. Do not store sensitive trade secrets, confidential banking credentials, or personal identification information within this system.
          </div>
        </Card>

        {/* Section 6: Inquiries and Contact Placeholder */}
        <Card title="6. User Inquiries and Legal Configuration">
          <p className="leading-relaxed">
            For questions concerning operational data stored within this project installation, data corrections, or database reset requests, contact the project administrator or repository owner.
          </p>
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded text-[11px] font-mono text-slate-600">
            System Administrator Contact: [To be configured by deploying organization]
            <br />
            Repository: Intelligent Inventory &amp; Demand Forecasting System
          </div>
        </Card>
      </div>
    </div>
  );
};
