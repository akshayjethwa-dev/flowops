import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  PhoneCall,
  Users,
  FileText,
  Cpu,
  Layers,
  Send,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Play,
  X,
  Building2,
  ChevronRight,
  Phone,
  Settings,
  Grid,
  Check,
  MapPin,
  Clock,
  Clock4,
  Briefcase,
  ExternalLink,
  Lock
} from 'lucide-react';

export function LandingPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toastSuccess, toastError } = useToast();

  React.useEffect(() => {
    if (user || profile) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, profile, navigate]);

  // Lead Form state
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    phone: '',
    industry: '',
    message: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Video walkthrough modal simulation state
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  // Dashboard mockup simulation state
  const [mockSelectedJob, setMockSelectedJob] = useState('job-01');

  // Multi-step walkthrough steps
  const simulationSteps = [
    {
      title: "1. Incoming WhatsApp RFQ",
      desc: "An inquiry lands from a Vadodara-based dealer requesting a quote for 400 custom spur gears. Handled instantly.",
      badge: "WhatsApp RFQ",
      pillColor: "bg-teal-100 text-teal-800"
    },
    {
      title: "2. Instant Estimate & Quotation",
      desc: "One-click rate analysis and professional quote formulation. GST calculations done automatically and PDF texted to dealer.",
      badge: "Quotation Formulated",
      pillColor: "bg-blue-100 text-blue-800"
    },
    {
      title: "3. Direct Production Stage Tracking",
      desc: "The shop floor starts Machining, Case Hardening, and Drills. Every supervisor checks stages in-app from tablet devices in real-time.",
      badge: "In Production",
      pillColor: "bg-yellow-105 text-yellow-850"
    },
    {
      title: "4. automated dispatch & Transit updates",
      desc: "Consignment loaded, Lorry Receipt (LR) number registered. System sends out automated real-time dispatch updates to dealer via WhatsApp.",
      badge: "Dispatched & Updated",
      pillColor: "bg-green-100 text-green-800"
    }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.companyName || !formData.phone || !formData.industry) {
      toastError('Validation Mismatch', 'Please complete all required fields to submit.');
      return;
    }

    setSubmitting(true);
    try {
      // Store directly into Firestore leads collection
      await addDoc(collection(db, 'demo_requests'), {
        ...formData,
        timestamp: serverTimestamp(),
        source: 'Landing Page Form',
        status: 'NEW',
        dateStr: new Date().toISOString()
      });

      toastSuccess(
        'Request Logged Successfully!',
        `Thank you ${formData.name}. Our Anand representative will contact you on ${formData.phone} shortly.`,
        6000
      );
      setSubmitted(true);
    } catch (err: any) {
      console.error("Firestore Lead Capture Error: ", err);
      // Fallback local persistence if offline
      const offlineLeads = JSON.parse(localStorage.getItem('offline_demo_leads') || '[]');
      offlineLeads.push({ ...formData, timestamp: new Date().toISOString() });
      localStorage.setItem('offline_demo_leads', JSON.stringify(offlineLeads));

      toastSuccess(
        'Demo Request Cached Offline',
        'Thank you! Your information is recorded. We will connect shortly.'
      );
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans antialiased text-slate-800 selection:bg-teal-500 selection:text-white">
      
      {/* Dynamic Header Navbar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Logo Group */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-teal-700 flex items-center justify-center text-white shadow-md shadow-teal-700/20">
                <Cpu className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <span className="font-display text-xl font-bold tracking-tight text-slate-910">
                  Ashrey <span className="text-teal-700 font-extrabold text-base px-1.5 py-0.5 rounded-md bg-teal-50 ml-1">FlowOps</span>
                </span>
                <p className="text-[10px] font-mono tracking-widest uppercase text-slate-405">
                  Anand, Gujarat
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-8">
              <button 
                onClick={() => scrollToSection('pain-points')} 
                className="text-sm font-medium text-slate-600 hover:text-teal-700 transition-colors pointer-events-auto cursor-pointer"
              >
                Challenges
              </button>
              <button 
                onClick={() => scrollToSection('how-it-works')} 
                className="text-sm font-medium text-slate-600 hover:text-teal-700 transition-colors pointer-events-auto cursor-pointer"
              >
                Workflow
              </button>
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-sm font-medium text-slate-600 hover:text-teal-700 transition-colors pointer-events-auto cursor-pointer"
              >
                Modules
              </button>
              <button 
                onClick={() => scrollToSection('industries')} 
                className="text-sm font-medium text-slate-600 hover:text-teal-700 transition-colors pointer-events-auto cursor-pointer"
              >
                Industries
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="text-sm font-medium text-slate-600 hover:text-teal-700 transition-colors pointer-events-auto cursor-pointer"
              >
                Pricing
              </button>
            </nav>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/rfq-submit')}
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-all flex items-center gap-1.5 pointer-events-auto cursor-pointer"
                id="landing-submit-rfq-btn"
                title="Customer Web RFQ & BOM Upload"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Submit RFQ</span>
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-teal-700 hover:bg-slate-100/70 rounded-lg transition-all flex items-center gap-1.5 pointer-events-auto cursor-pointer"
                id="landing-signin-btn"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In
              </button>
              <button
                onClick={() => scrollToSection('demo-request')}
                className="hidden sm:flex px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-medium text-sm rounded-lg transition-all shadow-md shadow-teal-700/15 items-center gap-1 hover:translate-y-[-1px] pointer-events-auto cursor-pointer"
                id="landing-demo-top-btn"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Section 1: Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-radial from-white via-slate-50 to-slate-100">
        {/* Subtle grid accent background */}
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(to_right,#0f766e08_1px,transparent_1px),linear-gradient(to_bottom,#0f766e08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Copy block */}
            <div className="lg:col-span-6 flex flex-col items-start text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-55 text-teal-800 uppercase tracking-wider mb-6">
                <MapPin className="h-3 w-3" /> Built for Indian GIDC Manufacturers
              </span>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[54px] leading-tight font-extrabold text-slate-900 tracking-tight mb-6">
                Run Your Factory.<br />
                <span className="text-teal-700 bg-gradient-to-r from-teal-700 to-teal-900 bg-clip-text text-transparent">Not Your Inbox.</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-500 leading-relaxed max-w-2xl mb-8">
                FlowOps connects RFQs, production jobs, dispatch updates, and dealer communication in one single, robust digital platform. Streamline your shop floor, stop manual WhatsApp chaos, and drive production from Anand to any corner of India.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <button
                  onClick={() => scrollToSection('demo-request')}
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-teal-700 hover:bg-teal-800 text-white font-semibold text-base rounded-xl cursor-pointer pointer-events-auto transition-all shadow-lg shadow-teal-700/25 active:scale-[0.98]"
                  id="hero-request-demo-btn"
                >
                  Request a Free Demo
                  <ChevronRight className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setShowVideoModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 hover:border-slate-300 font-semibold text-base rounded-xl cursor-pointer pointer-events-auto transition-all active:scale-[0.98]"
                  id="hero-video-btn"
                >
                  <Play className="h-5 w-5 text-teal-700 fill-teal-700" />
                  Watch 2-min Walkthrough
                </button>
              </div>

              {/* Highlights badge */}
              <div className="mt-10 pt-8 border-t border-slate-200 w-full grid grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xl font-bold font-display text-slate-800">400+</h4>
                  <p className="text-xs text-slate-400">Quotations Processed</p>
                </div>
                <div>
                  <h4 className="text-xl font-bold font-display text-slate-800">99.8%</h4>
                  <p className="text-xs text-slate-400">Challan Accuracy</p>
                </div>
                <div>
                  <h4 className="text-xl font-bold font-display text-slate-800">10x</h4>
                  <p className="text-xs text-slate-400">Faster Dealer Updates</p>
                </div>
              </div>
            </div>

            {/* Right Interactive Mockup Dashboard */}
            <div className="lg:col-span-6 relative w-full">
              <div className="absolute inset-0 bg-teal-400/10 rounded-3xl blur-2xl transform rotate-2 pointer-events-none" />
              
              {/* Mock Dashboard Shell */}
              <div className="relative bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden text-left text-slate-305 font-sans">
                {/* Window header */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950/80 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500 block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500 block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500 block" />
                    <span className="ml-2 text-xs font-mono text-slate-500">bharat-gears.flowops.app/dashboard</span>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-teal-950/80 text-teal-400 border border-teal-900/50 px-2 py-0.5 rounded">
                    LIVE SYSTEM DEMO
                  </span>
                </div>

                {/* Dashboard Inner content */}
                <div className="p-5 space-y-4">
                  {/* Top quick metrics row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Live RFQ Count</span>
                      <p className="text-lg font-bold text-teal-400 font-display mt-0.5">18 Active</p>
                      <span className="text-[9px] text-green-400 flex items-center font-mono mt-0.5">▲ +12% today</span>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Shopfloor Load</span>
                      <p className="text-lg font-bold text-blue-400 font-display mt-0.5">42 Jobs WIP</p>
                      <span className="text-[9px] text-slate-450 font-mono mt-0.5">3 dispatch ready</span>
                    </div>
                    <div className="bg-slate-800/40 border border-slate-800 p-3 rounded-xl">
                      <span className="text-[10px] font-mono text-slate-400 uppercase">WhatsApp API status</span>
                      <p className="text-lg font-bold text-emerald-400 font-display mt-0.5">Connected</p>
                      <span className="text-[9px] text-emerald-400 flex items-center font-mono mt-0.5">● Active Gateway</span>
                    </div>
                  </div>

                  {/* Orders stage visualization */}
                  <div className="bg-slate-800/20 border border-slate-850 p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-white tracking-wide">Ongoing Jobs & Production Stages</span>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Anand Unit-1</span>
                    </div>

                    <div className="space-y-2.5">
                      {/* Job 1 */}
                      <div 
                        onClick={() => setMockSelectedJob('job-01')}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                          mockSelectedJob === 'job-01' 
                            ? 'bg-teal-950/30 border-teal-800 text-white' 
                            : 'bg-slate-800/20 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-mono font-semibold text-slate-200">#JOB-2026-4412 <span className="text-[10px] text-slate-400">(Amul Feed Plant)</span></span>
                          <span className="text-[10px] font-mono bg-teal-900/60 text-teal-200 border border-teal-800/50 px-1.5 py-0.5 rounded">Case Hardening</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: '75%' }} />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                          <span>Qty: 250 Spur Gears</span>
                          <span>Est. Completion: Tomorrow 3 PM</span>
                        </div>
                      </div>

                      {/* Job 2 */}
                      <div 
                        onClick={() => setMockSelectedJob('job-02')}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                          mockSelectedJob === 'job-02' 
                            ? 'bg-teal-950/30 border-teal-800 text-white' 
                            : 'bg-slate-800/20 border-slate-800 hover:border-slate-705'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs mb-1.5">
                          <span className="font-mono font-semibold text-slate-200">#JOB-2026-4415 <span className="text-[10px] text-slate-400">(Baroda Foundry)</span></span>
                          <span className="text-[10px] font-mono bg-amber-900/60 text-amber-250 border border-amber-800/50 px-1.5 py-0.5 rounded">CNC Machining</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: '40%' }} />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                          <span>Qty: 50 Heavy Cast Flanges</span>
                          <span>Est. Completion: 06 Jun</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Simulated Output WhatsApp Feed on interactions */}
                  <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg font-mono text-xs">
                    <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2 mb-2">
                      <span className="text-[10px] text-emerald-450 uppercase tracking-widest flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> WhatsApp Simulated Event Logs
                      </span>
                      <span className="text-[10px]">Just Now</span>
                    </div>
                    {mockSelectedJob === 'job-01' ? (
                      <div className="text-slate-350 space-y-1">
                        <p className="text-emerald-400 font-semibold">[AUTO_SEND] To: Amul Procurement (+91 94292 XXXXX)</p>
                        <p className="text-[11px] leading-relaxed italic text-slate-400">
                          "Namaste. Your spur gear order #4412 has successfully finished 'Machining' and holds state 'Case Hardening' at our Anand Works. Track live at: flowops.in/portal/shreehari-gears"
                        </p>
                      </div>
                    ) : (
                      <div className="text-slate-350 space-y-1">
                        <p className="text-amber-400 font-semibold">[AUTO_SEND] To: Baroda Foundry Purchase (+91 98980 XXXXX)</p>
                        <p className="text-[11px] leading-relaxed italic text-slate-400">
                          "Namaste. Order #4415 update: Blank alignment and 'CNC Machining' commenced. Estimated delivery updated to 06 June."
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Section 2: Pain Points Section */}
      <section id="pain-points" className="py-20 sm:py-28 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold tracking-widest uppercase text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
              Industrial Friction Points
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Sound familiar?
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              If you run an SME manufacturing workshop in Gujarat, you know how operations get tangled up. Manual follow-ups extract a high cost on growth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Card 1 */}
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-start transition-all hover:shadow-xl hover:border-slate-300 group">
              <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 border border-teal-100 group-hover:bg-teal-700 group-hover:text-white transition-all mb-6">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 mb-3">
                Your sales inquiries live in 5 different WhatsApp chats
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Dealers send blueprints on personal numbers, raw notes are lost in conversations, and quotations are delayed because specs got buried under chat history.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-start transition-all hover:shadow-xl hover:border-slate-300 group">
              <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 border border-teal-100 group-hover:bg-teal-700 group-hover:text-white transition-all mb-6">
                <PhoneCall className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 mb-3">
                You call the shop floor 10 times a day to ask "what stage is this order?"
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                No central record of who is blanking, grinding, or drilling. To give your customers a delivery timeline, you have to physically find the foreman.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-slate-50 border border-slate-200 p-8 rounded-2xl flex flex-col items-start transition-all hover:shadow-xl hover:border-slate-300 group">
              <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700 border border-teal-100 group-hover:bg-teal-700 group-hover:text-white transition-all mb-6">
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900 mb-3">
                Your dealers don't know where their order is until they call you
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Dealers wait impatiently. They have to constantly keep check on you for packing vouchers and Lorry Receipts (LR), creating avoidable friction.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Section 3: How It Works Section */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="text-xs font-extrabold tracking-widest uppercase text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
              Seamless Automation Loop
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              One system. Your entire operation.
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              We replace chaos with structured, automated stages that sync GIDC operations silently from start to finish.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative">
            {/* Step 1 */}
            <div className="relative flex flex-col items-start p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <span className="absolute -top-4 left-6 h-8 w-8 bg-teal-750 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
              <div className="text-teal-700 flex items-center justify-center h-10 w-10 rounded-lg bg-teal-50 border border-teal-100 mb-4 mt-2">
                <FileText className="h-5 w-5" />
              </div>
              <h4 className="font-display text-base font-bold text-slate-900 mb-2">RFQ arrives</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Inquiries are logged instantly. Generate and send quotations in under 2 minutes. Follow-up responses are tracked in a clean sales board.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative flex flex-col items-start p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <span className="absolute -top-4 left-6 h-8 w-8 bg-teal-750 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
              <div className="text-teal-700 flex items-center justify-center h-10 w-10 rounded-lg bg-teal-50 border border-teal-100 mb-4 mt-2">
                <Layers className="h-5 w-5" />
              </div>
              <h4 className="font-display text-base font-bold text-slate-900 mb-2">Order confirmed</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Accepted quotations automatically translate into active production jobs. Stages populate instantly onto the foreman's shopfloor board.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative flex flex-col items-start p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <span className="absolute -top-4 left-6 h-8 w-8 bg-teal-750 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
              <div className="text-teal-700 flex items-center justify-center h-10 w-10 rounded-lg bg-teal-50 border border-teal-100 mb-4 mt-2">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h4 className="font-display text-base font-bold text-slate-900 mb-2">Stage changes update</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                As the job transitions to another department (e.g. Grinding or Heat Treatment), the system automatically triggers a WhatsApp alert to the client.
              </p>
            </div>

            {/* Step 4 */}
            <div className="relative flex flex-col items-start p-6 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
              <span className="absolute -top-4 left-6 h-8 w-8 bg-teal-750 text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
              <div className="text-teal-700 flex items-center justify-center h-10 w-10 rounded-lg bg-teal-50 border border-teal-100 mb-4 mt-2">
                <Send className="h-5 w-5" />
              </div>
              <h4 className="font-display text-base font-bold text-slate-900 mb-2">Dispatched smoothly</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Instantly shares the Lorry Receipt (LR) and dispatch notes with the dealer or customer via WhatsApp. Consignment status maps live on their tracking portal.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* Section 4: Module Features Grid */}
      <section id="features" className="py-20 sm:py-28 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-20">
            <span className="text-xs font-extrabold tracking-widest uppercase text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
              Enterprise Grade Modules
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Everything your team needs
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              We built FlowOps with raw, operational clarity specifically for multi-stage fabrication, casting, and engineering ecosystems.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* Feature 1 */}
            <div className="border border-slate-200 hover:border-teal-600/30 p-6 rounded-2xl transition-all hover:shadow-lg bg-slate-50/50">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-750 font-semibold mb-5">
                <FileText className="h-5 w-5" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 mb-2">RFQ & Quotation Management</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Add drawings, capture custom dimensional parameters, calculate tax variations automatically, and formulate clean GST quotations that close deals at first contact.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="border border-slate-200 hover:border-teal-600/30 p-6 rounded-2xl transition-all hover:shadow-lg bg-slate-50/50">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-750 font-semibold mb-5">
                <Settings className="h-5 w-5" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 mb-2">Production Board & Job Tracking</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Break work down across sequence stages. Supervise current queue load, allocate target machines, track delays, and manage overall shop floor operations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="border border-slate-200 hover:border-teal-600/30 p-6 rounded-2xl transition-all hover:shadow-lg bg-slate-50/50">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-750 font-semibold mb-5">
                <Send className="h-5 w-5" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 mb-2">Dispatch & Logistics</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Create shipping challans instantly, enter transporter schedules, and record transit LR numbers. Maintain clear history records of dispatches with no missing details.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="border border-slate-200 hover:border-teal-600/30 p-6 rounded-2xl transition-all hover:shadow-lg bg-slate-50/50">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-750 font-semibold mb-5">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 mb-2">WhatsApp Automation</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Integrates and transmits automated transactional order updates directly. Say goodbye to manual calls. Ensure dealers receive notifications at every step of production.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="border border-slate-200 hover:border-teal-600/30 p-6 rounded-2xl transition-all hover:shadow-lg bg-slate-50/50">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-750 font-semibold mb-5">
                <Users className="h-5 w-5" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 mb-2">Dealer / Customer Portal</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Give your customers a beautiful private login dashboard where they can review pending quotes, inspect order production status live, and request fresh RFQs seamlessly.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="border border-slate-200 hover:border-teal-600/30 p-6 rounded-2xl transition-all hover:shadow-lg bg-slate-50/50">
              <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-750 font-semibold mb-5">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h4 className="font-display text-lg font-bold text-slate-900 mb-2">Management Dashboard</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                A simple dashboard featuring detailed insights on pending quotes, active production logs, outstanding invoice balances, and upcoming client deliveries.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Section 5: Who Is It For Segment */}
      <section id="industries" className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold tracking-widest uppercase text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
              Tailored Sector Solutions
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Built for manufacturers like you
            </h2>
            <p className="text-sm sm:text-base text-slate-500 mt-3 leading-relaxed">
              Serving industrial sectors across GIDCs (Anand, Vitthal Udyognagar, Vatva, Kalol, Waghodia, Savli, Metoda).
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            
            <div className="p-5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs hover:border-teal-605 hover:shadow-md transition-all">
              <div className="h-10 w-10 bg-teal-50 text-teal-750 rounded-lg flex items-center justify-center font-display font-bold">GE</div>
              <span className="text-sm font-semibold text-slate-800">Gears & Engineering</span>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs hover:border-teal-605 hover:shadow-md transition-all">
              <div className="h-10 w-10 bg-teal-50 text-teal-750 rounded-lg flex items-center justify-center font-display font-bold">CF</div>
              <span className="text-sm font-semibold text-slate-800">Castings & Foundry</span>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs hover:border-teal-605 hover:shadow-md transition-all">
              <div className="h-10 w-10 bg-teal-50 text-teal-750 rounded-lg flex items-center justify-center font-display font-bold">WP</div>
              <span className="text-sm font-semibold text-slate-800">Welding Products</span>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs hover:border-teal-605 hover:shadow-md transition-all">
              <div className="h-10 w-10 bg-teal-50 text-teal-750 rounded-lg flex items-center justify-center font-display font-bold">AF</div>
              <span className="text-sm font-semibold text-slate-800">Animal Feed</span>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs hover:border-teal-605 hover:shadow-md transition-all">
              <div className="h-10 w-10 bg-teal-50 text-teal-750 rounded-lg flex items-center justify-center font-display font-bold">IP</div>
              <span className="text-sm font-semibold text-slate-800">Industrial Packaging</span>
            </div>

            <div className="p-5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs hover:border-teal-605 hover:shadow-md transition-all">
              <div className="h-10 w-10 bg-teal-50 text-teal-750 rounded-lg flex items-center justify-center font-display font-bold">IE</div>
              <span className="text-sm font-semibold text-slate-800">Industrial Equipment</span>
            </div>

          </div>

        </div>
      </section>

      {/* Section 6: Pricing Teaser Section */}
      <section id="pricing" className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold tracking-widest uppercase text-teal-700 bg-teal-50 px-3 py-1 rounded-full">
              Transparent Model
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mt-4">
              Transparent pricing. No surprises.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-2 font-mono">
              Starting at ₹9,000/month + one-time setup
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            
            {/* Plan 1 */}
            <div className="border border-slate-200 p-8 rounded-2xl bg-slate-50/50 flex flex-col justify-between hover:border-slate-350 transition-all flex-grow">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">Starter Plan</span>
                <span className="text-xl font-bold text-slate-900 block font-display">SME Workshop</span>
                <div className="my-6">
                  <span className="text-2xl font-extrabold text-slate-900">₹9,000</span>
                  <span className="text-xs text-slate-400 font-mono"> / month</span>
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Best for workshops transitioning out of paper notes and personal WhatsApp order taking.
                </p>
                <div className="border-t border-slate-200 pt-6 space-y-3 mb-8">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-teal-650" />
                    Up to 5 Shopfloor Operators
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-teal-650" />
                    Active Production Pipeline (Kanban)
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-teal-650" />
                    Automated Status alerts on WhatsApp
                  </div>
                </div>
              </div>
              <button 
                onClick={() => scrollToSection('demo-request')}
                className="w-full py-3 border border-slate-200 hover:border-teal-700 text-slate-700 hover:text-teal-700 bg-white font-medium text-xs rounded-lg transition-all text-center cursor-pointer"
              >
                Talk to us for exact pricing
              </button>
            </div>

            {/* Plan 2 */}
            <div className="border-2 border-teal-700 p-8 rounded-2xl bg-white flex flex-col justify-between shadow-xl relative transform lg:scale-105 flex-grow">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-teal-700 text-white text-[9px] font-mono font-bold uppercase py-1 px-3.5 tracking-wider rounded-full">
                Most Popular
              </span>
              <div>
                <span className="text-xs font-mono text-teal-700 uppercase tracking-wider block mb-2">Growth Plan</span>
                <span className="text-xl font-bold text-slate-950 block font-display">Factory Floor</span>
                <div className="my-6">
                  <span className="text-2xl font-extrabold text-slate-950">Contact Us</span>
                  <span className="text-xs text-slate-400 font-mono"> for volume pricing</span>
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Engineered for larger enterprises requiring dedicated custom stage routes and unlimited dealer connections.
                </p>
                <div className="border-t border-slate-200 pt-6 space-y-3 mb-8">
                  <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                    <Check className="h-4 w-4 text-teal-700" />
                    Unlimited Operator seats
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-750 font-medium font-semibold">
                    <Check className="h-4 w-4 text-teal-700" />
                    Dedicated Dealer / Customer Portals
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-755 font-medium">
                    <Check className="h-4 w-4 text-teal-700" />
                    Multi-Unit production stages sequencing
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-755 font-medium">
                    <Check className="h-4 w-4 text-teal-700" />
                    Extended custom invoice reports
                  </div>
                </div>
              </div>
              <button 
                onClick={() => scrollToSection('demo-request')}
                className="w-full py-3 bg-teal-705 hover:bg-teal-800 text-white font-semibold text-xs rounded-lg shadow-md hover:shadow-lg transition-all text-center cursor-pointer"
              >
                Inquire Details
              </button>
            </div>

            {/* Plan 3 */}
            <div className="border border-slate-200 p-8 rounded-2xl bg-slate-50/50 flex flex-col justify-between hover:border-slate-350 transition-all flex-grow">
              <div>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-2">Enterprise Plan</span>
                <span className="text-xl font-bold text-slate-900 block font-display">Industrial Cluster</span>
                <div className="my-6">
                  <span className="text-2xl font-extrabold text-slate-900">Custom</span>
                  <span className="text-xs text-slate-400 font-mono"> requirements</span>
                </div>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                  Engineered for businesses with customized ERP integrations, dedicated database sandboxes, and unique workflows.
                </p>
                <div className="border-t border-slate-200 pt-6 space-y-3 mb-8">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-teal-650" />
                    On-Premise server capability matching
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-teal-650" />
                    Custom API integrations matching legacy systems
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Check className="h-4 w-4 text-teal-650" />
                    Dedicated Account Support Specialist
                  </div>
                </div>
              </div>
              <button 
                onClick={() => scrollToSection('demo-request')}
                className="w-full py-3 border border-slate-200 hover:border-teal-700 text-slate-700 hover:text-teal-700 bg-white font-medium text-xs rounded-lg transition-all text-center cursor-pointer"
              >
                Reach Out
              </button>
            </div>

          </div>

        </div>
      </section>

      {/* Section 7: Contact / Demo Request Form */}
      <section id="demo-request" className="py-20 sm:py-28 bg-slate-900 text-white relative">
        <div className="absolute inset-0 bg-radial from-teal-950/40 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column Text details */}
            <div className="lg:col-span-5 text-left">
              <span className="text-xs font-mono text-teal-400 bg-teal-950 border border-teal-900 px-3 py-1 rounded-full uppercase tracking-widest inline-block mb-6">
                Direct Inquiry Hotline
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">
                Request a Free On-Site Demo
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-8">
                Our representatives are located directly in Anand, Gujarat. We can schedule a physical walkthrough of your workshop floor to map out custom stages and configure your demo in under 24 hours.
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-slate-800 text-teal-400 rounded-lg flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Headquarters Address</h5>
                    <p className="text-sm font-medium text-white">Ashrey Systems, Anand, Gujarat - 388001</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-slate-800 text-teal-400 rounded-lg flex items-center justify-center shrink-0">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Phone & Instant Support</h5>

                    <p className="text-sm font-medium text-white">+91 84608 52903 <span className="text-slate-400 text-xs italic ml-1">(Anand Representative)</span></p>

                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 bg-slate-800 text-teal-400 rounded-lg flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Setup Guarantee</h5>
                    <p className="text-sm font-medium text-white">Zero business downtime during implementation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column Registration Form */}
            <div className="lg:col-span-7">
              <div className="bg-slate-800/60 border border-slate-750 p-6 sm:p-10 rounded-2xl shadow-xl text-left">
                
                <AnimatePresence mode="wait">
                  {!submitted ? (
                    <motion.form 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onSubmit={handleFormSubmit} 
                      className="space-y-5"
                      id="lead-capture-form"
                    >
                      <div>
                        <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="field-name">
                          Your Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="field-name"
                          name="name"
                          required
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="e.g. Rajeshbhai Patel"
                          className="w-full bg-slate-900 border border-slate-700 focus:border-teal-405 focus:ring-1 focus:ring-teal-405 p-3 rounded-lg text-sm text-white placeholder-slate-500 transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="field-company">
                            Company Name <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            id="field-company"
                            name="companyName"
                            required
                            value={formData.companyName}
                            onChange={handleInputChange}
                            placeholder="e.g. Shree Hari Gears Ltd."
                            className="w-full bg-slate-900 border border-slate-700 focus:border-teal-405 focus:ring-1 focus:ring-teal-405 p-3 rounded-lg text-sm text-white placeholder-slate-500 transition-all"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="field-phone">
                            Phone Number <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="tel"
                            id="field-phone"
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="e.g. +91 94292 12345"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-teal-405 focus:ring-1 focus:ring-teal-405 p-3 rounded-lg text-sm text-white placeholder-slate-500 transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="field-industry">
                          Industry Sector <span className="text-rose-500">*</span>
                        </label>
                        <select
                          id="field-industry"
                          name="industry"
                          required
                          value={formData.industry}
                          onChange={handleInputChange}
                          className="w-full bg-slate-900 border border-slate-700 focus:border-teal-405 focus:ring-1 focus:ring-teal-405 p-3 rounded-lg text-sm text-white transition-all appearance-none cursor-pointer"
                        >
                          <option value="" className="text-slate-500">-- Select Your Sector --</option>
                          <option value="Gears & Engineering">Gears & Engineering</option>
                          <option value="Castings & Foundry">Castings & Foundry</option>
                          <option value="Welding Products">Welding Products</option>
                          <option value="Animal Feed">Animal Feed</option>
                          <option value="Industrial Packaging">Industrial Packaging</option>
                          <option value="Industrial Equipment">Industrial Equipment</option>
                          <option value="Other">Other Manufacturing</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-mono font-bold uppercase tracking-wider text-slate-300 mb-1.5" htmlFor="field-message">
                          Special Shopfloor Requirements (Optional)
                        </label>
                        <textarea
                          id="field-message"
                          name="message"
                          rows={3}
                          value={formData.message}
                          onChange={handleInputChange}
                          placeholder="Tell us about your active production stages or key pain points..."
                          className="w-full bg-slate-900 border border-slate-700 focus:border-teal-405 focus:ring-1 focus:ring-teal-405 p-3 rounded-lg text-sm text-white placeholder-slate-500 transition-all resize-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 bg-teal-700 hover:bg-teal-800 disabled:bg-teal-900 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-teal-750/30 flex items-center justify-center gap-2 transform active:scale-[0.98] cursor-pointer mt-3"
                        id="form-submit-btn"
                      >
                        {submitting ? (
                          <>
                            <div className="animate-spin h-4.5 w-4.5 border-2 border-white border-t-transparent rounded-full" />
                            Sending lead credentials...
                          </>
                        ) : (
                          <>
                            Request a Free Demo
                            <ChevronRight className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </motion.form>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-8 space-y-6"
                      id="lead-success-block"
                    >
                      <div className="h-16 w-16 bg-teal-500/15 border border-teal-650 rounded-full flex items-center justify-center mx-auto text-teal-400">
                        <Check className="h-8 w-8 stroke-[3]" />
                      </div>
                      <div>
                        <h4 className="font-display text-2xl font-black text-white">Inquiry Logged Live!</h4>
                        <p className="text-xs text-slate-350 max-w-md mx-auto mt-2">
                          Thank you <span className="text-teal-400 font-semibold">{formData.name}</span>. Your request has been written atomically into our GIDC register.
                        </p>
                      </div>

                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-left text-xs text-slate-300 leading-relaxed max-w-md mx-auto space-y-2">
                        <p className="font-bold text-teal-450 border-b border-slate-800 pb-1.5 font-mono uppercase tracking-widest text-[10px]">What Happens Next?</p>
                        <div className="flex gap-2 pt-1">
                          <span className="text-teal-400 font-bold">1.</span>
                          <p>Our Anand technician coordinates an onboarding preview matching your shop floor alignment.</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-teal-400 font-bold">2.</span>
                          <p>We'll set up standard production stages (e.g. Cut, Lave, Case Hardening, Testing) for your profile.</p>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-teal-400 font-bold">3.</span>
                          <p>Get a sandbox access link texted to <span className="text-white font-mono">{formData.phone}</span> to let you test operations in real-time.</p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSubmitted(false);
                          setFormData({ name: '', companyName: '', phone: '', industry: '', message: '' });
                        }}
                        className="text-xs text-teal-400 hover:text-teal-350 underline outline-none focus:outline-none pointer-events-auto cursor-pointer"
                      >
                        Submit another inquiry form
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Section 8: Footer */}
      <footer className="bg-slate-950 text-slate-400 py-16 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">
            
            {/* Logo Group */}
            <div className="md:col-span-4 flex flex-col items-start text-left">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-teal-700 flex items-center justify-center text-white">
                  <Cpu className="h-4 w-4" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-white">
                  Ashrey <span className="text-teal-400">FlowOps</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed mb-4 max-w-sm">
                Next generation manufacturing execution software engineered specifically to empower Indian SME workshops to optimize delivery loops from source RFQ to transit dispatch.
              </p>
              <span className="text-[10px] font-mono tracking-widest text-slate-600 block">
                CRAFTED BY ASHREY SYSTEMS ● ANAND
              </span>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3 text-left">
              <h5 className="font-display text-xs font-mono font-bold uppercase tracking-wider text-slate-205 mb-4 border-b border-slate-900 pb-2">
                Operational Modules
              </h5>
              <ul className="space-y-2.5 text-xs text-slate-405 font-medium">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">RFQ File Estimates</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">Shopfloor Kanban stage</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">Challans & Dispatch Voucher</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">WhatsApp Live alerts</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors cursor-pointer">Dealer tracking Portal</button></li>
              </ul>
            </div>

            {/* Quick Links */}
            <div className="md:col-span-3 text-left">
              <h5 className="font-display text-xs font-mono font-bold uppercase tracking-wider text-slate-205 mb-4 border-b border-slate-900 pb-2">
                Company & Area
              </h5>
              <ul className="space-y-2.5 text-xs text-slate-405 font-medium">
                <li><button onClick={() => scrollToSection('pain-points')} className="hover:text-white transition-colors cursor-pointer font-medium">About Ashrey FlowOps</button></li>
                <li><button onClick={() => scrollToSection('demo-request')} className="hover:text-white transition-colors cursor-pointer">Our Anand GIDC Works</button></li>
                <li><button onClick={() => scrollToSection('pricing')} className="hover:text-white transition-colors cursor-pointer">Commercial Plans</button></li>
                <li><span className="text-slate-600">Privacy & Terms Policy</span></li>
              </ul>
            </div>

            {/* Contacts */}
            <div className="md:col-span-2 text-left space-y-4">
              <div>
                <h5 className="font-display text-xs font-mono font-bold uppercase tracking-wider text-slate-205 border-b border-slate-900 pb-2 mb-2">
                  Head Office
                </h5>
                <p className="text-xs text-slate-405 leading-relaxed">
                  Ashrey Systems<br />
                  Anand, Gujarat<br />
                  India
                </p>
              </div>

              <div>
                <h5 className="font-display text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Inquire Email</h5>
                <p className="text-xs text-teal-400 font-mono">sales@ashreysystems.com</p>
              </div>
            </div>

          </div>

          <div className="border-t border-slate-900 pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600">
            <span>© 2026 Ashrey Systems. All rights reserved.</span>
            <span className="mt-2 sm:mt-0">Designed elegantly matching local GIDC structures.</span>
          </div>

        </div>
      </footer>

      {/* Video Interactive walkthrough Modal Simulation */}
      <AnimatePresence>
        {showVideoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity" 
              onClick={() => setShowVideoModal(false)}
            />

            {/* Modal Container */}
            <div className="relative bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden z-10 text-left">
              
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
                <div>
                  <h3 className="font-display font-bold text-lg text-white">FlowOps 2-Min Interactive Showcase</h3>
                  <p className="text-xs text-slate-400">Step-by-step tour through our live GIDC operation pipeline</p>
                </div>
                <button 
                  onClick={() => setShowVideoModal(false)}
                  className="h-8 w-8 text-slate-400 hover:text-white rounded-lg flex items-center justify-center hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Simulation Screen Wrapper */}
              <div className="grid grid-cols-1 md:grid-cols-12">
                
                {/* Active Interactive Stage details */}
                <div className="md:col-span-8 bg-slate-950 p-6 sm:p-10 flex flex-col justify-between min-h-[320px]">
                  
                  {/* Current stage state graphic simulation */}
                  <div className="space-y-6">
                    <span className={`inline-block text-[10px] font-mono px-2.5 py-1 rounded-full uppercase font-bold tracking-widest ${simulationSteps[walkthroughStep].pillColor}`}>
                      {simulationSteps[walkthroughStep].badge}
                    </span>

                    <h4 className="font-display text-2xl font-black text-white">{simulationSteps[walkthroughStep].title}</h4>
                    <p className="text-sm text-slate-300 leading-relaxed max-w-lg">{simulationSteps[walkthroughStep].desc}</p>
                  </div>

                  {/* Visual simulation status progress */}
                  <div className="mt-8">
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-teal-500 h-1.5 transition-all duration-300"
                        style={{ width: `${((walkthroughStep + 1) / 4) * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-mono text-slate-505 mt-2">
                      <span>Simulating walkthrough page</span>
                      <span>Phase {walkthroughStep + 1} of 4</span>
                    </div>
                  </div>

                </div>

                {/* Left hand selectors */}
                <div className="md:col-span-4 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-6 space-y-3 flex flex-col justify-center">
                  <span className="text-[10px] font-mono font-bold text-slate-405 uppercase tracking-wider block mb-1">Click a phase below to jump:</span>
                  
                  {simulationSteps.map((step, idx) => (
                    <button
                      key={idx}
                      onClick={() => setWalkthroughStep(idx)}
                      className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                        walkthroughStep === idx 
                          ? 'border-teal-700 bg-teal-950/20 text-white shadow-md' 
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-805 text-slate-400'
                      }`}
                    >
                      <span>{step.title.split('. ')[1]}</span>
                      <ChevronRight className={`h-4 w-4 ${walkthroughStep === idx ? 'text-teal-400' : 'text-slate-600'}`} />
                    </button>
                  ))}

                  {/* Actions inside modal */}
                  <div className="pt-4 border-t border-slate-800 flex justify-between gap-3 text-xs w-full">
                    {walkthroughStep > 0 ? (
                      <button 
                        onClick={() => setWalkthroughStep(prev => prev - 1)}
                        className="px-3 py-1.5 text-slate-400 hover:text-white transition-all cursor-pointer font-bold"
                      >
                        ← Previous
                      </button>
                    ) : <div />}

                    {walkthroughStep < 3 ? (
                      <button 
                        onClick={() => setWalkthroughStep(prev => prev + 1)}
                        className="px-4 py-2 bg-teal-705 text-white font-bold rounded-lg hover:bg-teal-800 transition-all ml-auto flex items-center gap-1 cursor-pointer"
                      >
                        Next Step
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          setShowVideoModal(false);
                          scrollToSection('demo-request');
                        }}
                        className="px-4 py-2 bg-teal-705 text-white font-bold rounded-lg hover:bg-teal-800 transition-all ml-auto flex items-center gap-1 cursor-pointer bg-emerald-700 hover:bg-emerald-800"
                      >
                        Book Real Demo
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
