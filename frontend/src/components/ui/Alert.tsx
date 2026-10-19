import React, { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface AlertProps {
  children: ReactNode;
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  children,
  variant = 'info',
  title,
  className = '',
}) => {
  const variantStyles = {
    info: {
      container: 'bg-slate-50 border-slate-200 text-slate-800',
      icon: <Info className="w-5 h-5 text-slate-500 shrink-0" />,
    },
    warning: {
      container: 'bg-amber-50 border-amber-200 text-amber-800',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    },
    danger: {
      container: 'bg-rose-50 border-rose-200 text-rose-800',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    },
    success: {
      container: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      icon: <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />,
    },
  };

  const { container, icon } = variantStyles[variant];

  return (
    <div className={`border rounded-md p-4 flex gap-3 text-sm ${container} ${className}`}>
      {icon}
      <div className="flex-1">
        {title && <h4 className="font-semibold mb-1 text-sm">{title}</h4>}
        <div>{children}</div>
      </div>
    </div>
  );
};
