// src/components/ui/FieldError.tsx

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface FieldErrorProps {
  message?: string | null;
}

export const FieldError: React.FC<FieldErrorProps> = ({ message }) => {
  if (!message) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center space-x-1 mt-1 text-[10px] font-mono font-bold text-rose-500 uppercase tracking-wide leading-none"
    >
      <AlertCircle className="h-3 w-3 shrink-0" />
      <span>{message}</span>
    </motion.div>
  );
};
