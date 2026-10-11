import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Skeleton } from './components/ui/skeleton'

const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Agents = lazy(() => import('./pages/Agents').then((m) => ({ default: m.Agents })))
const AgentWorkspace = lazy(() =>
  import('./pages/AgentWorkspace').then((m) => ({ default: m.AgentWorkspace })),
)
const ModelLab = lazy(() => import('./pages/ModelLab').then((m) => ({ default: m.ModelLab })))
const Questionnaires = lazy(() =>
  import('./pages/Questionnaires').then((m) => ({ default: m.Questionnaires })),
)
const Contacts = lazy(() => import('./pages/Contacts').then((m) => ({ default: m.Contacts })))
const Campaigns = lazy(() => import('./pages/Campaigns').then((m) => ({ default: m.Campaigns })))
const CampaignDetail = lazy(() =>
  import('./pages/CampaignDetail').then((m) => ({ default: m.CampaignDetail })),
)
const Calls = lazy(() => import('./pages/Calls').then((m) => ({ default: m.Calls })))
const CallDetail = lazy(() => import('./pages/CallDetail').then((m) => ({ default: m.CallDetail })))
const LiveCalls = lazy(() => import('./pages/LiveCalls').then((m) => ({ default: m.LiveCalls })))
const Leads = lazy(() => import('./pages/Leads').then((m) => ({ default: m.Leads })))
const FollowUps = lazy(() => import('./pages/FollowUps').then((m) => ({ default: m.FollowUps })))
const Businesses = lazy(() => import('./pages/Businesses').then((m) => ({ default: m.Businesses })))
const Telephony = lazy(() => import('./pages/Telephony').then((m) => ({ default: m.Telephony })))
const Analytics = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.Analytics })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))

function PageLoader(): React.JSX.Element {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function NotFound(): React.JSX.Element {
  return <Navigate to="/" replace />
}

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:id" element={<AgentWorkspace />} />
            <Route path="models" element={<ModelLab />} />
            <Route path="questionnaires" element={<Questionnaires />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="calls" element={<Calls />} />
            <Route path="calls/:id" element={<CallDetail />} />
            <Route path="live-calls" element={<LiveCalls />} />
            <Route path="leads" element={<Leads />} />
            <Route path="follow-ups" element={<FollowUps />} />
            <Route path="businesses" element={<Businesses />} />
            <Route path="telephony" element={<Telephony />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
