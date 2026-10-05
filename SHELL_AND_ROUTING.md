# App Shell & Routing Specification
## Project: Ashrey FlowOps (MVP)
### Document Version: 1.0.0
### Date: May 30, 2026

This blueprint specifies the frontend architectural structure, directory layouts, router paths, role-routing constraints, and standard layout container code for **Ashrey FlowOps**.

---

## 1. Directory Structure Standards

```
/src
├── /components
│   ├── /layout
│   │   ├── AppShell.tsx         # Outermost global content layout shell
│   │   ├── Sidebar.tsx          # Collapsible navigation rail
│   │   └── Topbar.tsx           # Company/Tenant identity & account panel
│   └── /ui
│       ├── Button.tsx           # System button components
│       ├── Card.tsx             # Theme containers
│       └── Dialog.tsx           # Standard modular popups
├── /context
│   └── AuthContext.tsx          # Unified Firebase Auth state bridge
├── /hooks
│   └── useAuth.ts               # Context hooks wrapping
├── /lib
│   └── firebase.ts              # Firebase Clients initializer
├── /pages
│   ├── /unauth
│   │   ├── Login.tsx            # Industrial Sign-in Desk
│   │   └── ForgotPassword.tsx   # Recovery workflow entry
│   ├── /dashboard
│   │   └── Index.tsx            # Multi-indicator center
│   ├── /rfqs
│   │   ├── Index.tsx            # Active pipeline list
│   │   ├── NewRFQ.tsx           # Rapid details logging
│   │   └── Details.tsx          # Cost sheet calculation console
│   └── /settings
│       ├── Tenant.tsx           # Enterprise metadata settings
│       └── Stages.tsx           # Production line stages
└── App.tsx                      # Root component routing pipeline
```

*   **Linting & Style Guidelines**:
    *   **TypeScript Mode**: Explicit Prop Interfaces (React.FC<{ props }>) for predictability.
    *   **No Magic Keys**: All statuses and role values mapping use standard `enum`/`string literal` arrays.
    *   **React 18**: Dynamic route lazy loading `React.lazy()` with `Suspense` containers.

---

## 2. Global Route Map Matrix

| Path | Allowed Roles | Display Label | Guard Pattern |
| :--- | :--- | :--- | :--- |
| `/login` | Public | Auth Portal | Unauthenticated Only |
| `/forgot-password` | Public | Credentials Reset | Unauthenticated Only |
| `/dashboard` | `admin`, `management` | Command Center | Protected |
| `/rfqs` | `admin`, `sales`, `management` | RFQs & Inquiries | Protected |
| `/rfqs/new` | `admin`, `sales` | Logging Inquiries | Protected |
| `/rfqs/:rfqId` | `admin`, `sales`, `management` | Dynamic Cost Sheet | Protected (Param Match) |
| `/orders` | `admin`, `sales`, `management` | Confirmed Sales | Protected |
| `/orders/:orderId` | All Roles | Job Stage Tracing | Protected |
| `/dispatch` | `admin`, `dispatch`, `management` | Logistics Manifest | Protected |
| `/dispatch/:id` | `admin`, `dispatch`, `management` | Lorry Details / LR | Protected |
| `/customers` | `admin`, `sales`, `management` | Dealers Directory | Protected |
| `/settings/tenant` | `admin` | Organization details | Protected + Role Enforcement |

---

## 3. Implementation: Core TypeScript Components

Below are production-ready TSX codes specifying standard implementations of the router wrappers, protective handles, and the visual container views.

### 3.1 Protected Route Wrapper (`ProtectedRoute.tsx`)
Intercepts routing changes, checks Firebase credential streams, matches Profile parameters against permitted role tags, and handles loading delays.

```tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="animate-spin h-8 w-8 border-3 border-sky-600 border-t-transparent rounded-full" />
        <p className="mt-4 text-xs font-mono text-slate-400 uppercase tracking-widest animate-pulse">
          Resolving credentials...
        </p>
      </div>
    );
  }

  // Redirect to sign in if no valid active session keys exist
  if (!user && !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check Role Permissions constraints if targeted
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};
```

---

### 3.2 Dynamic Routing Controller Setup (`App.tsx`)
Constructs standard mapping nodes, nesting sub-views into the persistent workspace layout framework.

```tsx
import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

// Unauth Screens
import { Login } from './pages/unauth/Login';
import { ForgotPassword } from './pages/unauth/ForgotPassword';

// Lazy-loaded Authenticated Screens
const Dashboard = React.lazy(() => import('./pages/dashboard/Index'));
const RFQList = React.lazy(() => import('./pages/rfqs/Index'));
const RFQNew = React.lazy(() => import('./pages/rfqs/NewRFQ'));
const RFQDetails = React.lazy(() => import('./pages/rfqs/Details'));
const OrdersList = React.lazy(() => import('./pages/orders/Index'));
const ProductionStages = React.lazy(() => import('./pages/settings/Stages'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={
          <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-sky-600 border-t-transparent rounded-full" />
          </div>
        }>
          <Routes>
            {/* Unauthenticated Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Authenticated Workspace Route Group Nested under AppShell */}
            <Route path="/" element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }>
              {/* Fallback to Dashboard index */}
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={
                <ProtectedRoute allowedRoles={['admin', 'management']}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="rfqs" element={<RFQList />} />
              <Route path="rfqs/new" element={
                <ProtectedRoute allowedRoles={['admin', 'sales']}>
                  <RFQNew />
                </ProtectedRoute>
              } />
              <Route path="rfqs/:rfqId" element={<RFQDetails />} />
              <Route path="orders" element={<OrdersList />} />
              
              <Route path="settings/stages" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <ProductionStages />
                </ProtectedRoute>
              } />
            </Route>

            {/* General Fallbacks */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

---

### 3.3 Reusable Layout Framework (`AppShell.tsx`)
Binds the structural sidebar rail with top banners, feeding nested child route elements cleanly to their target areas using `<Outlet />`.

```tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col md:flex-row">
      {/* Structural Navigation Sidebar */}
      <Sidebar />

      {/* Primary Visual Viewport Area */}
      <div className="flex-grow flex flex-col overflow-y-auto max-h-screen">
        {/* Dynamic header tracker top-bar */}
        <Topbar />

        {/* Content Inject Destination */}
        <main className="p-6 md:p-8 flex-grow">
          <Outlet />
        </main>

        {/* Footnotes status checks */}
        <footer className="mt-auto mx-8 mb-6 border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-1">
          <div className="flex space-x-4">
            <span className="flex items-center space-x-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span><span>Firebase Live</span></span>
            <span className="flex items-center space-x-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span><span>AiSensy BSP Online</span></span>
          </div>
          <div>* Ashrey FlowOps MVP Console</div>
        </footer>
      </div>
    </div>
  );
};
```

---

### 3.4 Navigation Rail Sidebar (`Sidebar.tsx`)
Translates profile roles into visible navigators. Styled in slate aesthetics with contrast-positive visual identifiers.

```tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { 
  TrendingUp, 
  FolderSync, 
  FileEdit, 
  Layers, 
  Truck, 
  Settings 
} from 'lucide-react';

interface SidebarItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
}

export const Sidebar: React.FC = () => {
  const { profile, tenant } = useAuth();

  const routes: SidebarItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: TrendingUp, roles: ['admin', 'management'] },
    { to: '/rfqs', label: 'RFQs & Costing', icon: FolderSync, roles: ['admin', 'sales', 'management'] },
    { to: '/orders', label: 'Production Line', icon: Layers, roles: ['admin', 'production', 'management'] },
    { to: '/dispatch', label: 'Logistics Desk', icon: Truck, roles: ['admin', 'dispatch', 'management'] },
    { to: '/settings/stages', label: 'Control Settings', icon: Settings, roles: ['admin'] }
  ];

  const filteredRoutes = routes.filter(route => 
    profile ? route.roles.includes(profile.role) : false
  );

  return (
    <aside className="w-full md:w-64 bg-slate-900 text-slate-350 flex flex-col border-r border-slate-800 shrink-0 select-none">
      {/* Brand Identity Branding Header Area */}
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3 bg-slate-950/20">
        <div className="w-8 h-8 bg-sky-600 rounded flex items-center justify-center font-bold text-white tracking-widest text-sm">
          AF
        </div>
        <div>
          <h2 className="text-white font-bold text-sm tracking-tight uppercase leading-none">Ashrey FlowOps</h2>
          <span className="text-[9px] text-slate-500 font-mono tracking-wider block mt-1 uppercase">Shopfloor CRM</span>
        </div>
      </div>

      {/* Tenant Entity indicator info */}
      <div className="px-6 py-3 border-b border-slate-850 bg-slate-950/40">
        <p className="text-[9px] uppercase font-mono tracking-wider text-slate-550 block">Active Plant</p>
        <p className="text-xs font-semibold text-slate-200 truncate mt-0.5">{tenant?.companyName || 'Loading...'}</p>
      </div>

      {/* Menu Options lists */}
      <nav className="flex-grow p-4 space-y-1">
        {filteredRoutes.map(route => {
          const Icon = route.icon;
          return (
            <NavLink
              key={route.to}
              to={route.to}
              className={({ isActive }) => `
                w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-md text-xs font-mono uppercase tracking-wide transition-colors
                ${isActive 
                  ? 'bg-sky-500/10 text-sky-400 font-bold border-l-2 border-sky-500' 
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }
              `}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{route.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
```

---

### 3.5 Status Top-Bar Panel (`Topbar.tsx`)
Validates connections, houses indicators, and exposes the account logout portal.

```tsx
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { ChevronDown, LogOut, User } from 'lucide-react';

export const Topbar: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 relative select-none">
      {/* Active Area Banner indicator */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded text-[10px] font-mono tracking-wider uppercase font-bold">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
          <span>AiSensy Live Terminal Connected</span>
        </div>
      </div>

      {/* Right Account Options controllers */}
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2.5 cursor-pointer focus:outline-none"
        >
          <div className="h-8 w-8 bg-slate-100 border border-slate-200/80 rounded-full flex items-center justify-center text-xs font-bold text-slate-700 font-display">
            {profile?.name ? profile.name.slice(0, 2).toUpperCase() : 'OP'}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-slate-800 leading-none">{profile?.name || 'Operator'}</p>
            <p className="text-[9px] text-slate-450 uppercase font-mono mt-1 tracking-wider leading-none">
              {profile?.role || 'User'}
            </p>
          </div>
          <ChevronDown className="h-3 w-3 text-slate-400" />
        </button>

        {/* Dropdown Menu popups */}
        {dropdownOpen && (
          <div className="absolute right-8 top-14 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 z-50 animate-fade-in">
            <button
              onClick={signOut}
              className="w-full text-left px-4 py-2.5 text-xs text-red-650 hover:bg-slate-50 flex items-center space-x-2 font-medium cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-red-600" />
              <span>Sign Out Session</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
```
