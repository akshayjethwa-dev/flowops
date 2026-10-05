// src/components/layout/GuardedAction.tsx

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { canPerformAction, PermissionAction } from '../../utils/permissions';

interface GuardedActionProps {
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wraps UI elements (buttons, forms, links) and only renders them 
 * if the current user has the required action permission.
 */
export const GuardedAction: React.FC<GuardedActionProps> = ({ 
  action, 
  children, 
  fallback = null 
}) => {
  const { profile } = useAuth();
  
  if (canPerformAction(profile, action)) {
    return <>{children}</>;
  }
  
  return <>{fallback}</>;
};