// src/pages/portal/PortalPage.tsx

import React, { useState, useEffect } from 'react';
import { PortalLogin } from './PortalLogin';
import { PortalMain } from './PortalMain';

export const PortalPage: React.FC = () => {
  const [portalUser, setPortalUser] = useState<{ id: string; name: string; phone: string; tenantId: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if the user is verified in previous step
    const savedPhone = localStorage.getItem('portal_auth_phone');
    if (savedPhone) {
      setPortalUser({
        id: 'CUST-DEMO-RAJESH',
        name: 'Ashrey Auto Parts / Pune Gears Corp',
        phone: savedPhone,
        tenantId: 'tenant_1'
      });
    }
    setChecking(false);
  }, []);

  const handleLoginSuccess = (customer: { id: string; name: string; phone: string; tenantId: string }) => {
    setPortalUser(customer);
  };

  const handleLogout = () => {
    localStorage.removeItem('portal_auth_phone');
    setPortalUser(null);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500">
        Bootstrapping Ashrey FlowOps Portal...
      </div>
    );
  }

  if (!portalUser) {
    return <PortalLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return <PortalMain authenticatedUser={portalUser} onLogout={handleLogout} />;
};
