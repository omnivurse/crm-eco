import { Routes, Route, Navigate } from 'react-router-dom';
import RequireRole from './routes/auth/RequireRole';
import { Toaster } from './components/ui/Toaster';
import SupportPortal from './pages/SupportPortal';
import MemberPortal from './pages/portals/MemberPortal';
import MemberTicketList from './pages/portals/MemberTicketList';
import MemberTicketDetail from './pages/portals/MemberTicketDetail';
import ConciergePortal from './pages/portals/ConciergePortal';
import ConciergeTicketList from './pages/portals/ConciergeTicketList';
import AdvisorLogin from './pages/auth/AdvisorLogin';
import AdvisorDashboard from './pages/portals/AdvisorDashboard';
import AdvisorTicketNew from './pages/portals/AdvisorTicketNew';
import StaffLogin from './pages/auth/StaffLogin';
import UsersAdmin from './pages/admin/UsersAdmin';
import { Login } from './routes/auth/Login';
import { Signup } from './routes/auth/Signup';
import { ResetPassword } from './routes/auth/ResetPassword';
import { AdminHome } from './routes/admin/AdminHome';
import { Settings } from './routes/admin/Settings';
import AppShell from './routes/layout/AppShell';
import RequireAuth from './routes/auth/RequireAuth';
import { EnhancedTicketsList } from './routes/tickets/EnhancedTicketsList';
import { TicketNew } from './routes/tickets/TicketNew';
import { EnhancedTicketDetail } from './routes/tickets/EnhancedTicketDetail';
import { AgentWorkspace } from './routes/workspace/AgentWorkspace';
import { KBList } from './routes/kb/KBList';
import { KBArticleEditor } from './routes/kb/KBArticleEditor';
import { EnhancedReports } from './routes/reports/EnhancedReports';
import { ReportBuilder } from './routes/reports/ReportBuilder';
import SlaInsights from './routes/admin/SlaInsights';
import { Workflows } from './routes/admin/Workflows';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import StaffLogsPage from './pages/admin/StaffLogsPage';
import { StaffDashboard } from './routes/dashboard/StaffDashboard';
import { EnhancedTeamCollaboration } from './routes/collaboration/EnhancedTeamCollaboration';
import { ChatManagement } from './routes/admin/ChatManagement';
import { EnhancedServiceCatalog } from './routes/catalog/EnhancedServiceCatalog';
import { EnhancedCatalogItemRequest } from './routes/catalog/EnhancedCatalogItemRequest';
import { ProblemsList } from './routes/problems/ProblemsList';
import { ProblemDetail } from './routes/problems/ProblemDetail';
import { ProblemNew } from './routes/problems/ProblemNew';
import { RequestsList } from './routes/requests/RequestsList';
import { RequestDetail } from './routes/requests/RequestDetail';
import { EnhancedAnalyticsDashboard } from './routes/analytics/EnhancedAnalyticsDashboard';
import { SystemHealth } from './routes/admin/SystemHealth';
import { EnhancedKBArticle } from './routes/kb/EnhancedKBArticle';
import { FlowsEditor } from './routes/admin/FlowsEditor';
import { ChangeCalendar } from './routes/changes/ChangeCalendar';
import { MyWorkDashboard } from './routes/desk/MyWorkDashboard';
import { TasksPage } from './routes/desk/TasksPage';
import { TaskDetail } from './routes/desk/TaskDetail';
import { ProjectsPage } from './routes/desk/ProjectsPage';
import { ProjectDetail } from './routes/desk/ProjectDetail';
import { NotesPage } from './routes/desk/NotesPage';
import { NoteDetail } from './routes/desk/NoteDetail';
import { DailyLogsPage } from './routes/desk/DailyLogsPage';
import { FilesPage } from './routes/desk/FilesPage';
import { AssignmentsPage } from './routes/desk/AssignmentsPage';
import { AssignmentDetail } from './routes/desk/AssignmentDetail';
import { PasswordVaultPage } from './routes/desk/PasswordVaultPage';
import AllDailyLogsPage from './pages/admin/AllDailyLogsPage';
import { OneDriveCallback } from './pages/onedrive/OneDriveCallback';

export default function App() {
  return (
    <>
    <Toaster />
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<SupportPortal />} />
      <Route path="/support" element={<SupportPortal />} />
      <Route path="/support/member" element={<MemberPortal />} />
      <Route path="/support/member/tickets" element={<MemberTicketList />} />
      <Route path="/support/member/ticket/:id" element={<MemberTicketDetail />} />
      <Route path="/support/concierge" element={<ConciergePortal />} />
      <Route path="/kb" element={<KBList />} />
      <Route path="/kb/new" element={<RequireAuth><AppShell><KBArticleEditor /></AppShell></RequireAuth>} />
      <Route path="/kb/:id" element={<EnhancedKBArticle />} />

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login/advisor" element={<AdvisorLogin />} />
      <Route path="/login/staff" element={<StaffLogin />} />

      {/* Integration Callbacks */}
      <Route path="/onedrive/callback" element={<OneDriveCallback />} />

      {/* Advisor Routes */}
      <Route path="/advisor/dashboard" element={<RequireAuth><AdvisorDashboard /></RequireAuth>} />
      <Route path="/advisor/ticket/new" element={<RequireAuth><AdvisorTicketNew /></RequireAuth>} />
      <Route path="/advisor/ticket/:id" element={<RequireAuth><AppShell><EnhancedTicketDetail /></AppShell></RequireAuth>} />

      {/* Concierge Routes */}
      <Route path="/concierge/dashboard" element={<RequireAuth><ConciergeTicketList /></RequireAuth>} />

      {/* Protected Routes */}
      <Route path="/dashboard" element={<RequireAuth><AppShell><StaffDashboard /></AppShell></RequireAuth>} />
      <Route path="/tickets" element={<RequireAuth><AppShell><EnhancedTicketsList /></AppShell></RequireAuth>} />
      <Route path="/tickets/new" element={<RequireAuth><AppShell><TicketNew /></AppShell></RequireAuth>} />
      <Route path="/tickets/:id" element={<RequireAuth><AppShell><EnhancedTicketDetail /></AppShell></RequireAuth>} />
      <Route path="/workspace/:id" element={<RequireAuth><AppShell><AgentWorkspace /></AppShell></RequireAuth>} />
      <Route path="/catalog" element={<RequireAuth><AppShell><EnhancedServiceCatalog /></AppShell></RequireAuth>} />
      <Route path="/catalog/:id" element={<RequireAuth><AppShell><EnhancedCatalogItemRequest /></AppShell></RequireAuth>} />
      <Route path="/problems" element={<RequireAuth><AppShell><ProblemsList /></AppShell></RequireAuth>} />
      <Route path="/problems/new" element={<RequireAuth><AppShell><ProblemNew /></AppShell></RequireAuth>} />
      <Route path="/problems/:id" element={<RequireAuth><AppShell><ProblemDetail /></AppShell></RequireAuth>} />
      <Route path="/requests" element={<RequireAuth><AppShell><RequestsList /></AppShell></RequireAuth>} />
      <Route path="/requests/:id" element={<RequireAuth><AppShell><RequestDetail /></AppShell></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><AppShell><EnhancedAnalyticsDashboard /></AppShell></RequireAuth>} />
      <Route path="/collaboration" element={<RequireAuth><AppShell><EnhancedTeamCollaboration /></AppShell></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><AppShell><AdminHome /></AppShell></RequireAuth>} />
      <Route 
        path="/admin/users" 
        element={
          <RequireAuth>
            <AppShell>
              <RequireRole min="admin">
                <UsersAdmin />
              </RequireRole>
            </AppShell>
          </RequireAuth>
        } 
      />
      <Route path="/admin/workflows" element={<RequireAuth><AppShell><Workflows /></AppShell></RequireAuth>} />
      <Route path="/admin/workflows/new" element={<RequireAuth><AppShell><FlowsEditor /></AppShell></RequireAuth>} />
      <Route path="/admin/workflows/:id" element={<RequireAuth><AppShell><FlowsEditor /></AppShell></RequireAuth>} />
      <Route path="/admin/flows" element={<RequireAuth><AppShell><FlowsEditor /></AppShell></RequireAuth>} />
      <Route path="/changes" element={<RequireAuth><AppShell><ChangeCalendar /></AppShell></RequireAuth>} />
      <Route path="/admin/settings" element={<RequireAuth><AppShell><Settings /></AppShell></RequireAuth>} />
      <Route path="/admin/sla-insights" element={<RequireAuth><AppShell><SlaInsights /></AppShell></RequireAuth>} />
      <Route path="/admin/audit" element={<RequireAuth><AppShell><RequireRole min="admin"><AuditLogsPage /></RequireRole></AppShell></RequireAuth>} />
      <Route path="/admin/staff-logs" element={<RequireAuth><AppShell><RequireRole min="staff"><StaffLogsPage /></RequireRole></AppShell></RequireAuth>} />
      <Route path="/admin/daily-logs" element={<RequireAuth><AppShell><RequireRole min="super_admin"><AllDailyLogsPage /></RequireRole></AppShell></RequireAuth>} />
      <Route path="/admin/chat" element={<RequireAuth><AppShell><RequireRole min="staff"><ChatManagement /></RequireRole></AppShell></RequireAuth>} />
      <Route path="/admin/health" element={<RequireAuth><AppShell><RequireRole min="admin"><SystemHealth /></RequireRole></AppShell></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><AppShell><EnhancedReports /></AppShell></RequireAuth>} />
      <Route path="/reports/builder" element={<RequireAuth><AppShell><ReportBuilder /></AppShell></RequireAuth>} />

      {/* My Work / Desk Routes */}
      <Route path="/desk" element={<RequireAuth><AppShell><MyWorkDashboard /></AppShell></RequireAuth>} />
      <Route path="/desk/tasks" element={<RequireAuth><AppShell><TasksPage /></AppShell></RequireAuth>} />
      <Route path="/desk/tasks/:id" element={<RequireAuth><AppShell><TaskDetail /></AppShell></RequireAuth>} />
      <Route path="/desk/projects" element={<RequireAuth><AppShell><ProjectsPage /></AppShell></RequireAuth>} />
      <Route path="/desk/projects/:id" element={<RequireAuth><AppShell><ProjectDetail /></AppShell></RequireAuth>} />
      <Route path="/desk/notes" element={<RequireAuth><AppShell><NotesPage /></AppShell></RequireAuth>} />
      <Route path="/desk/notes/:id" element={<RequireAuth><AppShell><NoteDetail /></AppShell></RequireAuth>} />
      <Route path="/desk/logs" element={<RequireAuth><AppShell><DailyLogsPage /></AppShell></RequireAuth>} />
      <Route path="/desk/files" element={<RequireAuth><AppShell><FilesPage /></AppShell></RequireAuth>} />
      <Route path="/desk/assignments" element={<RequireAuth><AppShell><AssignmentsPage /></AppShell></RequireAuth>} />
      <Route path="/desk/assignments/:id" element={<RequireAuth><AppShell><AssignmentDetail /></AppShell></RequireAuth>} />
      <Route path="/desk/vault" element={<RequireAuth><AppShell><PasswordVaultPage /></AppShell></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}