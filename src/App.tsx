/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Loader2, ShieldCheck } from 'lucide-react';

// Unauthenticated views
import { Login } from './pages/unauth/Login';
import { ForgotPassword } from './pages/unauth/ForgotPassword';

// Authenticated views
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PaymentsTrackerPage } from './pages/PaymentsTrackerPage';
import { RFQsPage } from './pages/rfqs/RFQsPage';
import { MultiChannelIntakeHub } from './pages/rfqs/MultiChannelIntakeHub';
import { BomScrubberPage } from './pages/rfqs/BomScrubberPage';
import { CostEnginePage } from './pages/rfqs/CostEnginePage';
import { RfqCreateForm } from './pages/rfqs/RfqCreateForm';
import { RfqDetailPage } from './pages/rfqs/RfqDetailPage';
import { QuotationEditorPage } from './pages/rfqs/QuotationEditorPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { JobDetailPage } from './pages/orders/JobDetailPage';
import { DispatchPage } from './pages/dispatch/DispatchPage';
import { DispatchDetailPage } from './pages/dispatch/DispatchDetailPage';
import { CustomersListPage } from './pages/customers/CustomersListPage';
import { CustomerDetailPage } from './pages/customers/CustomerDetailPage';
import { InventoryPage } from './pages/InventoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { PublicRfqWebFormPage } from './pages/public/PublicRfqWebFormPage';
import { SubcontractorsPage } from './pages/subcontractors/SubcontractorsPage';

// Settings sub-views
import { TenantSettingsPage } from './pages/settings/TenantSettingsPage';
import { PlantsManagementPage } from './pages/settings/PlantsManagementPage';
import { ProductionStagesPage } from './pages/settings/ProductionStagesPage';
import { WhatsAppPage } from './pages/settings/WhatsAppPage';
import { WhatsAppInboxPage } from './pages/WhatsAppInboxPage';
import { UsersRosterPage } from './pages/settings/UsersRosterPage';
import { InviteUserForm } from './pages/settings/InviteUserForm';
import { ActivityPage } from './pages/settings/ActivityPage';
import { OnboardingWizard } from './pages/settings/OnboardingWizard';

// Customer Self-Service Portal view
import { PortalPage } from './pages/portal/PortalPage';

// Landing Page view
import { LandingPage } from './pages/LandingPage';

// SaaS Controller
import { InternalTenantsListPage } from './pages/internal/InternalTenantsListPage';
import { InternalTenantDetailPage } from './pages/internal/InternalTenantDetailPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Credentials Entryways */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/portal" element={<PortalPage />} />
              <Route path="/rfq-submit" element={<PublicRfqWebFormPage />} />
              <Route 
                path="/onboarding" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <OnboardingWizard />
                  </ProtectedRoute>
                } 
              />

              {/* Secure Tenancy Workspace Layout Shell */}
              <Route 
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              >

                {/* Core operator dashboards with role checking permissions */}
                <Route 
                  path="dashboard" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'operator', 'quality_inspector', 'store_keeper', 'viewer', 'sales', 'production', 'dispatch', 'management']}>
                      <DashboardPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'viewer']}>
                      <RFQsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/intake" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management']}>
                      <MultiChannelIntakeHub />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="bom-scrubber" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'operator', 'store_keeper', 'production', 'viewer']}>
                      <BomScrubberPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/bom" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'operator', 'store_keeper', 'production', 'viewer']}>
                      <BomScrubberPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="cost-engine" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management']}>
                      <CostEnginePage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/cost-engine" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management']}>
                      <CostEnginePage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/new" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management']}>
                      <RfqCreateForm />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/:rfqId" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'viewer']}>
                      <RfqDetailPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/:rfqId/quotation" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management']}>
                      <QuotationEditorPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="subcontractors" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'production', 'management', 'store_keeper', 'viewer']}>
                      <SubcontractorsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/subcontractors" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'production', 'management', 'store_keeper', 'viewer']}>
                      <SubcontractorsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="orders" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'operator', 'quality_inspector', 'store_keeper', 'production', 'management', 'viewer']}>
                      <OrdersPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="orders/:jobId" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'operator', 'quality_inspector', 'store_keeper', 'production', 'management', 'viewer']}>
                      <JobDetailPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="dispatch" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatch', 'store_keeper', 'management', 'viewer']}>
                      <DispatchPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="dispatch/:dispatchId" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'dispatch', 'store_keeper', 'management', 'viewer']}>
                      <DispatchDetailPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="customers" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'viewer']}>
                      <CustomersListPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="whatsapp-inbox" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management']}>
                      <WhatsAppInboxPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="payments" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'viewer']}>
                      <PaymentsTrackerPage />
                    </ProtectedRoute>
                  } 
                />

            <Route 
              path="customers/:customerId" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'sales', 'management', 'viewer']}>
                  <CustomerDetailPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="inventory" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'store_keeper', 'operator', 'quality_inspector', 'production', 'management', 'sales', 'dispatch', 'viewer']}>
                  <InventoryPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="reports" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'quality_inspector', 'sales', 'production', 'dispatch', 'management', 'viewer']}>
                  <ReportsPage />
                </ProtectedRoute>
              } 
            />

            {/* Config & Audit settings pipelines */}
            <Route 
              path="settings/tenant" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <TenantSettingsPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/production-stages" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <ProductionStagesPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/whatsapp" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'sales']}>
                  <WhatsAppPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/users" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <UsersRosterPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/users/invite" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager']}>
                  <InviteUserForm />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="activity" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'management']}>
                  <ActivityPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/plants" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'manager', 'management']}>
                  <PlantsManagementPage />
                </ProtectedRoute>
              } 
            />

            {/* Internal SaaS Admins boundary shard manager */}
            <Route 
              path="internal/tenants" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'management']}>
                  <InternalTenantsListPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="internal/tenants/:tenantId" 
              element={
                <ProtectedRoute requireSuperAdmin={true}>
                  <InternalTenantDetailPage />
                </ProtectedRoute>
              } 
            />
          </Route>

            {/* Clean path recovery fallback redirects any unmatched routes to secure home */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}