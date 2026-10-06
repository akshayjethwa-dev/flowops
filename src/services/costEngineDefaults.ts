// src/services/costEngineDefaults.ts

import { CostingTemplate } from '../types/costEngine';

export const DEFAULT_COSTING_TEMPLATES: CostingTemplate[] = [
  {
    id: 'tpl-cnc-machining-v21',
    tenantId: 'default',
    name: 'Precision CNC Machining & Turning',
    version: 'v2.1',
    status: 'active',
    isDefault: true,
    description: 'Standard production cost structure for CNC turning, 3-axis/5-axis VMC milling, and precision tolerance parts.',
    changeLogNotes: 'Updated machine hourly rates reflecting 2026 industrial electricity tariffs (₹8.8/kWh) and revised machinist skills index.',
    updatedAt: new Date().toISOString(),
    updatedBy: 'Operations Director',
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    laborRates: [
      {
        id: 'lr-1',
        role: 'Senior CNC Programmer & Cam Lead',
        hourlyRate: 520,
        overtimeMultiplier: 1.5,
        skillLevel: 'specialist',
        efficiencyFactor: 1.1,
        description: 'MasterCAM / Siemens NX programming and first-part fixture setup'
      },
      {
        id: 'lr-2',
        role: 'CNC / VMC Setup Machinist',
        hourlyRate: 420,
        overtimeMultiplier: 1.5,
        skillLevel: 'skilled',
        efficiencyFactor: 1.0,
        description: 'Tool offset setting, workpiece zeroing, and dimensional verification'
      },
      {
        id: 'lr-3',
        role: 'CNC Machine Operator',
        hourlyRate: 220,
        overtimeMultiplier: 1.5,
        skillLevel: 'semi_skilled',
        efficiencyFactor: 0.95,
        description: 'Production part loading/unloading, deburring, and periodic gauge checks'
      },
      {
        id: 'lr-4',
        role: 'Quality Inspector (CMM / Metrology)',
        hourlyRate: 350,
        overtimeMultiplier: 1.5,
        skillLevel: 'skilled',
        efficiencyFactor: 1.0,
        description: 'CMM inspection, surface roughness testing, and QA documentation'
      },
      {
        id: 'lr-5',
        role: 'Shopfloor General Helper',
        hourlyRate: 150,
        overtimeMultiplier: 1.25,
        skillLevel: 'unskilled',
        efficiencyFactor: 1.0,
        description: 'Chip clearing, coolant replenishment, and packing'
      }
    ],
    machineHourRates: [
      {
        id: 'mhr-1',
        machineName: '5-Axis VMC Machining Center (Mazak Variaxis)',
        code: 'VMC-5AX-01',
        hourlyRate: 1250,
        setupHourlyRate: 750,
        powerRatingKw: 28,
        depreciationPerHr: 350,
        toolingAllowancePerHr: 180,
        description: 'Simultaneous 5-axis aerospace and complex impeller machining'
      },
      {
        id: 'mhr-2',
        machineName: '3-Axis Vertical Machining Center (BFW / Haas VF-2)',
        code: 'VMC-3AX-02',
        hourlyRate: 650,
        setupHourlyRate: 450,
        powerRatingKw: 15,
        depreciationPerHr: 160,
        toolingAllowancePerHr: 90,
        description: 'General prismatic milling, drilling, tapping, and pocketing'
      },
      {
        id: 'mhr-3',
        machineName: 'CNC Turning Center (Ace Micromatic Jobber)',
        code: 'CNC-TC-01',
        hourlyRate: 520,
        setupHourlyRate: 380,
        powerRatingKw: 11,
        depreciationPerHr: 120,
        toolingAllowancePerHr: 70,
        description: 'Precision turning, threading, grooving, and boring up to 300mm dia'
      },
      {
        id: 'mhr-4',
        machineName: 'Precision Cylindrical Grinder',
        code: 'GRD-CYL-01',
        hourlyRate: 420,
        setupHourlyRate: 300,
        powerRatingKw: 7.5,
        depreciationPerHr: 80,
        toolingAllowancePerHr: 45,
        description: 'OD/ID finish grinding up to Ra 0.2 micron'
      },
      {
        id: 'mhr-5',
        machineName: 'Conventional Lathe / Radial Drill',
        code: 'CONV-01',
        hourlyRate: 260,
        setupHourlyRate: 180,
        powerRatingKw: 5.5,
        depreciationPerHr: 30,
        toolingAllowancePerHr: 25,
        description: 'Rough facing, centering, and secondary operations'
      }
    ],
    materialMarkups: [
      {
        id: 'mm-1',
        category: 'Alloy & Carbon Steel (EN8, EN19, EN24, 20MnCr5)',
        scrapFactorPercent: 6,
        handlingMarkupPercent: 4,
        freightPerKg: 3.5,
        notes: 'Standard turning & milling bar stock'
      },
      {
        id: 'mm-2',
        category: 'Stainless Steel (SS 304, SS 316, SS 316L)',
        scrapFactorPercent: 9,
        handlingMarkupPercent: 6,
        freightPerKg: 6.0,
        notes: 'Higher tooling wear and coolant flushing factor'
      },
      {
        id: 'mm-3',
        category: 'Aluminium Alloys (6061-T6, 7075-T6)',
        scrapFactorPercent: 12,
        handlingMarkupPercent: 5,
        freightPerKg: 8.0,
        notes: 'High volumetric swarf generation'
      },
      {
        id: 'mm-4',
        category: 'Exotic Superalloys (Inconel 718, Monel, Duplex 2205)',
        scrapFactorPercent: 15,
        handlingMarkupPercent: 10,
        freightPerKg: 25.0,
        notes: 'Strict heat certification and high material value liability'
      },
      {
        id: 'mm-5',
        category: 'Standard Fasteners & Catalog Hardware',
        scrapFactorPercent: 3,
        handlingMarkupPercent: 5,
        freightPerKg: 1.5,
        notes: 'Direct supplier catalog line items'
      }
    ],
    subcontractingRules: [
      {
        id: 'sub-1',
        processName: 'Vacuum Heat Treatment & Hardening (58-62 HRC)',
        pricingBasis: 'per_kg',
        baseRate: 48,
        handlingMarkupPercent: 10,
        standardLeadTimeDays: 4,
        preferredVendorName: 'Precision Heat Treaters MIDC',
        notes: 'Includes post-temper hardness testing report'
      },
      {
        id: 'sub-2',
        processName: 'Hard Chrome Plating (25 micron thickness)',
        pricingBasis: 'per_piece',
        baseRate: 140,
        handlingMarkupPercent: 12,
        standardLeadTimeDays: 5,
        preferredVendorName: 'Apex Electroplaters Pune',
        notes: 'Hydraulic piston rods and cylinder components'
      },
      {
        id: 'sub-3',
        processName: 'Zinc-Nickel / Yellow Trivalent Passivation (RoHS)',
        pricingBasis: 'per_kg',
        baseRate: 36,
        handlingMarkupPercent: 8,
        standardLeadTimeDays: 3,
        preferredVendorName: 'Standard Plating Works',
        notes: '96 hours salt spray test compliant'
      },
      {
        id: 'sub-4',
        processName: 'Black Phosphating / Chemical Blackening',
        pricingBasis: 'per_kg',
        baseRate: 24,
        handlingMarkupPercent: 8,
        standardLeadTimeDays: 2,
        preferredVendorName: 'Standard Plating Works'
      },
      {
        id: 'sub-5',
        processName: 'NDT Ultrasonic & Magnetic Particle Inspection',
        pricingBasis: 'fixed_batch_charge',
        baseRate: 2800,
        handlingMarkupPercent: 15,
        standardLeadTimeDays: 2,
        preferredVendorName: 'NABL Certified Metrology Lab',
        notes: 'Level II certified inspector report'
      }
    ],
    overheads: {
      factoryOverheadPercent: 12,
      adminSalesOverheadPercent: 6,
      defaultMarginPercent: 18,
      rushOrderPremiumPercent: 20,
      minOrderValue: 5000,
      volumeDiscounts: [
        { minQuantity: 100, marginReductionPercent: 2 },
        { minQuantity: 500, marginReductionPercent: 4 },
        { minQuantity: 2000, marginReductionPercent: 6 }
      ]
    }
  },
  {
    id: 'tpl-fabrication-welding-v14',
    tenantId: 'default',
    name: 'Heavy Welded Fabrication & Sheet Metal',
    version: 'v1.4',
    status: 'active',
    isDefault: false,
    description: 'Costing rules for laser plate cutting, CNC press brake forming, heavy MIG/TIG weldments, and powder coating.',
    changeLogNotes: 'Added 6kW fiber laser hourly cost breakdown and upgraded welding gas consumables allocation.',
    updatedAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedBy: 'Plant General Manager',
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
    laborRates: [
      {
        id: 'lr-fab-1',
        role: 'Certified IBR / ASME Welder',
        hourlyRate: 460,
        overtimeMultiplier: 1.5,
        skillLevel: 'specialist',
        efficiencyFactor: 1.05,
        description: 'Full penetration pressure weldments, ASME Section IX certified'
      },
      {
        id: 'lr-fab-2',
        role: 'Structural MIG / MAG Welder',
        hourlyRate: 360,
        overtimeMultiplier: 1.5,
        skillLevel: 'skilled',
        efficiencyFactor: 1.0,
        description: 'Frame, baseplate, and bracket welding'
      },
      {
        id: 'lr-fab-3',
        role: 'Fabrication Fitter & Assembler',
        hourlyRate: 300,
        overtimeMultiplier: 1.5,
        skillLevel: 'skilled',
        efficiencyFactor: 1.0,
        description: 'Tack welding, layout marking, and dimensional squaring'
      },
      {
        id: 'lr-fab-4',
        role: 'Press Brake / Laser Operator',
        hourlyRate: 260,
        overtimeMultiplier: 1.5,
        skillLevel: 'semi_skilled',
        efficiencyFactor: 1.0,
        description: 'CNC bending setup and sheet handling'
      },
      {
        id: 'lr-fab-5',
        role: 'Grinder & Deburring Operator',
        hourlyRate: 180,
        overtimeMultiplier: 1.25,
        skillLevel: 'unskilled',
        efficiencyFactor: 0.9,
        description: 'Weld dressing, edge beveling, and slag cleaning'
      }
    ],
    machineHourRates: [
      {
        id: 'mhr-fab-1',
        machineName: '6kW Fiber Laser Cutting Table (4000x2000mm)',
        code: 'LSR-6KW',
        hourlyRate: 1850,
        setupHourlyRate: 600,
        powerRatingKw: 35,
        depreciationPerHr: 500,
        toolingAllowancePerHr: 220,
        description: 'High speed nitrogen/oxygen cutting up to 25mm mild steel / 16mm SS'
      },
      {
        id: 'mhr-fab-2',
        machineName: 'CNC Hydraulic Press Brake (200 Ton x 3.2m)',
        code: 'PB-200T',
        hourlyRate: 780,
        setupHourlyRate: 480,
        powerRatingKw: 18,
        depreciationPerHr: 180,
        toolingAllowancePerHr: 80,
        description: 'Multi-bend sheet metal forming and heavy channel bending'
      },
      {
        id: 'mhr-fab-3',
        machineName: 'Robotic Welding Cell (Fronius Cold Metal Transfer)',
        code: 'ROB-WELD-01',
        hourlyRate: 850,
        setupHourlyRate: 550,
        powerRatingKw: 22,
        depreciationPerHr: 240,
        toolingAllowancePerHr: 95,
        description: 'High duty cycle automated repeatability welding'
      },
      {
        id: 'mhr-fab-4',
        machineName: 'Manual Inverter MIG Welding Station (500A)',
        code: 'MIG-500',
        hourlyRate: 320,
        setupHourlyRate: 150,
        powerRatingKw: 12,
        depreciationPerHr: 45,
        toolingAllowancePerHr: 60,
        description: 'Includes CO2/Argon shielding gas and contact tip wear'
      }
    ],
    materialMarkups: [
      {
        id: 'mm-fab-1',
        category: 'Mild Steel Plates (IS 2062 E250 / ASTM A36)',
        scrapFactorPercent: 8,
        handlingMarkupPercent: 5,
        freightPerKg: 3.0,
        notes: 'Laser skeleton scrap loss estimated at 8%'
      },
      {
        id: 'mm-fab-2',
        category: 'Structural Sections (Pipes, Tubes, Angles, Channels)',
        scrapFactorPercent: 6,
        handlingMarkupPercent: 4,
        freightPerKg: 3.5,
        notes: 'Off-cut trim loss'
      },
      {
        id: 'mm-fab-3',
        category: 'Stainless Steel Sheet & Plate (304 / 316L)',
        scrapFactorPercent: 10,
        handlingMarkupPercent: 6,
        freightPerKg: 5.5,
        notes: 'Protective laser film and nitrogen assist gas factor'
      }
    ],
    subcontractingRules: [
      {
        id: 'sub-fab-1',
        processName: 'Abrasive Grit Sandblasting (SA 2.5 Standard)',
        pricingBasis: 'per_sq_meter',
        baseRate: 110,
        handlingMarkupPercent: 10,
        standardLeadTimeDays: 2,
        preferredVendorName: 'Modern Blast Cleaning Co'
      },
      {
        id: 'sub-fab-2',
        processName: 'Industrial Powder Coating (70-80 microns)',
        pricingBasis: 'per_sq_meter',
        baseRate: 165,
        handlingMarkupPercent: 12,
        standardLeadTimeDays: 4,
        preferredVendorName: 'Rainbow Powder Coaters Chakan'
      },
      {
        id: 'sub-fab-3',
        processName: 'Hot-Dip Galvanizing (85 microns min)',
        pricingBasis: 'per_kg',
        baseRate: 46,
        handlingMarkupPercent: 10,
        standardLeadTimeDays: 5,
        preferredVendorName: 'GalvaShield Technologies'
      },
      {
        id: 'sub-fab-4',
        processName: 'Radiographic Examination (RT 100% Weld Test)',
        pricingBasis: 'fixed_batch_charge',
        baseRate: 4500,
        handlingMarkupPercent: 15,
        standardLeadTimeDays: 3,
        preferredVendorName: 'GammaRay NDT Services'
      }
    ],
    overheads: {
      factoryOverheadPercent: 14,
      adminSalesOverheadPercent: 5,
      defaultMarginPercent: 16,
      rushOrderPremiumPercent: 25,
      minOrderValue: 8000,
      volumeDiscounts: [
        { minQuantity: 50, marginReductionPercent: 2 },
        { minQuantity: 200, marginReductionPercent: 4 }
      ]
    }
  },
  {
    id: 'tpl-rapid-prototyping-v10',
    tenantId: 'default',
    name: 'Rapid Prototyping & Emergency Short Run',
    version: 'v1.0',
    status: 'active',
    isDefault: false,
    description: 'High-margin, fast turnaround (24-72 hours) quoting rules with dedicated priority machine scheduling and expedited vendor logistics.',
    changeLogNotes: 'Initial creation for emergency break-down repairs and prototype tooling development.',
    updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedBy: 'Managing Director',
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    laborRates: [
      {
        id: 'lr-rp-1',
        role: 'Senior Prototype Engineer & Toolmaker',
        hourlyRate: 650,
        overtimeMultiplier: 1.75,
        skillLevel: 'specialist',
        efficiencyFactor: 1.2
      },
      {
        id: 'lr-rp-2',
        role: 'Express Machinist',
        hourlyRate: 500,
        overtimeMultiplier: 1.5,
        skillLevel: 'skilled',
        efficiencyFactor: 1.1
      }
    ],
    machineHourRates: [
      {
        id: 'mhr-rp-1',
        machineName: 'Dedicated Fast-Track VMC',
        code: 'VMC-EXP',
        hourlyRate: 980,
        setupHourlyRate: 600,
        powerRatingKw: 20
      },
      {
        id: 'mhr-rp-2',
        machineName: 'Wire EDM Precision Cut (Charmilles)',
        code: 'WEDM-01',
        hourlyRate: 650,
        setupHourlyRate: 450,
        powerRatingKw: 8
      }
    ],
    materialMarkups: [
      {
        id: 'mm-rp-1',
        category: 'Quick-Source Retail Off-the-shelf Stock',
        scrapFactorPercent: 15,
        handlingMarkupPercent: 15,
        freightPerKg: 15.0
      }
    ],
    subcontractingRules: [
      {
        id: 'sub-rp-1',
        processName: 'Same-Day / 24hr Nitriding / Hardening',
        pricingBasis: 'fixed_batch_charge',
        baseRate: 6500,
        handlingMarkupPercent: 20,
        standardLeadTimeDays: 1
      }
    ],
    overheads: {
      factoryOverheadPercent: 18,
      adminSalesOverheadPercent: 8,
      defaultMarginPercent: 28,
      rushOrderPremiumPercent: 30,
      minOrderValue: 12000,
      volumeDiscounts: []
    }
  }
];
