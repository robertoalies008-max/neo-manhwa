import React from 'react';
import { Loader2, ShieldCheck, LogOut, UserPlus, LogIn } from 'lucide-react';

interface LoadingScreenProps {
  action: 'signin' | 'signup' | 'logout' | 'roleswitch';
  roleName?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ action, roleName }) => {
  const getDetails = () => {
    switch (action) {
      case 'signin':
        return {
          icon: <LogIn className="text-blue-400" size={32} />,
          title: 'Authenticating Identity',
          subtitle: 'Decrypting credentials and initializing reading session...',
        };
      case 'signup':
        return {
          icon: <UserPlus className="text-emerald-400" size={32} />,
          title: 'Creating Reader Profile',
          subtitle: 'Allocating cryptographic library vaults and preferences...',
        };
      case 'logout':
        return {
          icon: <LogOut className="text-amber-400" size={32} />,
          title: 'Terminating Session',
          subtitle: 'Flushing cache and resetting permissions to Guest tier...',
        };
      case 'roleswitch':
        return {
          icon: <ShieldCheck className="text-purple-400" size={32} />,
          title: `Simulating Role: ${roleName?.toUpperCase()}`,
          subtitle: 'Recalibrating RBAC access tokens and entity mutation scopes...',
        };
    }
  };

  const details = getDetails();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(5, 6, 9, 0.96)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '2rem'
      }}>
        {/* Radar Ring */}
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          border: '1px solid #232838',
          boxShadow: '0 0 20px rgba(59, 130, 246, 0.1)',
        }} />
        <div style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          border: '1px dashed #30374c',
          animation: 'spin 8s linear infinite'
        }} />
        {/* Spinning Indicator */}
        <Loader2 
          size={56} 
          style={{ 
            color: '#3b82f6', 
            animation: 'spin 1s linear infinite',
            filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.5))' 
          }} 
        />
      </div>

      <div style={{ textAlign: 'center', maxWidth: '420px', padding: '0 1.5rem' }}>
        <h3 style={{ 
          color: '#ffffff', 
          fontSize: '1.25rem', 
          fontWeight: 700, 
          letterSpacing: '-0.01em',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.6rem'
        }}>
          {details.title}
        </h3>
        <p style={{ color: '#828fa6', fontSize: '0.875rem', lineHeight: '1.5' }}>
          {details.subtitle}
        </p>

        {/* Progress bar line */}
        <div style={{
          marginTop: '1.5rem',
          width: '100%',
          height: '3px',
          backgroundColor: '#161a26',
          borderRadius: '4px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            height: '100%',
            width: '45%',
            backgroundColor: '#3b82f6',
            borderRadius: '4px',
            animation: 'pulseGlow 1.2s ease-in-out infinite alternate',
            boxShadow: '0 0 10px #3b82f6'
          }} />
        </div>
      </div>
    </div>
  );
};
