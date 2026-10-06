// src/pages/rfqs/BomScrubberPage.tsx

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BomScrubberView } from '../../components/bom-scrubber/BomScrubberView';
import { ArrowLeft } from 'lucide-react';

export const BomScrubberPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { 
    rfqId?: string; 
    rfqNumber?: string; 
    customerName?: string 
  } | undefined;

  return (
    <div className="space-y-4">
      {/* Back button if linked from RFQ */}
      {state?.rfqId && (
        <button
          onClick={() => navigate(`/rfqs/${state.rfqId}`)}
          className="inline-flex items-center space-x-1.5 text-xs text-slate-500 hover:text-slate-800 font-mono cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to RFQ #{state.rfqNumber || state.rfqId}</span>
        </button>
      )}

      <BomScrubberView
        initialRfqId={state?.rfqId}
        initialRfqNumber={state?.rfqNumber}
        initialCustomerName={state?.customerName}
      />
    </div>
  );
};
