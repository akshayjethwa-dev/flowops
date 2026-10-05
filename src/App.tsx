/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

// Unauthenticated views
import { Login } from './pages/unauth/Login';
import { ForgotPassword } from './pages/unauth/ForgotPassword';

// Authenticated views
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { PaymentsTrackerPage } from './pages/PaymentsTrackerPage';
import { RFQsPage } from './pages/rfqs/RFQsPage';
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

// Settings sub-views
import { TenantSettingsPage } from './pages/settings/TenantSettingsPage';
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
                    <ProtectedRoute allowedRoles={['admin', 'management']}>
                      <DashboardPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <RFQsPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/new" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <RfqCreateForm />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/:rfqId" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <RfqDetailPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="rfqs/:rfqId/quotation" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <QuotationEditorPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="orders" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'production', 'management']}>
                      <OrdersPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="orders/:jobId" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'production', 'management']}>
                      <JobDetailPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="dispatch" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatch', 'management']}>
                      <DispatchPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="dispatch/:dispatchId" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'dispatch', 'management']}>
                      <DispatchDetailPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="customers" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <CustomersListPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="whatsapp-inbox" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <WhatsAppInboxPage />
                    </ProtectedRoute>
                  } 
                />

                <Route 
                  path="payments" 
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                      <PaymentsTrackerPage />
                    </ProtectedRoute>
                  } 
                />

            <Route 
              path="customers/:customerId" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'sales', 'management']}>
                  <CustomerDetailPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="inventory" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'production', 'management', 'sales', 'dispatch']}>
                  <InventoryPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="reports" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'management', 'sales', 'production', 'dispatch']}>
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
                <ProtectedRoute allowedRoles={['admin']}>
                  <ProductionStagesPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/whatsapp" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'sales']}>
                  <WhatsAppPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/users" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <UsersRosterPage />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="settings/users/invite" 
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <InviteUserForm />
                </ProtectedRoute>
              } 
            />

            <Route 
              path="activity" 
              element={
                <ProtectedRoute allowedRoles={['admin', 'management']}>
                  <ActivityPage />
                </ProtectedRoute>
              } 
            />

            {/* Internal SaaS Admins boundary shard manager */}
            <Route 
              path="internal/tenants" 
              element={
                <ProtectedRoute requireSuperAdmin={true}>
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
