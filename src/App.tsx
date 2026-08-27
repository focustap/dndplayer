import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { CampaignPage } from "./pages/CampaignPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TabletopPage } from "./pages/TabletopPage";
import { SceneBuilderPage } from "./pages/SceneBuilderPage";

function RequireAuth({children}:{children:React.ReactNode}){const {user,loading}=useAuth();const location=useLocation();const localDemo=import.meta.env.DEV&&location.pathname.startsWith("/campaign/demo/");if(localDemo)return <>{children}</>;if(loading)return <div className="table-loading"><span>W</span><p>Restoring your session…</p></div>;return user?<>{children}</>:<Navigate replace to="/login" state={{from:location}}/>}
function BuildBadge(){const full=import.meta.env.VITE_BUILD_SHA||"dev";const short=full==="dev"?"dev":full.slice(0,7);return <div className="build-badge" title={`Deployed commit ${full}`}>BUILD {short}</div>}
export function App(){return <AuthProvider><Routes><Route path="/login" element={<AuthPage/>}/><Route path="/register" element={<AuthPage register/>}/><Route path="/dashboard" element={<RequireAuth><DashboardPage/></RequireAuth>}/><Route path="/campaign/:campaignId" element={<RequireAuth><CampaignPage/></RequireAuth>}/><Route path="/campaign/:campaignId/scene/:sceneId/builder" element={<RequireAuth><SceneBuilderPage/></RequireAuth>}/><Route path="/campaign/:campaignId/dm" element={<RequireAuth><TabletopPage/></RequireAuth>}/><Route path="/campaign/:campaignId/play" element={<RequireAuth><TabletopPage playerView/></RequireAuth>}/><Route path="*" element={<Navigate replace to="/dashboard"/>}/></Routes><BuildBadge/></AuthProvider>}
