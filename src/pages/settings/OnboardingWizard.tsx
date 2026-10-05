// src/pages/settings/OnboardingWizard.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTenantConfig } from '../../hooks/useTenantConfig';
import { useProductionStagesConfig } from '../../hooks/useProductionStagesConfig';
import { useCustomersList } from '../../hooks/useCustomersList';
import { useTenantUsers } from '../../hooks/useTenantUsers';
import { useWhatsappConfig } from '../../hooks/useWhatsappConfig';
import { TextField } from '../../components/ui/TextField';
import { UserRole } from '../../types';
import { 
  Building2, 
  Layers, 
  Users, 
  UserPlus, 
  MessageSquare, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  SkipForward, 
  Sparkles, 
  HelpCircle,
  Briefcase,
  Globe,
  MapPin,
  Check,
  AlertCircle
} from 'lucide-react';

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const { tenant, profile } = useAuth();
  
  // Custom hooks
  const { tenantConfig, saveTenantConfig, loading: configLoading } = useTenantConfig(tenant?.id);
  const { stages, overrideStages, loading: stagesLoading } = useProductionStagesConfig(tenant?.id);
  const { addCustomer } = useCustomersList(tenant?.id);
  const { inviteUser } = useTenantUsers(tenant?.id);
  const { saveWhatsappConfig } = useWhatsappConfig(tenant?.id);

  // Wizard active step state
  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 6;
  const [saving, setSaving] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);

  // STEP 1 State: Company Profile
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [currency, setCurrency] = useState('INR (₹)');

  // STEP 2 State: Manufacturing Stages
  const [setupStages, setSetupStages] = useState<Array<{ name: string; color: string; isFinalStage: boolean }>>([
    { name: 'Material Cutting', color: 'indigo', isFinalStage: false },
    { name: 'Forging & Welding', color: 'blue', isFinalStage: false },
    { name: 'Precision Machining', color: 'amber', isFinalStage: false },
    { name: 'NDT & Quality Gate', color: 'pink', isFinalStage: false },
    { name: 'Ready for Dispatch', color: 'green', isFinalStage: true }
  ]);
  const [newStageName, setNewStageName] = useState('');
  const [newStageColor, setNewStageColor] = useState('indigo');

  // STEP 3 State: First Customer
  const [custName, setCustName] = useState('');
  const [custContact, setCustContact] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custAddress, setCustAddress] = useState('');

  // STEP 4 State: Key Team Member
  const [teamMembers, setTeamMembers] = useState<Array<{ name: string; email: string; role: UserRole }>>([]);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<UserRole>('production');

  // STEP 5 State: WhatsApp Details
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [whatsappBsp, setWhatsappBsp] = useState<'AiSensy' | 'Interakt' | 'Other'>('AiSensy');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');

  // Initialize form options on config load matching tenant default info
  useEffect(() => {
    if (tenantConfig) {
      setCompanyName(tenantConfig.tenantName || tenant?.companyName || '');
      setAddress(tenantConfig.address || '');
      setGstNumber(tenantConfig.gstNumber || '');
      setContactEmail(tenantConfig.contactEmail || profile?.email || '');
      setContactPhone(tenantConfig.contactPhone || '');
      setCurrency(tenantConfig.defaultCurrency || 'INR (₹)');

      // If they have existing onboardingState, we restore it
      if (tenantConfig.onboardingState) {
        const saved = tenantConfig.onboardingState;
        if (saved.currentStep) setCurrentStep(saved.currentStep);
        if (saved.companyName) setCompanyName(saved.companyName);
        if (saved.address) setAddress(saved.address);
        if (saved.gstNumber) setGstNumber(saved.gstNumber);
        if (saved.contactEmail) setContactEmail(saved.contactEmail);
        if (saved.contactPhone) setContactPhone(saved.contactPhone);
        if (saved.defaultCurrency) setCurrency(saved.defaultCurrency);
        if (saved.productionStages && saved.productionStages.length > 0) {
          setSetupStages(saved.productionStages);
        }
        if (saved.firstCustomer && saved.firstCustomer.name) {
          setCustName(saved.firstCustomer.name);
          setCustContact(saved.firstCustomer.contactPerson || '');
          setCustEmail(saved.firstCustomer.email || '');
          setCustPhone(saved.firstCustomer.phone || '');
          setCustCity(saved.firstCustomer.city || '');
          setCustAddress(saved.firstCustomer.billingAddress || '');
        }
        if (saved.teamMembers && saved.teamMembers.length > 0) {
          setTeamMembers(saved.teamMembers);
        }
        if (saved.whatsappEnabled !== undefined) {
          setWhatsappEnabled(saved.whatsappEnabled);
          setWhatsappBsp((saved.whatsappBsp as 'Other' | 'AiSensy' | 'Interakt') || 'AiSensy');
          setWhatsappApiKey(saved.whatsappApiKey || '');
          setWhatsappPhone(saved.whatsappPhone || '');
        }
      }
    }
  }, [tenantConfig, tenant, profile]);

  // Color options representation
  const colorOptions = [
    { value: 'indigo', label: 'Indigo Purple' },
    { value: 'blue', label: 'Cobalt Blue' },
    { value: 'sky', label: 'Sky Blue' },
    { value: 'amber', label: 'Amber Orange' },
    { value: 'purple', label: 'Classic Purple' },
    { value: 'pink', label: 'Quality Pink' },
    { value: 'green', label: 'Emerald Green' },
    { value: 'orange', label: 'Deep Orange' },
    { value: 'slate', label: 'Steel Slate' }
  ];

  const getColorHexClass = (col: string) => {
    switch (col) {
      case 'indigo': return 'bg-indigo-600 border-indigo-700';
      case 'blue': return 'bg-blue-650 border-blue-700';
      case 'sky': return 'bg-sky-500 border-sky-600';
      case 'amber': return 'bg-amber-500 border-amber-600';
      case 'purple': return 'bg-purple-600 border-purple-700';
      case 'pink': return 'bg-pink-500 border-pink-600';
      case 'green': return 'bg-emerald-600 border-emerald-700';
      case 'orange': return 'bg-orange-600 border-orange-700';
      default: return 'bg-slate-500 border-slate-600';
    }
  };

  // Intermediate state persistence function
  const saveStateToConfig = async (nextStepIndex: number) => {
    if (!tenantConfig) return;
    setSaving(true);
    setWizardError(null);

    try {
      // Assemble state object representing Wizard variables
      const updatedOnboardingState = {
        currentStep: nextStepIndex,
        companyName,
        address,
        gstNumber,
        contactEmail,
        contactPhone,
        defaultCurrency: currency,
        productionStages: setupStages,
        firstCustomer: {
          name: custName,
          contactPerson: custContact,
          email: custEmail,
          phone: custPhone,
          city: custCity,
          billingAddress: custAddress
        },
        teamMembers,
        whatsappEnabled,
        whatsappBsp,
        whatsappApiKey,
        whatsappPhone
      };

      await saveTenantConfig({
        ...tenantConfig,
        tenantName: companyName,
        address,
        gstNumber,
        contactEmail,
        contactPhone,
        defaultCurrency: currency,
        onboardingCompleted: false,
        onboardingState: updatedOnboardingState
      });

      setCurrentStep(nextStepIndex);
    } catch (err: any) {
      setWizardError(err.message || 'Error occurred saving onboarding state parameters.');
    } finally {
      setSaving(false);
    }
  };

  // Skip and Resume later helper
  const handleSkipWizard = () => {
    sessionStorage.setItem('onboarding_skipped', 'true');
    navigate('/dashboard');
  };

  // STEP BACK NAVIGATION
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // STEP NEXT NAVIGATION
  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // STEP 1 VALIDATION
    if (currentStep === 1) {
      if (!companyName.trim()) {
        setWizardError('Company Name is a mandatory credential.');
        return;
      }
      await saveStateToConfig(2);
    }

    // STEP 2 VALIDATION / SAVING
    else if (currentStep === 2) {
      if (setupStages.length < 2) {
        setWizardError('You must define at least two operational checkpoints.');
        return;
      }
      if (!setupStages.some(s => s.isFinalStage)) {
        setWizardError('One checkpoint must be configured as the "Final Stage" for dispatch processing.');
        return;
      }
      setSaving(true);
      try {
        // Save Stages to database
        await overrideStages(setupStages);
        await saveStateToConfig(3);
      } catch (err: any) {
        setWizardError(err.message || 'Error configuring manufacturing stages.');
      } finally {
        setSaving(false);
      }
    }

    // STEP 3 VALIDATION / SAVING
    else if (currentStep === 3) {
      if (custName.trim()) {
        setSaving(true);
        try {
          await addCustomer({
            name: custName.trim(),
            contactPerson: custContact,
            email: custEmail.trim().toLowerCase(),
            phone: custPhone,
            city: custCity || 'Unknown',
            billingAddress: custAddress || '',
            shippingAddress: custAddress || '',
            type: 'customer',
            gstNumber: '',
            notes: 'Onboarded via First-Time Setup Wizard.',
            tags: ['First Customer'],
            createdAt: new Date().toISOString()
          });
          await saveStateToConfig(4);
        } catch (err: any) {
          setWizardError(err.message || 'Error creating customer record.');
        } finally {
          setSaving(false);
        }
      } else {
        // Skipped customer creation
        await saveStateToConfig(4);
      }
    }

    // STEP 4 VALIDATION / SAVING
    else if (currentStep === 4) {
      setSaving(true);
      try {
        // Trigger all invitations
        for (const tm of teamMembers) {
          await inviteUser(tm.name, tm.email.toLowerCase(), tm.role);
        }
        await saveStateToConfig(5);
      } catch (err: any) {
        setWizardError(err.message || 'Error updating workforce roster.');
      } finally {
        setSaving(false);
      }
    }

    // STEP 5 VALIDATION / SAVING
    else if (currentStep === 5) {
      if (whatsappEnabled && whatsappApiKey.length > 0) {
        setSaving(true);
        try {
          await saveWhatsappConfig({
            bspType: whatsappBsp,
            apiKey: whatsappApiKey,
            senderPhoneNumber: whatsappPhone
          });
          await saveStateToConfig(6);
        } catch (err: any) {
          setWizardError(err.message || 'Error storing your alerts integration parameters.');
        } finally {
          setSaving(false);
        }
      } else {
        await saveStateToConfig(6);
      }
    }
  };

  // FINAL FINISH ACTION
  const handleFinish = async () => {
    if (!tenantConfig) return;
    setSaving(true);
    try {
      // Set completed flag inside config
      await saveTenantConfig({
        ...tenantConfig,
        tenantName: companyName,
        address,
        gstNumber,
        contactEmail,
        contactPhone,
        defaultCurrency: currency,
        onboardingCompleted: true,
        onboardingState: null // Clean up detailed onboarding variables to save database storage space
      });

      // Erase sandbox skipping flag inside session storage
      sessionStorage.removeItem('onboarding_skipped');
      navigate('/dashboard');
    } catch (err: any) {
      setWizardError(err.message || 'Error finalizing onboarding.');
    } finally {
      setSaving(false);
    }
  };

  // Helper handling adding stages
  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    if (setupStages.map(s => s.name.toLowerCase()).includes(newStageName.trim().toLowerCase())) {
      setWizardError('Checkpoint name matches an existing operational node.');
      return;
    }
    const color = newStageColor;
    const finalStages = setupStages.map(s => ({ ...s, isFinalStage: false })); // temporary clear final
    const insertIndex = finalStages.length;
    const newStage = { name: newStageName.trim(), color, isFinalStage: false };
    
    // Add inside array, set final stage
    const updated = [...finalStages, newStage];
    // Re-ensure last stage is final stage
    if (updated.length > 0) {
      updated[updated.length - 1].isFinalStage = true;
    }
    setSetupStages(updated);
    setNewStageName('');
    setWizardError(null);
  };

  // Delete production checkpoints
  const handleDeleteStage = (index: number) => {
    if (setupStages[index].isFinalStage && setupStages.length > 1) {
      setWizardError('Final Stage must persist. Specify another final stage before deletion.');
      return;
    }
    const updated = setupStages.filter((_, idx) => idx !== index);
    if (updated.length > 0 && !updated.some(s => s.isFinalStage)) {
      updated[updated.length - 1].isFinalStage = true;
    }
    setSetupStages(updated);
    setWizardError(null);
  };

  // Reorder milestones helpers
  const handleMoveStage = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= setupStages.length) return;

    const updated = [...setupStages];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;

    // Reset final state to match the new last node in order
    const cleared = updated.map((s, idx) => ({
      ...s,
      isFinalStage: idx === updated.length - 1
    }));

    setSetupStages(cleared);
  };

  // Team members construction helpers
  const handleAddTeamMember = () => {
    if (!memberName.trim() || !memberEmail.trim()) {
      setWizardError('Worker name and corporate email are required credentials.');
      return;
    }
    if (teamMembers.some(m => m.email.toLowerCase() === memberEmail.trim().toLowerCase())) {
      setWizardError('Corporate identity is already scheduled for onboarding.');
      return;
    }
    setTeamMembers([...teamMembers, {
      name: memberName.trim(),
      email: memberEmail.trim(),
      role: memberRole
    }]);
    setMemberName('');
    setMemberEmail('');
    setMemberRole('production');
    setWizardError(null);
  };

  const handleRemoveTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, idx) => idx !== index));
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="animate-spin h-10 w-10 border-4 border-sky-500 border-t-transparent rounded-full mb-4" />
        <p className="text-xs font-mono text-sky-400 uppercase tracking-widest animate-pulse">
          Starting Ashrey Setup Engine...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      
      {/* Wizard Header Bar Controls */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-md sticky top-0 z-50 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 bg-sky-500 text-slate-950 font-extrabold flex items-center justify-center rounded-lg shadow-sky-550/30 shadow-md">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-white uppercase font-mono">Ashrey FlowOps</h1>
            <p className="text-[10px] font-mono font-bold text-sky-400 uppercase tracking-wider leading-none">Interactive Onboarding Shard</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Progress Indicator */}
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] font-mono text-slate-450 uppercase tracking-widest leading-none">Complete Profile Setup</span>
            <span className="text-xs font-semibold text-rose-400 mt-1 font-mono">Step {currentStep} of {totalSteps}</span>
          </div>

          <div className="h-6 w-px bg-slate-900 hidden sm:block" />

          <button
            onClick={handleSkipWizard}
            className="text-[10px] font-mono font-bold text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/50 px-3.5 h-8.5 rounded uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            <span>Skip & Resume Later</span>
          </button>
        </div>
      </header>

      {/* Main Wizard Area Viewport */}
      <main className="flex-grow p-4 md:p-8 flex flex-col justify-center items-center">
        
        {/* Progress Pipeline Dots */}
        <div className="max-w-3xl w-full flex items-center justify-between mb-8 px-4">
          {[1, 2, 3, 4, 5, 6].map((st) => (
            <React.Fragment key={st}>
              <div 
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-all border shrink-0 ${
                  currentStep >= st 
                    ? 'bg-sky-550 text-slate-950 border-sky-400 font-extrabold scale-110 shadow-lg shadow-sky-500/20' 
                    : 'bg-slate-900 text-slate-505 border-slate-800'
                }`}
              >
                {st}
              </div>
              {st < 6 && (
                <div 
                  className={`flex-grow h-0.5 mx-2 transition-colors ${
                    currentStep > st ? 'bg-sky-500' : 'bg-slate-850'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Outer step-specific notification dialogs */}
        {wizardError && (
          <div className="max-w-2xl w-full bg-rose-950/60 border border-rose-900 p-4 rounded-xl flex items-start space-x-3 mb-6 animate-fade-in shadow-lg">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider">Validation Error Dialog</h5>
              <p className="text-xs text-rose-200/90 mt-1 leading-relaxed font-sans">{wizardError}</p>
            </div>
          </div>
        )}

        {/* Primary Step Cards container */}
        <div className="max-w-2xl w-full bg-slate-900 border border-slate-850/80 rounded-2xl shadow-2xl p-6 md:p-10 space-y-6">
          
          <form onSubmit={handleNext} className="space-y-6">
            
            {/* ==================== STEP 1: COMPANY PROFILE ==================== */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-400 tracking-widest block leading-none">Enterprise Credentials</span>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center mt-1">
                    <Building2 className="h-5 w-5 mr-2 text-sky-400" />
                    <span>Company Parameter Profile</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal font-sans">
                    Define the core administrative metadata governing your corporate tenant workspace. These keys populate PDF dispatch challans, cost quotations and legal reports.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Company / Plant Name *
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      placeholder="e.g. Ashrey Castings & Forging Ltd."
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-600 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      GSTIN / Corporate ID Number
                    </label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      placeholder="e.g. 27AADCA1112B1Z1"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-600 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Standard Accounting Currency *
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 focus:bg-slate-950 outline-none transition-all font-sans"
                    >
                      <option value="INR (₹)">INR (₹) - Indian rupee</option>
                      <option value="USD ($)">USD ($) - US Dollar</option>
                      <option value="EUR (€)">EUR (€) - Euro Currency</option>
                      <option value="GBP (£)">GBP (£) - British Pound</option>
                      <option value="AED (AED)">AED - Dirhams</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Primary Contact Email *
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      placeholder="e.g. admin@ashreyforge.co.in"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-600 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Primary Telephone / Hotline
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="e.g. +91 20 61234567"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-600 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Complete Industrial Plant Address
                    </label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Plot 42, GIDC Industrial Estate, Sector 3, Vadodara, Gujarat - 390010"
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded p-3.5 text-xs text-slate-200 placeholder:text-slate-600 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ==================== STEP 2: PRODUCTION STAGES CONFIG ==================== */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-400 tracking-widest block leading-none">Manufacturing Workflow</span>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center mt-1">
                    <Layers className="h-5 w-5 mr-2 text-sky-400" />
                    <span>Manufacturing Checkpoints Layout</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal font-sans">
                    Structure the exact routing milestones that orders track through the plant. Use the Up/Down arrow controllers to reorder checkpoints elegantly.
                  </p>
                </div>

                {/* Stages List */}
                <div className="space-y-2 pt-2 max-h-72 overflow-y-auto">
                  {setupStages.map((stg, ind) => (
                    <div 
                      key={ind} 
                      className={`flex items-center justify-between bg-slate-950 border border-slate-850 p-3.5 rounded-lg text-xs leading-none transition-all ${
                        stg.isFinalStage ? 'border-dashed border-emerald-500/50 bg-emerald-950/10' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Shard color representation */}
                        <div className={`h-4 w-4 rounded-full ${getColorHexClass(stg.color)} border shrink-0`} />
                        <div className="space-y-1">
                          <span className="font-bold text-slate-250 font-sans">{stg.name}</span>
                          {stg.isFinalStage && (
                            <span className="text-[9px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-900 px-1.5 py-0.5 rounded ml-2.5 uppercase font-bold tracking-wider">
                              Final Stage
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Control arrows for re-ordering */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={ind === 0}
                          onClick={() => handleMoveStage(ind, 'up')}
                          className="p-1 px-2 border border-slate-800 text-slate-400 disabled:opacity-20 hover:bg-slate-900 hover:text-white rounded transition-all cursor-pointer"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={ind === setupStages.length - 1}
                          onClick={() => handleMoveStage(ind, 'down')}
                          className="p-1 px-2 border border-slate-800 text-slate-400 disabled:opacity-20 hover:bg-slate-900 hover:text-white rounded transition-all cursor-pointer"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteStage(ind)}
                          className="p-1 px-2 border border-slate-800 text-rose-450 hover:bg-rose-950/20 hover:border-rose-900 rounded transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Create custom stage panel */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-3.5">
                  <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Add Custom Checkpoint Node</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        placeholder="e.g. Thermal Stress Treatment"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded h-10 px-3 text-xs text-slate-200 placeholder:text-slate-650 outline-none transition-all font-sans"
                      />
                    </div>
                    <div>
                      <select
                        value={newStageColor}
                        onChange={(e) => setNewStageColor(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded h-10 px-2 text-xs text-slate-200 outline-none transition-all font-sans"
                      >
                        {colorOptions.map((co) => (
                          <option key={co.value} value={co.value}>{co.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddStage}
                    className="w-full bg-slate-850 border border-slate-800 hover:bg-slate-800 text-slate-100 font-bold uppercase text-[10px] tracking-wider py-2.5 rounded flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Checkpoint to Order</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== STEP 3: ADD FIRST CUSTOMER ==================== */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-400 tracking-widest block leading-none">Commercial CRM Seed</span>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center mt-1">
                    <Users className="h-5 w-5 mr-2 text-sky-400" />
                    <span>Register Your First Customer</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal font-sans">
                    Authorize a seed client record in your workspace registry. This unlocks immediate RFQ quotation trials on the dashboard. You can leave this empty to skip for now.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Customer / Corporate Account Name
                    </label>
                    <input
                      type="text"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      placeholder="e.g. Kirloskar Heavy Pumps Division"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Key Contact Person
                    </label>
                    <input
                      type="text"
                      value={custContact}
                      onChange={(e) => setCustContact(e.target.value)}
                      placeholder="e.g. Anil Kulkarni"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      City / Region Location
                    </label>
                    <input
                      type="text"
                      value={custCity}
                      onChange={(e) => setCustCity(e.target.value)}
                      placeholder="e.g. Pune, MH"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Business Email Address
                    </label>
                    <input
                      type="email"
                      value={custEmail}
                      onChange={(e) => setCustEmail(e.target.value)}
                      placeholder="e.g. anil@kirloskar.co.in"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Business Phone / Mobile
                    </label>
                    <input
                      type="text"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      placeholder="e.g. +91 9881234567"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Complete Mailing / Shipping Address
                    </label>
                    <textarea
                      value={custAddress}
                      onChange={(e) => setCustAddress(e.target.value)}
                      placeholder="e.g. Plot 15, MIDC Phase 3, Hinjewadi, Pune - 411057"
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded p-3 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ==================== STEP 4: ADD KEY TEAM MEMBERS ==================== */}
            {currentStep === 4 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-400 tracking-widest block leading-none">Security & Role assignment</span>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center mt-1">
                    <UserPlus className="h-5 w-5 mr-2 text-sky-400" />
                    <span>Onboard Key Team Members</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal font-sans">
                    Construct credentials for other shopfloor operators. They receive secure access to their corresponding modules immediately. You can skip this or add later.
                  </p>
                </div>

                {/* Team Members List */}
                {teamMembers.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto pt-1.5">
                    {teamMembers.map((member, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between bg-slate-950 border border-slate-850 p-3 rounded-lg text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-slate-850 border border-slate-800 text-sky-400 font-black flex items-center justify-center font-mono text-[10px]">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5">
                            <h5 className="font-bold text-slate-200 font-sans">{member.name}</h5>
                            <span className="text-[10px] text-slate-450 font-mono">{member.email}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <span className="text-[9px] font-mono font-bold border border-sky-900 bg-sky-955 text-sky-400 px-2 py-0.5 rounded uppercase tracking-wider">
                            {member.role}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTeamMember(idx)}
                            className="p-1 text-rose-450 hover:bg-rose-950/20 hover:border-rose-900 rounded border border-transparent transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Team addition form */}
                <div className="bg-slate-950 p-4.5 rounded-xl border border-slate-850 space-y-3.5">
                  <h4 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none">Onboard New Plant User</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[9px] font-mono font-bold text-slate-450 uppercase mb-1">Full Operator Name</label>
                      <input
                        type="text"
                        value={memberName}
                        onChange={(e) => setMemberName(e.target.value)}
                        placeholder="e.g. Ramesh Deshmukh"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded h-10 px-3 text-xs text-slate-200 placeholder:text-slate-650 outline-none transition-all font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-mono font-bold text-slate-450 uppercase mb-1">Corporate Email Address</label>
                      <input
                        type="email"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        placeholder="e.g. ramesh@company.com"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded h-10 px-3 text-xs text-slate-200 placeholder:text-slate-650 outline-none transition-all font-sans"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[9px] font-mono font-bold text-slate-450 uppercase mb-1">Assigned Operational Role Title</label>
                      <select
                        value={memberRole}
                        onChange={(e) => setMemberRole(e.target.value as UserRole)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-sky-500 rounded h-10 px-3.5 text-xs text-slate-200 outline-none transition-all font-sans"
                      >
                        <option value="production">Shopfloor Supervisor (Routing & Production line)</option>
                        <option value="sales">Sales Engineer (RFQs & Commercial Quotations)</option>
                        <option value="dispatch">Dispatch Clerk (Cargo & Lorry inward Challans)</option>
                        <option value="management font-bold">Plant General Manager (Plant metrics read access)</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddTeamMember}
                    className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-sky-400 font-bold uppercase text-[10px] tracking-wider py-2.5 rounded flex items-center justify-center space-x-1.5 cursor-pointer transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Append Operator to Team</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== STEP 5: WHATSAPP NOTIFICATIONS CONFIG ==================== */}
            {currentStep === 5 && (
              <div className="space-y-5 animate-fade-in">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase text-sky-400 tracking-widest block leading-none">Automated Outbound Alerts</span>
                  <h3 className="text-lg font-bold text-white tracking-tight flex items-center mt-1">
                    <MessageSquare className="h-5 w-5 mr-2 text-sky-400" />
                    <span>WhatsApp Basics Configurations</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-normal font-sans">
                    Link your Business Gateway credentials to trigger instant production checkpoint alerts directly to client devices. This is entirely optional and skipable.
                  </p>
                </div>

                {/* Enable checkbox */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 flex items-center justify-between">
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-200 text-xs font-sans">Enable Real-Time WhatsApp Alerts</h5>
                    <p className="text-[10px] text-slate-450 leading-relaxed font-sans">Use AiSensy or other BSP channels to ping Customers on dispatch.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="h-5 w-5 bg-slate-900 border border-slate-800 rounded focus:ring-sky-500 checked:bg-sky-500 rounded-sm shrink-0 cursor-pointer"
                  />
                </div>

                {whatsappEnabled && (
                  <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-850">
                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        BSP Integration Gateway Type
                      </label>
                      <select
                        value={whatsappBsp}
                        onChange={(e) => setWhatsappBsp(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 focus:bg-slate-900 outline-none transition-all font-sans"
                      >
                        <option value="AiSensy">AiSensy Official BSP</option>
                        <option value="Interakt">Interakt Business Hub</option>
                        <option value="Other">Custom HTTP API Bridge</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Outbound API Authorization Key (Secret)
                      </label>
                      <input
                        type="password"
                        value={whatsappApiKey}
                        onChange={(e) => setWhatsappApiKey(e.target.value)}
                        placeholder="e.g. key_103859275932..."
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        Sender Register Mobile (E.164 Format)
                      </label>
                      <input
                        type="text"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        placeholder="e.g. +919876543210"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-sky-500 rounded h-11 px-3.5 text-xs text-slate-200 placeholder:text-slate-650 focus:bg-slate-900 outline-none transition-all font-sans"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== STEP 6: FINISH CELEBRATION ==================== */}
            {currentStep === 6 && (
              <div className="space-y-6 text-center py-6 animate-fade-in font-sans">
                <div className="h-16 w-16 bg-gradient-to-tr from-sky-400 to-sky-600 rounded-2xl flex items-center justify-center text-slate-950 font-black mx-auto shadow-sky-500/20 shadow-xl scale-110 mb-4 animate-bounce">
                  <Sparkles className="h-8 w-8 text-slate-950" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-mono font-bold text-sky-450 uppercase tracking-widest leading-none">Setup Engine Done</h4>
                  <h2 className="text-xl font-bold tracking-tight text-white font-sans">Bharat Forge core setup constructed!</h2>
                  <p className="text-xs text-slate-450 leading-relaxed max-w-md mx-auto">
                    Your company parameters profile, checkpoints line, seed customer, and workspace security permissions have been successfully written to the database!
                  </p>
                </div>

                {/* Setup Summary list */}
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-850 text-left max-w-md mx-auto space-y-3 font-sans">
                  <h5 className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none pb-2 border-b border-slate-900">Workspace Summary Parameter</h5>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-450">Company Profile:</span>
                    <span className="text-white font-bold">{companyName || 'Not Set'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-450">Active Milestones:</span>
                    <span className="text-white font-bold font-mono">{setupStages.length} Checkpoints Configured</span>
                  </div>

                  {custName && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-450">Registered Client:</span>
                      <span className="text-white font-bold">{custName}</span>
                    </div>
                  )}

                  {teamMembers.length > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-450">Workforce Roster:</span>
                      <span className="text-white font-bold font-mono">{teamMembers.length} Accounts Invited</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-450">WhatsApp Alerts:</span>
                    <span className={`font-mono font-bold ${whatsappEnabled ? 'text-emerald-450' : 'text-slate-500'}`}>
                      {whatsappEnabled ? 'Operational & Syncing' : 'Bypassed config'}
                    </span>
                  </div>
                </div>

                <p className="text-[10px] leading-relaxed text-sky-350 max-w-sm mx-auto font-mono">
                  💡 Clicking "Launch Dashboard" initializes client access configurations securely. On subsequent logins, users route instantly to their respective operational boards.
                </p>
              </div>
            )}

            {/* Bottom Actions panel */}
            <div className="pt-4 border-t border-slate-850 flex items-center justify-between gap-4">
              
              {/* BACK BUTTON */}
              {currentStep > 1 && currentStep < 6 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleBack}
                  className="px-5 py-3 border border-slate-800 text-slate-350 hover:bg-slate-850 hover:text-white rounded-lg flex items-center space-x-1.5 cursor-pointer text-xs font-mono font-bold uppercase transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Back</span>
                </button>
              )}

              {/* EMPTY PLACEHOLDER TO KEEP BUTTON ALIGNED RIGHT */}
              {currentStep === 1 && <div />}

              {/* NEXT / FINISH KEY BUTTONS */}
              {currentStep < 6 ? (
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold px-6 py-3 rounded-lg flex items-center space-x-1.5 cursor-pointer text-xs uppercase tracking-wider ml-auto h-11 transition-all shadow-md active:scale-95"
                >
                  <span>{saving ? 'Processing State...' : 'Save & Proceed'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinish}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-4.5 rounded-lg flex items-center justify-center space-x-1.5 cursor-pointer text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/10 active:scale-95 h-13"
                >
                  <Check className="h-4.5 w-4.5 text-slate-950 stroke-[3]" />
                  <span>{saving ? 'Finalizing Profile Configurations...' : 'Launch Shard Dashboard'}</span>
                </button>
              )}

            </div>

          </form>

        </div>

      </main>

    </div>
  );
};
