import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { CampaignPage } from "./pages/CampaignPage";
import { DashboardPage } from "./pages/DashboardPage";
import { TabletopPage } from "./pages/TabletopPage";

function RequireAuth({children}:{children:React.ReactNode}){const {user,loading}=useAuth();const location=useLocation();if(loading)return <div className="table-loading"><span>W</span><p>Restoring your session…</p></div>;return user?<>{children}</>:<Navigate replace to="/login" state={{from:location}}/>}
export function App(){return <AuthProvider><Routes><Route path="/login" element={<AuthPage/>}/><Route path="/register" element={<AuthPage register/>}/><Route path="/dashboard" element={<RequireAuth><DashboardPage/></RequireAuth>}/><Route path="/campaign/:campaignId" element={<RequireAuth><CampaignPage/></RequireAuth>}/><Route path="/campaign/:campaignId/dm" element={<RequireAuth><TabletopPage/></RequireAuth>}/><Route path="/campaign/:campaignId/play" element={<RequireAuth><TabletopPage playerView/></RequireAuth>}/><Route path="*" element={<Navigate replace to="/dashboard"/>}/></Routes></AuthProvider>}
