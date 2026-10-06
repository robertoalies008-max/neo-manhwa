import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '380px',
      width: 'calc(100% - 32px)',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        const getBorderColor = () => {
          switch (toast.type) {
            case 'success': return '#10b981';
            case 'warning': return '#f59e0b';
            case 'error': return '#ef4444';
            case 'info': return '#3b82f6';
          }
        };

        const getIcon = () => {
          switch (toast.type) {
            case 'success': return <CheckCircle2 size={18} color="#10b981" />;
            case 'warning': return <AlertTriangle size={18} color="#f59e0b" />;
            case 'error': return <AlertTriangle size={18} color="#ef4444" />;
            case 'info': return <Info size={18} color="#3b82f6" />;
          }
        };

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              backgroundColor: '#10131d',
              border: `1px solid ${getBorderColor()}`,
              borderLeft: `4px solid ${getBorderColor()}`,
              borderRadius: '8px',
              padding: '12px 14px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ marginTop: '1px', flexShrink: 0 }}>
              {getIcon()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.3 }}>
                {toast.title}
              </div>
              {toast.message && (
                <div style={{ color: '#9aa4b8', fontSize: '0.78rem', marginTop: '3px', lineHeight: 1.4 }}>
                  {toast.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '2px',
                flexShrink: 0
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
