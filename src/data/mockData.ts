// src/data/mockData.ts

export const DEMO_PRODUCTS = [
  { id: 'p1', name: 'Forged Steel Spur Gear (Mod 4, 32T)', category: 'Gears', price: 4200, unit: 'pcs', gstRate: 18 },
  { id: 'p2', name: 'Stainless Steel Arc Welding Consumables (Grade E308L-16)', category: 'Welding', price: 340, unit: 'kg', gstRate: 18 },
  { id: 'p3', name: 'High-Density Cast Iron Grate Valve (DN150)', category: 'Valves & Castings', price: 12500, unit: 'pcs', gstRate: 18 },
  { id: 'p4', name: '10HP Submersible Pump Impeller (Bronze)', category: 'Equipment Parts', price: 8900, unit: 'pcs', gstRate: 18 },
  { id: 'p5', name: 'Industrial Pellet Press Die (4.0mm Hole)', category: 'Machinery Consumables', price: 24500, unit: 'pcs', gstRate: 18 }
];

export const DEMO_CLIENTS = [
  { name: 'Kirloskar Industrial Distributors', contact: 'Anil Kulkarni', phone: '9880123456', email: 'anil@kirloskar-dist.in', city: 'Pune' },
  { name: 'Techno Welds India Pvt Ltd', contact: 'Rajesh Sharma', phone: '9123456780', email: 'rsharma@technowelds.co.in', city: 'Jamshedpur' },
  { name: 'L&T Heavy Engineering Co.', contact: 'Vikram Mehta', phone: '9820098765', email: 'v.mehta@heavyeng.lnte.com', city: 'Surat' },
  { name: 'Supreme Animal Feeds', contact: 'Gurpreet Singh', phone: '9440612345', email: 'g.singh@supremeagro.in', city: 'Ludhiana' },
  { name: 'Southern Flow Control Valves', contact: 'M. Sunderam', phone: '9003198765', email: 'ms@southflow.com', city: 'Coimbatore' }
];

export const PRODUCTION_STAGES_ENUM = [
  { value: 'cutting', label: 'Material Cutting', color: 'indigo' },
  { value: 'welding', label: 'Pre-Heating & Welding', color: 'blue' },
  { value: 'machining', label: 'Precision Machining', color: 'amber' },
  { value: 'assembly', label: 'Shopfloor Assembly', color: 'purple' },
  { value: 'quality_check', label: 'NDT & Quality Check', color: 'pink' },
  { value: 'ready', label: 'Ready for Dispatch', color: 'green' }
] as const;
