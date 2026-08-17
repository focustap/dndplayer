import { LogOut, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut, demoMode }=useAuth(); const navigate=useNavigate();
  return <div className="app-shell"><header className="app-header"><Link to="/dashboard" className="app-brand"><span>W</span><div><b>WAYFINDER</b><small>CAMPAIGN COMMAND</small></div></Link><div className="account"><ShieldCheck/><span><b>{user?.user_metadata?.display_name??user?.email}</b><small>{demoMode?"Interactive demo":"Connected to Supabase"}</small></span><button onClick={()=>void signOut().then(()=>navigate("/login"))} aria-label="Sign out"><LogOut/></button></div></header>{demoMode&&<div className="demo-banner">Demo mode — add Supabase environment values to enable persistent multiplayer data.</div>}{children}</div>;
}
