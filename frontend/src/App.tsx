import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode, FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AppInfo, LoginResult, Role, User } from './types';
import { TOKEN_KEY, login, pagesPreview, post, request } from './api';
import { ServicesPage } from './ServicesPage';
import { Dashboard } from './Dashboard';
import { UIIcon } from './UIIcon';
import { BrandLogo } from './BrandLogo';
import { LuminaHero } from './LuminaHero';
import { HomeStory } from './HomeStory';
import type {IconName} from './UIIcon';

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
function Brand({tone="teal"}:{tone?:"teal"|"ivory"}){return <Link className="logo official-brand-link" to="/" aria-label="FlexPass home"><BrandLogo variant="full" tone={tone} decorative/></Link>;}
function PublicLayout({children,home=false,hideHeader=false}:PropsWithChildren<{home?:boolean;hideHeader?:boolean}>){const {user,info}=useApp();return <>
  {!home&&!hideHeader&&<div className="top-strip"><span>{pagesPreview?'FRONTEND PREVIEW · ACCOUNTS UNAVAILABLE':info?.demo_mode?'PRIVATE DEMO ENVIRONMENT · FICTIONAL DATA':'A FLEXIBLE EVERYDAY · MEMBERS ONLY'}</span></div>}
  {!hideHeader&&<header className={`site-header ${home?'quiet-public-header':''}`}>
    <div className="container header-row">
      <Brand/>
      <nav className={`gateway-header-links ${home?'quiet-header-links':''}`} aria-label="Account navigation">
        {user?<><span className="nav-user">{user.role}</span><Link className="btn btn-primary btn-sm" to={`/${user.role}`}>My workspace</Link></>:
        home?<><Link to="/login/client">Client login</Link><Link to="/login/business">Business login</Link></>:
        <Link className="btn btn-outline btn-sm" to="/">Member access</Link>}
      </nav>
    </div>
  </header>}
  {children}
  <footer className={`foot flexpass-footer ${home?'quiet-home-footer':''}`}>
    <div className="container footer-inner">
      <div className="flexpass-footer-top">
        <div className="footer-brand">
          <Brand tone="ivory"/>
          <p>A flexible everyday through wellness, movement and meaningful experiences.</p>
        </div>
        <nav className="footer-right" aria-label="Footer navigation">
          <span className="footer-eyebrow">FLEXPASS · PRIVATE PILOT</span>
          <div className="footlinks">
            <Link to="/">Home</Link>
            <Link to="/contact">About</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </nav>
      </div>
      <div className="flexpass-footer-bottom">
        <span>A flexible everyday.</span>
        <span className="footer-fine">© {new Date().getFullYear()} FlexPass · {pagesPreview?'Frontend preview':'Members only'}</span>
      </div>
    </div>
  </footer>
</>}
function AuthFrame({children}:{children:ReactNode}){
  const photoUrl=`${import.meta.env.BASE_URL}brand/login-pilates.webp`;
  return <main className="auth-page gateway-auth auth-photo-stage">
    <div className="auth-photo-backdrop" aria-hidden="true"><img src={photoUrl} alt=""/></div>
    <div className="auth-card auth-card-refined"><BrandLogo variant="monogram" className="auth-official-monogram" decorative/>{children}</div>
  </main>;
}
function Home(){
  const {user}=useApp();
  if(user)return <Navigate to={`/${user.role}`} replace/>;
  return <PublicLayout home><main className="home-page quiet-home">
    <LuminaHero/>
    <section className="quiet-statement" aria-labelledby="quiet-statement-title">
      <div className="quiet-statement-inner">
        <span className="quiet-statement-eyebrow">OUR PHILOSOPHY</span>
        <h2 id="quiet-statement-title">A healthier, happier <em>everyday.</em></h2>
        <p>Make space for what matters. A flexible way to experience more of what you enjoy.</p>
      </div>
    </section>
    <HomeStory/>
    {pagesPreview&&<div className="container preview-disclaimer">This GitHub Pages build is a visual preview. Account access and live data are available only on the full-stack FlexPass application.</div>}
  </main></PublicLayout>;
}
type LoginPortal = 'client'|'partner'|'admin';
const portalNames:Record<LoginPortal,{title:string;eyebrow:string;description:string}>={
  client:{title:'Client sign in',eyebrow:'01 / CLIENT ACCESS',description:'Explore experiences, purchase credit packages and manage your bookings.'},
  partner:{title:'Business sign in',eyebrow:'02 / PARTNER ACCESS',description:'Manage approved services, sessions, attendance and settlements.'},
  admin:{title:'Admin sign in',eyebrow:'RESTRICTED / FLEXPASS OPERATIONS',description:'Authorized FlexPass administrators only.'}
};
function Login({portal}:{portal:LoginPortal}){const {signIn,notify,user,info}=useApp();const navigate=useNavigate();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [formError,setFormError]=useState('');
  const entry=portalNames[portal];
  // Distinct login portals must not carry typed credentials from another role.
  useEffect(()=>{setEmail('');setPassword('');setFormError('');},[portal]);
  if(user)return <Navigate to={`/${user.role}`} replace/>;
  async function submit(e:FormEvent){e.preventDefault();setFormError('');setBusy(true);try{const u=await signIn(email,password,portal);navigate(`/${u.role}`,{replace:true});notify('Signed in successfully.');}catch(err){const message=(err as Error).message;setFormError(message);notify(message,true);}finally{setBusy(false)}}
  return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">{entry.eyebrow}</div><h1>{entry.title}</h1><p>{entry.description}</p>
    {pagesPreview?<div className="notice">Account access is disabled on the GitHub Pages preview. Open the separately hosted FlexPass application to sign in.</div>:<form key={portal} className="stack" onSubmit={submit} onChange={()=>setFormError('')} autoComplete="off">
      {formError&&<div className="notice warn" role="alert">{formError}</div>}
      <label className="form-field" htmlFor={`flexpass-${portal}-email`}>Email address<input id={`flexpass-${portal}-email`} name={`flexpass-${portal}-username`} className="input" autoComplete={`section-flexpass-${portal} username`} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" spellCheck={false} required/></label>
      <label className="form-field" htmlFor={`flexpass-${portal}-password`}>Password<input id={`flexpass-${portal}-password`} name={`flexpass-${portal}-password`} className="input" autoComplete={`section-flexpass-${portal} current-password`} type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      <button className="btn btn-primary" disabled={busy}>{busy?'Signing in…':'Continue securely →'}</button>
    </form>}
    {info?.demo_mode && import.meta.env.DEV && !pagesPreview && <div className="gateway-demo-hint"><button type="button" className="btn btn-outline btn-sm" onClick={()=>{setEmail(`${portal==='client'?'employee':portal}@flexpass.demo`);setPassword('Demo123!')}}>Use local fictional {portal==='admin'?'admin':portal==='partner'?'partner':'member'} account</button><p className="muted">Local development only; demo passwords are not shown on hosted deployments.</p></div>}
    {portal==='client'&&<p className="gateway-register-link">New to FlexPass? <Link to="/register/client">Register as a client</Link></p>}
    <p className="gateway-return"><Link to="/">← Back to FlexPass</Link></p>
  </AuthFrame></PublicLayout>;
}
function ClientSignup(){const {notify,user}=useApp();const [fullName,setFullName]=useState('');const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const [registered,setRegistered]=useState(false);const [formError,setFormError]=useState('');
  if(user)return <Navigate to={`/${user.role}`} replace/>;
  async function submit(e:FormEvent){e.preventDefault();setFormError('');setBusy(true);try{await post('/auth/register','',{full_name:fullName,email});setRegistered(true);}catch(err){const message=(err as Error).message;setFormError(message);notify(message,true)}finally{setBusy(false)}}
  return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">CREATE YOUR FLEXPASS ACCOUNT</div><h1>Register as a client</h1><p>Personal registration gives you access to the FlexPass experience catalog. Purchase requests do not charge your card: orders require confirmation before credits are issued.</p>
    {pagesPreview?<div className="notice">Registration is available on the full FlexPass application hosted on Render.</div>:registered?<div className="notice" role="status">Registration received. Check your email for a one-time activation link. Once activated, sign in from the Client portal.</div>:<form className="stack" onSubmit={submit} onChange={()=>setFormError('')}>
      {formError&&<div className="notice warn" role="alert">{formError}</div>}
      <label className="form-field">Full name<input className="input" value={fullName} onChange={e=>setFullName(e.target.value)} minLength={2} maxLength={160} autoComplete="name" required/></label>
      <label className="form-field">Email address<input className="input" value={email} onChange={e=>setEmail(e.target.value)} type="email" maxLength={200} autoComplete="email" required/></label>
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Submitting…':'Register →'}</button>
    </form>}
    <p className="gateway-return"><Link to="/login/client">← Already registered? Client sign in</Link></p></AuthFrame></PublicLayout>;
}
function Register(){const {notify,user}=useApp();const navigate=useNavigate();const [search]=useSearchParams();const [token,setToken]=useState(search.get('token')||'');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [success,setSuccess]=useState(false);const [formError,setFormError]=useState('');
  if(user)return <Navigate to={`/${user.role}`} replace/>;
  async function submit(e:FormEvent){e.preventDefault();setFormError('');if(password!==confirm){setFormError('Passwords do not match. Re-enter the confirmation password.');return;}setBusy(true);
    try{const result=await post<{status:string;role:Role}>('/auth/activate','',{token,password});setSuccess(true);notify('Account activated. You can now sign in.');navigate(result.role==='partner'?'/login/business':'/login/client',{replace:true});}
    catch(err){const message=(err as Error).message;setFormError(message);notify(message,true)}finally{setBusy(false)}
  }
  return <PublicLayout hideHeader><AuthFrame><div className="eyebrow">ACCOUNT ACTIVATION</div><h1>Create your account</h1><p>Use the individual invitation sent by FlexPass. Business accounts are invited by FlexPass. Client accounts use the separate registration form.</p>
    {pagesPreview?<div className="notice">Activation is available on the full-stack Render application, not GitHub Pages.</div>:success?<div className="notice" role="status">Your account is active. Continue to your sign-in page.</div>:<form className="stack" onSubmit={submit} onChange={()=>setFormError('')}>
      {formError&&<div className="notice warn" role="alert">{formError}</div>}
      <label className="form-field">Invitation code<input className="input" type="text" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} required minLength={32} placeholder="Paste your invitation code"/></label>
      <label className="form-field">Create password<input className="input" type="password" autoComplete="new-password" minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} required/><small className="field-hint">Use at least 12 characters. Do not reuse an existing password.</small></label>
      <label className="form-field">Confirm password<input className="input" type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>
      <button className="btn btn-primary" disabled={busy}>{busy?'Activating…':'Activate account →'}</button>
    </form>}
    <div className="notice" style={{marginTop:20}}>Activation links expire after 24 hours. Contact FlexPass if your link has expired.</div><p className="gateway-return"><Link to="/login/client">← Client sign in</Link></p>
  </AuthFrame></PublicLayout>;
}
function StaticPage({kind}:{kind:'contact'|'privacy'|'terms'}){
  const contents={
    contact:['Contact & access','FlexPass is operating as a pilot. Clients can request personal accounts; approved businesses are onboarded by the FlexPass team.','Account activation requires email delivery to be configured. If registration or an invitation fails, contact the FlexPass team through your existing point of contact.'],
    privacy:['Privacy notice','FlexPass uses account information and booking details to run its client, business and administrator workspaces. Pilot listings may be fictional.','This page is an interim notice and is not a complete privacy policy. Do not submit sensitive or banking information until the production privacy review and approved notices are in place.'],
    terms:['Terms of use','The app currently supports credit-package requests and bookings. Payments are not processed automatically; any incoming bank transfer must be independently verified before credits are confirmed.','These are pilot disclosures, not final consumer terms. Cancellation, refunds and other consumer policies must be approved before real-world operation.']
  } as const;
  const [title,body,note]=contents[kind];
  return <PublicLayout><main className="content-page editorial-content-page">
    <nav className="content-breadcrumb"><Link to="/">FlexPass</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
    <div className="eyebrow">A FLEXIBLE EVERYDAY</div><h1>{title}</h1>
    <p className="content-intro">{body}</p><div className="notice" role="note">{note}</div>
    <div className="content-page-actions"><Link to="/" className="btn btn-outline">Back to FlexPass <UIIcon name="arrow" size={16}/></Link></div>
  </main></PublicLayout>;
}
function Authenticated({role}:{role:Role}){const {user}=useApp();if(!user)return <Navigate to={role==='admin'?'/admin/login':role==='partner'?'/login/business':'/login/client'} replace/>;if(user.role!==role)return <Navigate to={`/${user.role}`} replace/>;return <Dashboard role={role}/>;}
function EmployeeSectionRedirect(){const {section}=useParams<{section:string}>();return <Navigate to={`/client/${section||'overview'}`} replace/>;}
function ProtectedServices(){const {user}=useApp();if(!user)return <Navigate to="/login/client" replace/>;if(user.role!=='client')return <Navigate to={`/${user.role}`} replace/>;return <PublicLayout><ServicesPage/></PublicLayout>}
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
    <Route path="/register/client" element={<ClientSignup/>}/><Route path="/register" element={<Register/>}/><Route path="/login" element={<Navigate to="/" replace/>}/><Route path="/login/client" element={<Login portal="client"/>}/><Route path="/login/business" element={<Login portal="partner"/>}/><Route path="/admin/login" element={<Login portal="admin"/>}/>
    <Route path="/contact" element={<StaticPage kind="contact"/>}/><Route path="/privacy" element={<StaticPage kind="privacy"/>}/><Route path="/terms" element={<StaticPage kind="terms"/>}/>
    <Route path="/client" element={<Navigate to="/client/overview" replace/>}/><Route path="/client/:section" element={<Authenticated role="client"/>}/>
    <Route path="/employee" element={<Navigate to="/client/overview" replace/>}/><Route path="/employee/:section" element={<EmployeeSectionRedirect/>}/>
    <Route path="/partner" element={<Navigate to="/partner/overview" replace/>}/><Route path="/partner/:section" element={<Authenticated role="partner"/>}/>
    <Route path="/admin" element={<Navigate to="/admin/overview" replace/>}/><Route path="/admin/:section" element={<Authenticated role="admin"/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes>{message&&<div role="status" className={`toast-fixed ${message.error?'toast-error':''}`}>{message.body}</div>}</AppContext.Provider>;
}
export function StatusTag({status}:{status:string}){return <span className={`status status-${status}`}><span aria-hidden="true" className="status-dot"/>{status.replace(/_/g,' ')}</span>}
export function Panel({title,children,action}:{title:string;children:ReactNode;action?:ReactNode}){return <div className="panel"><div className="panel-header"><h3>{title}</h3>{action}</div>{children}</div>}
function statIcon(label:string):IconName{
  const value=label.toLowerCase();
  if(value.includes('booking')||value.includes('reservations')||value.includes('visits'))return 'calendar';
  if(value.includes('credit')||value.includes('wallet'))return 'credit';
  if(value.includes('client')||value.includes('employee'))return 'users';
  if(value.includes('partner')||value.includes('services'))return 'store';
  if(value.includes('orders')||value.includes('invoice')||value.includes('requests'))return 'receipt';
  if(value.includes('earn')||value.includes('payable'))return 'wallet';
  return 'activity';
}
export function Stat({icon,label,value,small}:{icon:string;label:string;value:string|number;small?:string}){return <div className="stat"><span className="stat-icon" aria-hidden="true"><UIIcon name={statIcon(label)} size={21}/></span><span className="stat-label">{label}</span><strong>{value}</strong>{small&&<small>{small}</small>}</div>}
export function Heading({title,subtitle,action}:{title:string;subtitle:string;action?:ReactNode}){return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>}
export function Modal({title,subtitle,children,onClose}:{title:string;subtitle?:string;children:ReactNode;onClose:()=>void}){
  useEffect(()=>{const cb=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',cb);return()=>window.removeEventListener('keydown',cb)},[onClose]);
  return <div className="modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-head"><div><h2>{title}</h2><p>{subtitle||''}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><UIIcon name="close" size={19}/></button></div>{children}</div></div>;
}
