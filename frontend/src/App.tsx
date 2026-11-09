import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode, FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { AppInfo, LoginResult, Role, User } from './types';
import { TOKEN_KEY, login, pagesPreview, request } from './api';
import { ServicesPage } from './ServicesPage';
import { Dashboard } from './Dashboard';

interface AppContextValue {
  user: User|null;
  token: string;
  info:AppInfo|null;
  signIn:(email:string,password:string,portal:Role)=>Promise<User>;
  signOut:()=>void;
  notify:(text:string,isError?:boolean)=>void;
}
const AppContext=createContext<AppContextValue|null>(null);
export function useApp(){const value=useContext(AppContext);if(!value)throw new Error('Missing app context');return value;}
function Brand(){return <Link className="logo" to="/" aria-label="FlexPass home"><span className="brand-monogram" aria-hidden="true">FP</span><span className="brand-wordmark"><strong>FLEXPASS</strong><small>A FLEXIBLE EVERYDAY</small></span></Link>;}
function PublicLayout({children}:PropsWithChildren){const {user,info}=useApp();return <>
  <div className="top-strip"><span>{pagesPreview?'FRONTEND PREVIEW · ACCOUNTS UNAVAILABLE':info?.demo_mode?'PRIVATE DEMO ENVIRONMENT · FICTIONAL DATA':'A FLEXIBLE EVERYDAY · MEMBERS ONLY'}</span></div>
  <header className="site-header"><div className="container header-row"><Brand/>
    <nav className="gateway-header-links" aria-label="Account navigation">{user?<><span className="nav-user">{user.role}</span><Link className="btn btn-primary btn-sm" to={`/${user.role}`}>My workspace ↗</Link></>:<Link className="btn btn-outline btn-sm" to="/">Member access</Link>}</nav>
  </div></header>
  {children}
  <footer className="foot"><div className="container footer-inner"><div className="footer-brand"><Brand/><p>A flexible everyday through wellness, movement and meaningful experiences.</p></div><div className="footer-right"><span className="footer-eyebrow">FLEXPASS · PRIVATE PILOT</span><div className="footlinks"><Link to="/">Home</Link><Link to="/contact">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div><span className="footer-fine">© {new Date().getFullYear()} FlexPass · {pagesPreview?'Frontend preview':'Members only'}</span></div></div></footer>
</>}
function Home(){const {user}=useApp();if(user)return <Navigate to={`/${user.role}`} replace/>;return <PublicLayout><main className="home-page gateway-home">
  <section className="hero editorial-hero container" aria-labelledby="home-title">
    <div className="hero-text">
      <div className="hero-index"><span>THE FLEXPASS WAY OF LIFE</span><span>PRIVATE MEMBERSHIP ACCESS</span></div>
      <div className="hero-copy"><div className="eyebrow">A FLEXIBLE EVERYDAY</div><h1 id="home-title">More experiences.<br/><em>A more flexible everyday.</em></h1><div className="hero-rule"/><p>Your wellness, movement and lifestyle benefits in one place. Sign in to explore your membership or manage your partner services.</p>
        <div className="gateway-access" aria-label="Choose your account type">
          <Link className="gateway-access-card" to="/login/client"><span className="gateway-card-index">01 / CLIENT ACCESS</span><strong>For members</strong><span>Access your credits, services and bookings.</span><span className="gateway-card-action">Client sign in ↗</span></Link>
          <Link className="gateway-access-card gateway-access-card-business" to="/login/business"><span className="gateway-card-index">02 / BUSINESS ACCESS</span><strong>For partners</strong><span>Manage sessions, reservations and settlements.</span><span className="gateway-card-action">Business sign in ↗</span></Link>
        </div>
      </div>
      <div className="hero-footnote"><span className="footnote-line"/> WELLNESS&nbsp; · &nbsp; LIFESTYLE&nbsp; · &nbsp; FREEDOM</div>
    </div>
    <div className="hero-art"><img src={`${import.meta.env.BASE_URL}brand/arch-view.jpg`} alt="Mediterranean arch overlooking a calm sea"/><div className="hero-art-shade"/><div className="hero-art-caption">A HEALTHIER,<br/><em>HAPPIER EVERYDAY.</em></div><span className="hero-art-index">FLEXPASS</span></div>
  </section>
  <section className="brand-manifesto"><div className="container manifesto-inner"><span className="manifesto-label">MADE FOR YOUR EVERYDAY</span><p>Meaningful experiences start with <em>membership.</em></p><div className="manifesto-stars" aria-hidden="true">✳</div></div></section>
  <section className="gateway-about container"><span className="eyebrow">YOUR FLEXPASS MEMBERSHIP</span><h2>One platform.<br/><em>Two ways to experience it.</em></h2><p>Members can discover experiences and manage their credits. Approved partners can manage available sessions and confirmed visits. Access is provided only to authorized accounts.</p></section>
  {pagesPreview&&<div className="container preview-disclaimer">This GitHub Pages build is a visual preview. Account access and live data are available only on the separately hosted full-stack application.</div>}
</main></PublicLayout>}
type LoginPortal = 'employee'|'partner'|'admin';
const portalNames:Record<LoginPortal,{title:string;eyebrow:string;description:string}>={
  employee:{title:'Client sign in',eyebrow:'01 / MEMBER ACCESS',description:'Access your membership, services, credits and bookings.'},
  partner:{title:'Business sign in',eyebrow:'02 / PARTNER ACCESS',description:'Manage approved services, sessions, attendance and settlements.'},
  admin:{title:'Admin sign in',eyebrow:'RESTRICTED / FLEXPASS OPERATIONS',description:'Authorized FlexPass administrators only.'}
};
function Login({portal}:{portal:LoginPortal}){const {signIn,notify,user,info}=useApp();const navigate=useNavigate();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
  const entry=portalNames[portal];
  if(user)return <Navigate to={`/${user.role}`} replace/>;
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);try{const u=await signIn(email,password,portal);navigate(`/${u.role}`,{replace:true});notify('Signed in successfully.');}catch(err){notify((err as Error).message,true);}finally{setBusy(false)}}
  return <PublicLayout><main className="auth-page gateway-auth"><div className="auth-card"><div className="eyebrow">{entry.eyebrow}</div><h1>{entry.title}</h1><p>{entry.description}</p>
    {pagesPreview?<div className="notice">Account access is disabled on the GitHub Pages preview. Open the separately hosted FlexPass application to sign in.</div>:<form className="stack" onSubmit={submit}>
      <label className="form-field">Email address<input className="input" autoComplete="username" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required/></label>
      <label className="form-field">Password<input className="input" autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <button className="btn btn-primary" disabled={busy}>{busy?'Signing in…':'Continue securely →'}</button>
    </form>}
    {info?.demo_mode && import.meta.env.DEV && !pagesPreview && <div className="gateway-demo-hint"><button type="button" className="btn btn-outline btn-sm" onClick={()=>{setEmail(`${portal}@flexpass.demo`);setPassword('Demo123!')}}>Use local fictional {portal==='admin'?'admin':portal==='partner'?'partner':'member'} account</button><p className="muted">Local development only; demo passwords are not shown on hosted deployments.</p></div>}
    <p className="gateway-return"><Link to="/">← Back to FlexPass</Link></p>
  </div></main></PublicLayout>;
}
function StaticPage({kind}:{kind:'contact'|'privacy'|'terms'}){const contents={contact:['Request access','FlexPass is a private-launch B2B pilot. Contact the project team through your organization to join an approved pilot.','Online application and payment are intentionally not enabled in the MVP.'],privacy:['Privacy notice','This is an MVP preview with fictional services. Do not enter real personal or payment information.','A reviewed production privacy policy is required before a public pilot.'],terms:['Terms of use','This project is a functional MVP demonstration, not a live consumer service.','Booking and cancellation policies must be approved before real-world operation.']} as const;const [title,body,note]=contents[kind];return <PublicLayout><main className="content-page"><div className="eyebrow">FlexPass</div><h1>{title}</h1><p>{body}</p><div className="notice">{note}</div><p style={{marginTop:22}}><Link to="/" className="btn btn-primary">Back to FlexPass</Link></p></main></PublicLayout>}
function Authenticated({role}:{role:Role}){const {user}=useApp();if(!user)return <Navigate to={role==='admin'?'/admin/login':role==='partner'?'/login/business':'/login/client'} replace/>;if(user.role!==role)return <Navigate to={`/${user.role}`} replace/>;return <Dashboard role={role}/>;}
function ProtectedServices(){const {user}=useApp();if(!user)return <Navigate to="/login/client" replace/>;if(user.role!=='employee')return <Navigate to={`/${user.role}`} replace/>;return <PublicLayout><ServicesPage/></PublicLayout>}
export function App(){const [token,setToken]=useState(()=>sessionStorage.getItem(TOKEN_KEY)||'');const [user,setUser]=useState<User|null>(null);const [info,setInfo]=useState<AppInfo|null>(null);const [loading,setLoading]=useState(Boolean(sessionStorage.getItem(TOKEN_KEY)));const [message,setMessage]=useState<{body:string;error:boolean}|null>(null);
  useEffect(()=>{request<AppInfo>('/info').then(setInfo).catch(()=>{});},[]);
  useEffect(()=>{if(!token){setLoading(false);setUser(null);return;}let active=true;request<User>('/auth/me',token).then(u=>{if(active)setUser(u);}).catch(()=>{if(active){setToken('');sessionStorage.removeItem(TOKEN_KEY);setUser(null);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false};},[token]);
  useEffect(()=>{if(!message)return;const id=window.setTimeout(()=>setMessage(null),4500);return()=>window.clearTimeout(id)},[message]);
  const signIn=async(email:string,password:string,portal:Role)=>{const result:LoginResult=await login(email,password,portal);sessionStorage.setItem(TOKEN_KEY,result.token);setToken(result.token);setUser(result.user);setLoading(false);return result.user;};
  const signOut=()=>{sessionStorage.removeItem(TOKEN_KEY);setToken('');setUser(null)};
  const notify=(body:string,error=false)=>setMessage({body,error});
  const context:AppContextValue={user,token,info,signIn,signOut,notify};
  if(loading)return <div className="loading">Validating session...</div>;
  return <AppContext.Provider value={context}><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/services" element={<ProtectedServices/>}/>
    <Route path="/login" element={<Navigate to="/" replace/>}/><Route path="/login/client" element={<Login portal="employee"/>}/><Route path="/login/business" element={<Login portal="partner"/>}/><Route path="/admin/login" element={<Login portal="admin"/>}/>
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
