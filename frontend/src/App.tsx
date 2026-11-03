import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode, FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { AppInfo, LoginResult, Role, User } from './types';
import { TOKEN_KEY, icons, labels, login, pagesPreview, request } from './api';
import { ServicesPage } from './ServicesPage';
import { Dashboard } from './Dashboard';

interface AppContextValue {
  user: User|null;
  token: string;
  info:AppInfo|null;
  signIn:(email:string,password:string)=>Promise<User>;
  signOut:()=>void;
  notify:(text:string,isError?:boolean)=>void;
}
const AppContext=createContext<AppContextValue|null>(null);
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('Missing app context');return value;}
const groups=Object.keys(labels) as (keyof typeof labels)[];
function Brand(){return <Link className="logo" to="/"><span className="logo-mark">✳</span>FlexPass</Link>;}
function PublicLayout({children}:PropsWithChildren){const {user,info}=useApp();const location=useLocation();return <>
  {pagesPreview ? <div className="top-strip"><strong>Read-only public preview</strong> &nbsp; Fictional services. No accounts, bookings, payments or live availability.</div> : info?.demo_mode && <div className="top-strip"><strong>Demo environment</strong> &nbsp; Fictional Tirana data and no live payment processing.</div>}
  <header className="site-header"><div className="container header-row"><Brand/>
    <nav className="category-nav" aria-label="Experience categories">{groups.map(group=><Link key={group} className={new URLSearchParams(location.search).get('group')===group?'active':''} to={`/services?group=${group}`}>{labels[group]}</Link>)}</nav>
    <div className="header-actions">{user?<><span className="nav-user">{user.role}</span><Link className="btn btn-primary btn-sm" to={`/${user.role}`}>Dashboard ↗</Link></>:<>{pagesPreview?<span className="nav-user">Preview only</span>:<Link className="btn btn-outline btn-sm" to="/login">Log in</Link>}<Link className="btn btn-primary btn-sm" to="/contact">About the pilot ↗</Link></>}</div>
  </div></header>
  {children}
  <footer className="foot"><div className="container foot-row"><div><Brand/><p>Private-launch access pass for premium daily services, real booking, and hard-to-reach routines.</p></div><div className="footlinks"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/contact">Contact</Link></div></div></footer>
</>}
function Home(){return <PublicLayout><main className="container"><section className="hero"><div className="hero-panel"><div className="glow-circle"/><div className="hero-copy"><div className="eyebrow">Your everyday access pass</div><h1>More ways to move.<br/>One FlexPass.</h1><p>Find the experiences that fit your day, from gym sessions and yoga to wellness and family time.</p><div className="hero-actions"><Link className="btn btn-primary" to="/services">Explore experiences →</Link><Link className="btn btn-outline" to="/contact">How it works</Link></div></div><div className="hero-graphic">✦</div></div></section>
  <div className="section-title-row"><div><h2>Explore by category</h2><p>Discover something new in Tirana.</p></div><Link className="btn btn-outline btn-sm" to="/services">View all →</Link></div>
  <div className="category-grid">{groups.map(g=><Link key={g} className="category-tile" to={`/services?group=${g}`}><span className="category-emoji">{icons[g]}</span><b>{labels[g]}</b><small>Discover experiences →</small></Link>)}</div>
  <div className="section-spacer"/><div className="callout-gradient"><div className="eyebrow" style={{color:'#e3d2ff'}}>B2B access</div><h2>Built for your team, designed for everyday life.</h2><p>Employer-funded credits with a flexible network of experiences.</p><Link className="btn btn-outline" to="/contact">Request access →</Link></div>
</main></PublicLayout>}
function Login(){const {signIn,notify,user,info}=useApp();const navigate=useNavigate();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
  if(pagesPreview)return <PublicLayout><main className="auth-page"><div className="auth-card"><Brand/><h1>Accounts are not enabled in this preview</h1><p>This GitHub Pages site shows fictional services only. Sign-in and the three dashboards require the separate FastAPI backend and database.</p><Link className="btn btn-primary" to="/services">Explore sample services →</Link></div></main></PublicLayout>;
  if(user)return <Navigate to={`/${user.role}`} replace/>;
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{const u=await signIn(email,password);navigate(`/${u.role}`,{replace:true});notify('Signed in successfully.');}catch(err){notify((err as Error).message,true);}finally{setBusy(false)}}
  return <PublicLayout><main className="auth-page"><div className="auth-card"><Brand/><div className="eyebrow">Welcome back</div><h1>Log in to FlexPass</h1><p>Access your services, bookings and management tools.</p><form className="stack" onSubmit={submit}>
    <label className="form-field">Email address<input className="input" autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com" required/></label>
    <label className="form-field">Password<input className="input" autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
    <button className="btn btn-primary" disabled={busy}>{busy?'Signing in...':'Log in →'}</button></form><div className="divider"/>
    {info?.demo_mode && import.meta.env.DEV && <><div className="muted" style={{fontWeight:900,marginBottom:9}}>LOCAL DEMO ACCOUNT SHORTCUTS</div>
    {(['employee','partner','admin'] as Role[]).map(role=><button key={role} className="demo-account" style={{width:'100%'}} type="button" onClick={()=>{setEmail(`${role}@flexpass.demo`);setPassword('Demo123!')}}><span>{role==='employee'?'🏃':role==='partner'?'🏬':'⚙️'} &nbsp; <b>{role[0].toUpperCase()+role.slice(1)}</b><small style={{display:'block',marginLeft:26}}>{role}@flexpass.demo</small></span><span>Use demo →</span></button>)}
    <p className="muted" style={{marginTop:17}}>Local-only demo password: <b>Demo123!</b> · Fictional accounts only.</p></>}
  </div></main></PublicLayout>;
}
function StaticPage({kind}:{kind:'contact'|'privacy'|'terms'}){const contents={contact:['Request access','FlexPass is a private-launch B2B pilot. Contact the project team through your organization to join an approved pilot.','Online application and payment are intentionally not enabled in the MVP.'],privacy:['Privacy notice','This is an MVP preview with fictional services. Do not enter real personal or payment information.','A reviewed production privacy policy is required before a public pilot.'],terms:['Terms of use','This project is a functional MVP demonstration, not a live consumer service.','Booking and cancellation policies must be approved before real-world operation.']} as const;const [title,body,note]=contents[kind];return <PublicLayout><main className="content-page"><div className="eyebrow">FlexPass</div><h1>{title}</h1><p>{body}</p><div className="notice">{note}</div><p style={{marginTop:22}}><Link to="/services" className="btn btn-primary">Explore services</Link></p></main></PublicLayout>}
function Authenticated({role}:{role:Role}){const {user}=useApp();if(!user)return <Navigate to="/login" replace/>;if(user.role!==role)return <Navigate to={`/${user.role}`} replace/>;return <Dashboard role={role}/>;}
export function App(){const [token,setToken]=useState(()=>sessionStorage.getItem(TOKEN_KEY)||'');const [user,setUser]=useState<User|null>(null);const [info,setInfo]=useState<AppInfo|null>(null);const [loading,setLoading]=useState(Boolean(sessionStorage.getItem(TOKEN_KEY)));const [message,setMessage]=useState<{body:string;error:boolean}|null>(null);
  useEffect(()=>{request<AppInfo>('/info').then(setInfo).catch(()=>{});},[]);
  useEffect(()=>{if(!token){setLoading(false);setUser(null);return;}let active=true;request<User>('/auth/me',token).then(u=>{if(active)setUser(u);}).catch(()=>{if(active){setToken('');sessionStorage.removeItem(TOKEN_KEY);setUser(null);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[token]);
  useEffect(()=>{if(!message)return;const id=window.setTimeout(()=>setMessage(null),4500);return()=>window.clearTimeout(id)},[message]);
  const signIn=async(email:string,password:string)=>{const result:LoginResult=await login(email,password);sessionStorage.setItem(TOKEN_KEY,result.token);setToken(result.token);setUser(result.user);setLoading(false);return result.user;};
  const signOut=()=>{sessionStorage.removeItem(TOKEN_KEY);setToken('');setUser(null)};
  const notify=(body:string,error=false)=>setMessage({body,error});
  const context:AppContextValue={user,token,info,signIn,signOut,notify};
  if(loading)return <div className="loading">Validating session...</div>;
  return <AppContext.Provider value={context}><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/services" element={<PublicLayout><ServicesPage/></PublicLayout>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/contact" element={<StaticPage kind="contact"/>}/><Route path="/privacy" element={<StaticPage kind="privacy"/>}/><Route path="/terms" element={<StaticPage kind="terms"/>}/>
    <Route path="/employee" element={<Authenticated role="employee"/>}/><Route path="/partner" element={<Authenticated role="partner"/>}/><Route path="/admin" element={<Authenticated role="admin"/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>{message&&<div role="status" className={`toast-fixed ${message.error?'toast-error':''}`}>{message.body}</div>}</AppContext.Provider>;
}
export function StatusTag({status}:{status:string}){return <span className={`status status-${status}`}>{status.replace(/_/g,' ')}</span>}
export function Panel({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){return <div className="panel"><div className="panel-header"><h3>{title}</h3>{action}</div>{children}</div>}
export function Stat({icon,label,value,small}:{icon:string;label:string;value:string|number;small?:string}){return <div className="stat"><span className="stat-icon">{icon}</span><label>{label}</label><strong>{value}</strong><small>{small}</small></div>}
export function Heading({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
export function Modal({title,subtitle,children,onClose}:{title:string;subtitle?:string;children:ReactNode;onClose:()=>void}){
  useEffect(()=>{const cb=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',cb);return()=>window.removeEventListener('keydown',cb)},[onClose]);
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2><p>{subtitle||''}</p></div><button className="icon-button" onClick={onClose} aria-label="Close">✕</button></div>{children}</div></div>;
}
