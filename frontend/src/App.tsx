import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren, ReactNode, FormEvent } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { AppInfo, LoginResult, Role, User } from './types';
import { TOKEN_KEY, labels, login, pagesPreview, request } from './api';
import { BrandIcon } from './BrandIcon';
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
function Brand(){return <Link className="logo" to="/" aria-label="FlexPass home"><span className="brand-monogram" aria-hidden="true">FP</span><span className="brand-wordmark"><strong>FLEXPASS</strong><small>A FLEXIBLE EVERYDAY</small></span></Link>;}
function PublicLayout({children}:PropsWithChildren){const {user,info}=useApp();const location=useLocation();return <>
  <div className="top-strip"><span>{pagesPreview?'DESIGN PREVIEW · FICTIONAL EXPERIENCES · BOOKINGS DISABLED':info?.demo_mode?'DEMO ENVIRONMENT · FICTIONAL SERVICES':'WELLNESS · LIFESTYLE · FREEDOM · EXPERIENCES'}</span></div>
  <header className="site-header"><div className="container header-row"><Brand/>
    <nav className="category-nav" aria-label="Experience categories">{groups.map(group=><Link key={group} className={new URLSearchParams(location.search).get('group')===group?'active':''} to={`/services?group=${group}`}>{labels[group]}</Link>)}</nav>
    <div className="header-actions">{user?<><span className="nav-user">{user.role}</span><Link className="btn btn-primary btn-sm" to={`/${user.role}`}>Dashboard <span aria-hidden="true">↗</span></Link></>:<>{!pagesPreview&&<Link className="btn btn-outline btn-sm" to="/login">Log in</Link>}<Link className="btn btn-primary btn-sm" to="/services">Explore <span aria-hidden="true">↗</span></Link></>}</div>
  </div></header>
  {children}
  <footer className="foot"><div className="container footer-inner"><div className="footer-brand"><Brand/><p>A flexible everyday through wellness, movement and meaningful experiences.</p></div><div className="footer-right"><span className="footer-eyebrow">DISCOVER YOUR EVERYDAY</span><div className="footlinks"><Link to="/services">Experiences</Link><Link to="/contact">About the pilot</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div><span className="footer-fine">© {new Date().getFullYear()} FlexPass · {pagesPreview?'Concept preview — fictional content':'Everyday experiences'}</span></div></div></footer>
</>}
const categoryDescriptions:Record<keyof typeof labels,string>={
  fitness:'Strength for every day',sport:'Find your rhythm',wellness:'A little time to restore',glow:'Your moments of self-care','kids-family':'Make memories together'
};
function Home(){return <PublicLayout><main className="home-page">
  <section className="hero editorial-hero container" aria-labelledby="home-title">
    <div className="hero-text">
      <div className="hero-index"><span>THE FLEXPASS WAY OF LIFE</span><span>01 / EVERYDAY WELLBEING</span></div>
      <div className="hero-copy"><div className="eyebrow">A FLEXIBLE EVERYDAY</div><h1 id="home-title">More experiences.<br/><em>A more flexible everyday.</em></h1><div className="hero-rule"/><p>A flexible everyday through wellness, movement and meaningful experiences. Find room for more of what makes you feel good.</p>
        <div className="hero-actions"><Link className="btn btn-primary" to="/services">Explore experiences <span aria-hidden="true">→</span></Link><Link className="btn btn-tertiary" to="/contact">Discover FlexPass <span aria-hidden="true">↗</span></Link></div>
      </div>
      <div className="hero-footnote"><span className="footnote-line"/> WELLNESS&nbsp; · &nbsp; LIFESTYLE&nbsp; · &nbsp; FREEDOM</div>
    </div>
    <div className="hero-art"><img src={`${import.meta.env.BASE_URL}brand/arch-view.jpg`} alt="Warm Mediterranean arch framing a calm blue sea and an inviting seating area"/><div className="hero-art-shade"/><div className="hero-art-caption">A HEALTHIER,<br/><em>HAPPIER EVERYDAY.</em></div><span className="hero-art-index">01 — 05</span></div>
  </section>
  <section className="brand-manifesto"><div className="container manifesto-inner"><span className="manifesto-label">AN INVITATION TO LIVE WELL</span><p>Every day holds the possibility of <em>something more.</em></p><div className="manifesto-stars" aria-hidden="true">✳</div></div></section>
  <section className="collection-section container" aria-labelledby="category-title"><div className="section-header"><div><div className="eyebrow">01 / THE COLLECTION</div><h2 id="category-title">Explore what <em>moves you.</em></h2><p>Small moments, meaningful experiences. Choose your own pace.</p></div><Link className="text-link" to="/services">View all experiences <span aria-hidden="true">↗</span></Link></div>
    <div className="category-grid">{groups.map((g,i)=><Link key={g} className={`category-tile category-${g}`} to={`/services?group=${g}`}><div className="category-top"><span className="category-number">0{i+1}</span><span className="category-arrow" aria-hidden="true">↗</span></div><span className="category-icon"><BrandIcon group={g}/></span><div><b>{labels[g]}</b><small>{categoryDescriptions[g]}</small></div></Link>)}</div>
  </section>
  <section className="brand-story container" aria-labelledby="brand-story-title"><div className="story-graphic"><div className="story-arch"><div className="story-water"/></div><div className="story-note">MORE<br/><em>everyday</em></div></div><div className="story-copy"><div className="eyebrow">02 / THE PHILOSOPHY</div><h2 id="brand-story-title">Wellness is not a destination.<br/><em>It's a way of living.</em></h2><p>Make space for movement, rest, connection and the experiences that make each week feel a little more yours.</p><div className="story-points"><div><span>01</span><p><strong>Find your experience</strong><small>Discover movement, wellness and more.</small></p></div><div><span>02</span><p><strong>Choose what suits you</strong><small>Explore activities at your own pace.</small></p></div><div><span>03</span><p><strong>Make everyday count</strong><small>Discover moments worth making time for.</small></p></div></div><Link className="btn btn-secondary" to="/services">Explore the collection <span aria-hidden="true">→</span></Link></div></section>
  <section className="closing-section"><div className="container closing-inner"><div><div className="eyebrow">A FLEXIBLE EVERYDAY</div><h2>A healthier, <em>happier everyday.</em></h2><p>More choice. More experiences. More space to be yourself.</p></div><Link className="btn btn-primary closing-btn" to="/services">Find your next experience <span aria-hidden="true">↗</span></Link></div></section>
  {pagesPreview&&<div className="container preview-disclaimer">This public website is a design preview. All sample partners and experiences are fictional; no booking or payment functions are available.</div>}
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
    {(['employee','partner','admin','hr'] as Role[]).map(role=><button key={role} className="demo-account" style={{width:'100%'}} type="button" onClick={()=>{setEmail(`${role}@flexpass.demo`);setPassword('Demo123!')}}><span>{role==='employee'?'🏃':role==='partner'?'🏬':role==='hr'?'▤':'⚙️'} &nbsp; <b>{role[0].toUpperCase()+role.slice(1)}</b><small style={{display:'block',marginLeft:26}}>{role}@flexpass.demo</small></span><span>Use demo →</span></button>)}
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
    <Route path="/employee" element={<Authenticated role="employee"/>}/><Route path="/partner" element={<Authenticated role="partner"/>}/><Route path="/admin" element={<Authenticated role="admin"/>}/><Route path="/hr" element={<Authenticated role="hr"/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
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
