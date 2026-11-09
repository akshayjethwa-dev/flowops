// src/components/orders/VisualOrderLifecycleBar.tsx

import React from 'react';
import { Order } from '../../types';
import { OrderLifecycleStepper } from './OrderLifecycleStepper';

export interface VisualOrderLifecycleBarProps {
  order: Order;
  onHoldToggle?: (putOnHold: boolean, reason?: string) => void;
  canManageHold?: boolean;
}

/**
 * VisualOrderLifecycleBar wraps OrderLifecycleStepper for backward compatibility.
 */
export const VisualOrderLifecycleBar: React.FC<VisualOrderLifecycleBarProps> = (props) => {
  return <OrderLifecycleStepper {...props} />;
};

export default VisualOrderLifecycleBar;
