import {useCallback,useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import type {Role,Section,Booking,LedgerRow,EmployeeSummary,PartnerSummary,PartnerService,AdminSummary,Company,AdminPartner,CreditProduct,ClientOrder,ClientRecord,Employee,Plan,Invoice,Settlement,AuditRow,Service,Group,FormDialog,User} from './types';
import {dateTime,icons,labels,money,month,post,request} from './api';
import {Heading,Panel,Stat,StatusTag,useApp} from './App';
import {BookingDialog} from './ServicesPage';
import {ActionDialog} from './Forms';
import {PartnerCalendar} from './PartnerCalendar';
import {ClientExplore} from './ClientExplore';
import {ClientOverview} from './ClientOverview';
import {CreditShop} from './CreditShop';
import {ProfileMenu} from './ProfileMenu';
import {UIIcon} from './UIIcon';
import {BrandLogo} from './BrandLogo';
import type {IconName} from './UIIcon';

interface AllData {
  employeeSummary?:EmployeeSummary;
  partnerSummary?:PartnerSummary;
  adminSummary?:AdminSummary;
  bookings:Booking[];
  ledger:LedgerRow[];
  partnerServices:PartnerService[];
  companies:Company[];
  partners:AdminPartner[];
  employees:Employee[];
  plans:Plan[];
  invoices:Invoice[];
  settlements:Settlement[];
  audit:AuditRow[];
  catalog:Service[];
  featuredCatalog:Service[];
  clients:ClientRecord[];
  products:CreditProduct[];
  orders:ClientOrder[];
}
const emptyData:AllData={bookings:[],ledger:[],partnerServices:[],companies:[],partners:[],employees:[],plans:[],invoices:[],settlements:[],audit:[],catalog:[],featuredCatalog:[],products:[],orders:[],clients:[]};
const menu:Record<Role,Array<[Section,string,IconName]>>={
  client:[['overview','Overview','overview'],['shop','Credit shop','credit'],['discover','Explore experiences','compass'],['orders','My orders','receipt'],['bookings','My bookings','calendar'],['wallet','My wallet','wallet']],
  partner:[['overview','Overview','overview'],['calendar','Booking calendar','calendar'],['reservations','Reservations','list'],['services','My services','layers'],['settlements','Settlements','wallet']],
  admin:[['overview','Overview','overview'],['clients','Clients','users'],['partners','Business partners','store'],['products','Credit products','credit'],['orders','Client orders','receipt'],['settlements','Partner settlements','wallet'],['audit','Audit log','shield']],
};
function Table({columns,rows}:{columns:string[];rows:ReactNode[][]}){return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(col=><th key={col}>{col}</th>)}</tr></thead><tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((cell,k)=><td key={k} data-label={columns[k]}>{cell}</td>)}</tr>):<tr><td colSpan={columns.length} className="muted">No records yet.</td></tr>}</tbody></table></div>}
function BookingTable({bookings,role,action}:{bookings:Booking[];role:'employee'|'partner';action:(book:Booking)=>void}){
  return <Table columns={['Experience','Date / venue','Credits','Status','Action']} rows={bookings.map(b=>[
    <><b>{b.service}</b><br/><small>{b.reference}</small></>,<><b>{dateTime(b.start_at)}</b><br/><small>{b.partner}</small></>,`${b.credits} credits`,<StatusTag status={b.status}/>,b.status==='BOOKED'?<button className={`btn ${role==='employee'?'btn-outline':'btn-primary'} btn-sm`} onClick={()=>action(b)}>{role==='employee'?'Cancel':'Confirm arrival'}</button>:'—',
  ])}/>;
}
function SummaryCards({items}:{items:Array<[string,string,string|number,string?]>}){return <div className="stats">{items.map(([icon,label,value,small])=><Stat key={label} icon={icon} label={label} value={value} small={small}/>)}</div>}
const ERROR_MESSAGE='Could not load this dashboard. Check the API server and sign in again.';
export function Dashboard({role}:{role:Role}){const {user,token,signOut,notify,info}=useApp();const navigate=useNavigate();const [section,setSection]=useState<Section>('overview');const [data,setData]=useState<AllData>(emptyData);const [category,setCategory]=useState<Group>('fitness');const [selectedService,setSelectedService]=useState<Service|null>(null);const [form,setForm]=useState<FormDialog|null>(null);const [revision,setRevision]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [showDemoSetup,setShowDemoSetup]=useState(false);const [clientDemoPassword,setClientDemoPassword]=useState('');const [businessDemoPassword,setBusinessDemoPassword]=useState('');const [demoSetupBusy,setDemoSetupBusy]=useState(false);const [isNarrowScreen,setIsNarrowScreen]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:760px)').matches);const [sidebarOpen,setSidebarOpen]=useState(()=>typeof window==='undefined'||!window.matchMedia('(max-width:760px)').matches);const refresh=useCallback(()=>setRevision(x=>x+1),[]);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:760px)');
    const onChange=()=>{setIsNarrowScreen(media.matches);setSidebarOpen(!media.matches)};
    media.addEventListener('change',onChange);
    return()=>media.removeEventListener('change',onChange);
  },[]);
  useEffect(()=>{
    if(!sidebarOpen)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')setSidebarOpen(false)};
    document.addEventListener('keydown',onKey);
    return()=>document.removeEventListener('keydown',onKey);
  },[sidebarOpen]);
  useEffect(()=>{
    if(!isNarrowScreen||!sidebarOpen)return;
    const before=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return()=>{document.body.style.overflow=before};
  },[isNarrowScreen,sidebarOpen]);
  function changeSection(next:Section){setSection(next);if(isNarrowScreen)setSidebarOpen(false)}
  useEffect(()=>{let valid=true;setLoading(true);setError('');
    const get=<T,>(path:string)=>request<T>(path,token);
    async function load(){
      if(role==='client'){
        const [summary,bookings,ledger,catalog,products,orders,featuredCatalog]=await Promise.all([get<EmployeeSummary>('/client/summary'),get<Booking[]>('/client/bookings'),get<LedgerRow[]>('/client/ledger'),get<Service[]>(`/catalog?group=${category}`),get<CreditProduct[]>('/client/products'),get<ClientOrder[]>('/client/orders'),get<Service[]>('/catalog')]);
        if(valid)setData({...emptyData,employeeSummary:summary,bookings,ledger,catalog,products,orders,featuredCatalog});
      }else if(role==='partner'){
        const [summary,bookings,services,settlements]=await Promise.all([get<PartnerSummary>('/partner/summary'),get<Booking[]>('/partner/bookings'),get<PartnerService[]>('/partner/services'),get<Settlement[]>('/settlements')]);
        if(valid)setData({...emptyData,partnerSummary:summary,bookings,partnerServices:services,settlements});
      }else{
        const [summary,companies,partners,employees,plans,invoices,settlements,audit,products,orders,clients]=await Promise.all([get<AdminSummary>('/admin/summary'),get<Company[]>('/admin/companies'),get<AdminPartner[]>('/admin/partners'),get<Employee[]>('/admin/employees'),get<Plan[]>('/admin/plans'),get<Invoice[]>('/admin/invoices'),get<Settlement[]>('/settlements'),get<AuditRow[]>('/admin/audit'),get<CreditProduct[]>('/admin/client-products'),get<ClientOrder[]>('/admin/client-orders'),get<ClientRecord[]>('/admin/clients')]);
        if(valid)setData({...emptyData,adminSummary:summary,companies,partners,employees,plans,invoices,settlements,audit,products,orders,clients});
      }
    }
    load().catch((e:Error)=>{if(valid)setError(e.message)}).finally(()=>{if(valid)setLoading(false)});
    return()=>{valid=false};
  },[role,token,revision,category]);
  async function mutate(path:string,body:Record<string,unknown>={}){try{await post(path,token,body);notify('Change saved successfully.');refresh();}catch(err){notify((err as Error).message,true)}}
  function cancelBooking(b:Booking){if(!window.confirm(`Cancel ${b.reference} and return its ${b.credits} credits?`))return;void mutate(`/bookings/${b.id}/cancel`)}
  async function requestPurchase(product:CreditProduct){if(!window.confirm(`Request ${product.credits} credits for ${money(product.price_cents)}? No payment will be charged. Admin must verify payment before credits become available.`))return;try{await post('/client/orders',token,{product_id:product.id,request_key:crypto.randomUUID()});notify('Order requested. No payment has been collected.');setSection('orders');refresh();}catch(err){notify((err as Error).message,true)}}
  async function demoBankTransfer(order:ClientOrder){if(!window.confirm('SIMULATED BANK PAYMENT: No money will be transferred. Confirm this demo transaction and issue fictional credits?'))return;try{await post(`/client/orders/${order.id}/demo-bank-transfer`,token,{});notify('Demo bank transfer completed. No real money was moved.');refresh();}catch(err){notify((err as Error).message,true)}}
  async function resendInvitation(id:number){if(!window.confirm('Send a one-time activation link to this invited business account?'))return;try{await post(`/admin/invitations/${id}/resend`,token,{});notify('Activation invitation sent.');refresh();}catch(err){notify((err as Error).message,true)}}
  async function setupDemoAccounts(){if(clientDemoPassword.length<20||businessDemoPassword.length<20||clientDemoPassword===businessDemoPassword){notify('Use two different passwords of at least 20 characters.',true);return}setDemoSetupBusy(true);try{const result=await post<{created_client:number;activated_business:number;client_existing:number;business_existing:number}>('/admin/demo/accounts/setup',token,{client_password:clientDemoPassword,business_password:businessDemoPassword});notify(`Demo setup: ${result.created_client} client created, ${result.activated_business} business activated. Existing accounts were not reset.`);setClientDemoPassword('');setBusinessDemoPassword('');setShowDemoSetup(false);refresh()}catch(err){notify((err as Error).message,true)}finally{setDemoSetupBusy(false)}}
  async function confirmPurchase(order:ClientOrder){const reference=window.prompt(`Verify receipt of payment before confirming order #${order.id}. Enter its real payment reference:`);if(!reference)return;await mutate(`/admin/client-orders/${order.id}/confirm`,{payment_reference:reference});}
  function checkIn(b:Booking){if(!window.confirm(`Confirm arrival for ${b.user} (${b.reference})? This action cannot be repeated.`))return;void mutate(`/partner/bookings/${b.id}/checkin`)}
  const active=menu[role].find(row=>row[0]===section)||menu[role][0];
  if(!user)return null;
  return <div className={`app-shell dashboard-app-shell ${sidebarOpen?'sidebar-expanded':'sidebar-collapsed'}`}>
    {isNarrowScreen&&sidebarOpen&&<button type="button" className="dashboard-sidebar-backdrop" aria-label="Close navigation menu" onClick={()=>setSidebarOpen(false)}/>}
    {sidebarOpen&&<aside id="dashboard-sidebar" className={`sidebar dashboard-sidebar ${role==='client'?'dashboard-client-sidebar':''}`} aria-label={`${role} navigation`}>
      <div className="dashboard-sidebar-heading">
        <Link className="logo dashboard-brand-link" to="/" aria-label="FlexPass home"><BrandLogo variant="full" tone="ivory" decorative/></Link>
        <button type="button" className="dashboard-sidebar-close" onClick={()=>setSidebarOpen(false)} aria-label="Collapse sidebar" title="Collapse sidebar"><UIIcon name="close" size={18}/></button>
      </div>
      <div className="side-label">{role==='client'?'YOUR MEMBERSHIP':role[0].toUpperCase()+role.slice(1)+' workspace'}</div>
      <nav className="side-nav" aria-label={`${role} workspace`}>
        {menu[role].map(([name,label,icon])=><button key={name} className={`side-link ${name===section?'active':''}`} aria-current={name===section?'page':undefined} onClick={()=>changeSection(name)}><span className="side-ico"><UIIcon name={icon} size={19}/></span><span className="side-text">{label}</span></button>)}
      </nav>
      {role==='client'&&<div className="sidebar-client-quote"><span>MORE EXPERIENCES.<br/>MORE YOU.</span><p>Your everyday,<br/>beautifully reimagined.</p></div>}
      <div className="sidebar-bottom">
        <ProfileMenu user={user} onSignOut={()=>{signOut();navigate('/')}}/>
      </div>
    </aside>}
    <div className="dash-main dashboard-main"><header className={`dash-topbar dashboard-topbar ${role==='client'&&section==='discover'?'dashboard-topbar-client-explore':''}`}>
      <div className="dashboard-topbar-left">
        {!sidebarOpen&&<button type="button" className="dashboard-menu-toggle dashboard-menu-icon-only" aria-label="Show sidebar" aria-expanded={false} onClick={()=>setSidebarOpen(true)} title="Show sidebar">
          <UIIcon name="menu" size={19}/>
        </button>}
        <div className="dashboard-page-identity">
          {role==='client'&&section==='discover'
            ?<><small>FLEXPASS <span className="dashboard-identity-divider" aria-hidden="true">/</span> CLIENT COLLECTION</small><b>Explore experiences</b></>
            :<><small>FlexPass / {role}</small><b>{active[1]}</b></>}
        </div>
      </div>
      <div className="flex-between"><span className="status">● &nbsp; Pilot environment</span></div>
    </header>
      <main className="dash-content">{loading?<div className="loading">Loading workspace...</div>:error?<div className="notice warn"><b>{ERROR_MESSAGE}</b><p>{error}</p><button className="btn btn-outline btn-sm" onClick={refresh}>Retry</button></div>:<>
        {role==='client'&&data.employeeSummary&&<EmployeeView user={user} section={section} data={data} onSection={setSection} onBooking={cancelBooking} onService={setSelectedService} onPurchase={requestPurchase} onDemoTransfer={demoBankTransfer} bank={info?.bank_transfer} category={category} onCategory={setCategory}/>}
        {role==='partner'&&data.partnerSummary&&(section==='calendar'?<PartnerCalendar initialBookings={data.bookings}/>:<PartnerView section={section} data={data} onSection={setSection} onBooking={checkIn} onForm={setForm}/>)}
        {role==='admin'&&showDemoSetup&&<div className="panel" style={{marginBottom:24,maxWidth:680}}><h2>Set up demo test accounts</h2><p>Creates an active Client (<b>demo.client@flexpass.test</b>) and activates the invited demo business (<b>akaci@ccs.al</b>). Assigns 25 fictional credits to the Client. Existing accounts and passwords are never reset.</p><div className="notice">Use different passwords of at least 20 characters. The passwords are submitted securely to the authenticated API, not stored in browser code. Save them privately: they are not shown again.</div><form className="stack" onSubmit={e=>{e.preventDefault();void setupDemoAccounts()}}><label className="form-field">Temporary Client password<input className="input" type="password" autoComplete="new-password" minLength={20} value={clientDemoPassword} onChange={e=>setClientDemoPassword(e.target.value)} required/></label><label className="form-field">Temporary Business password<input className="input" type="password" autoComplete="new-password" minLength={20} value={businessDemoPassword} onChange={e=>setBusinessDemoPassword(e.target.value)} required/></label><div className="flex-between"><button className="btn btn-primary" type="submit" disabled={demoSetupBusy}>{demoSetupBusy?'Setting up…':'Create / activate demo accounts'}</button><button className="btn btn-outline" type="button" onClick={()=>{setShowDemoSetup(false);setClientDemoPassword('');setBusinessDemoPassword('')}}>Cancel</button></div></form></div>}
        {role==='admin'&&data.adminSummary&&<AdminView section={section} data={data} onSection={setSection} onForm={setForm} onGenerate={()=>{void mutate(`/admin/settlements/generate?period=${month()}`)}} onConfirmOrder={confirmPurchase} onResendInvitation={resendInvitation} onOpenDemoSetup={()=>setShowDemoSetup(v=>!v)}/>}
      </>}</main></div>
    {selectedService&&<BookingDialog service={selectedService} onClose={()=>setSelectedService(null)} onBooked={()=>{setSection('bookings');refresh()}}/>}
    {form&&<ActionDialog dialog={form} data={data} onClose={()=>setForm(null)} onSuccess={()=>{setForm(null);notify('Change saved.');refresh()}}/>}
  </div>;
}
function EmployeeView({user,section,data,onSection,onBooking,onService,onPurchase,onDemoTransfer,bank,category,onCategory}:{user:User;section:Section;data:AllData;onSection:(v:Section)=>void;onBooking:(b:Booking)=>void;onService:(s:Service)=>void;onPurchase:(p:CreditProduct)=>void;onDemoTransfer:(o:ClientOrder)=>void;bank?:{demo_enabled:boolean;configured:boolean;bank_name:string;beneficiary:string;iban:string};category:Group;onCategory:(v:Group)=>void}){const s=data.employeeSummary!;
  if(section==='overview')return <ClientOverview user={user} summary={s} bookings={data.bookings} services={data.featuredCatalog} onSection={onSection} onService={onService}/>;
  if(section==='wallet')return <><Heading title="My wallet" subtitle="A history of credits, purchases and refunds."/><SummaryCards items={[["✦","Available credits",s.balance,"Updated after confirmed purchases and bookings"]]}/><Panel title="Credit transactions"><Table columns={['Date','Type','Credits','Details']} rows={data.ledger.map(l=>[dateTime(l.created_at),<StatusTag status={l.kind}/>,<b className={l.amount>=0?'positive':'negative'}>{l.amount>0?'+':''}{l.amount}</b>,l.reason])}/></Panel></>;
  if(section==='shop')return <CreditShop products={data.products} balance={s.balance} bank={bank} onPurchase={onPurchase}/>;
  if(section==='orders')return <><Heading title="My purchases" subtitle="Review bank-transfer instructions and payment status."/><div className="notice notice-gap">{bank?.demo_enabled?'DEMO BANK ONLY — no real banking information, transfers or funds. Simulated credits are for testing.':bank?.configured?'Bank transfer instructions are provided for review. Sending money does not automatically credit your wallet.':'Bank transfer instructions are not configured. Do not send money. Contact FlexPass.'}</div><Panel title="Order history"><Table columns={['Package','Amount','Transfer instructions','Status / action']} rows={data.orders.map(o=>[<><b>{o.product}</b><small style={{display:'block'}}>{o.credits} credits</small></>,money(o.amount_cents),<div><b>{bank?.bank_name||'Bank unavailable'}</b><small style={{display:'block'}}>Beneficiary: {bank?.beneficiary||'Not configured'}</small><small style={{display:'block'}}>IBAN: {bank?.iban||'Not configured'}</small><small style={{display:'block'}}>Reference: {o.bank_reference||`FP-ORDER-${String(o.id).padStart(6,'0')}`}</small></div>,<div><StatusTag status={o.status}/>{o.status==='PENDING' && bank?.demo_enabled &&<button className="btn btn-primary btn-sm" onClick={()=>onDemoTransfer(o)} style={{marginTop:12}}>Simulate bank payment →</button>}</div>])}/></Panel><div className="notice notice-gap">DEMO_PAID records a fictional bank payment and demo credits only. PENDING means no confirmed payment. CONFIRMED requires Admin verification of a real external transfer.</div></>;
  if(section==='bookings')return <><Heading title="My bookings" subtitle="Review, attend or cancel reservations."/><Panel title="Booking history"><BookingTable role="employee" bookings={data.bookings} action={onBooking}/></Panel></>;
  if(section==='discover')return <ClientExplore category={category} onCategory={onCategory} catalog={data.catalog} onService={onService} summary={s} onWallet={()=>onSection('wallet')}/>;;
  return null;
}
function PartnerView({section,data,onSection,onBooking,onForm}:{section:Section;data:AllData;onSection:(v:Section)=>void;onBooking:(b:Booking)=>void;onForm:(f:FormDialog)=>void}){const s=data.partnerSummary!;const {token,notify}=useApp();
  async function exportPayouts(){try{const response=await fetch('/api/partner/payouts/export',{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('Payout export failed');const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='flexpass-partner-payouts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(err){notify((err as Error).message,true)}}
  if(section==='overview')return <><Heading title="Partner overview" subtitle={`Welcome to ${s.partner} · ${s.zone}`}/><SummaryCards items={[["◇","Active services",s.services],["▤","Total reservations",s.bookings],["✓","Confirmed visits",s.checkins],["◉","Earned (all time)",money(s.earnings_cents),"Confirmed attendance only"]]}/><div className="dash-grid"><Panel title="Reservations" action={<button className="btn btn-outline btn-sm" onClick={()=>onSection('calendar')}>Open calendar →</button>}><BookingTable bookings={data.bookings.slice(0,6)} role="partner" action={onBooking}/></Panel><div className="stack"><Panel title="Partner guidance"><p>Check the guest name and booking reference, then confirm arrival once.</p><div className="notice">You can only see your partner organization’s bookings. Settlements use confirmed attendance.</div></Panel><div className="callout-gradient"><h2>Manage your sessions</h2><p>Publish services and available class times.</p><button className="btn btn-outline" onClick={()=>onSection('services')}>Manage services →</button></div></div></div></>;
  if(section==='reservations')return <><Heading title="Reservations" subtitle="Check guests in and review attendance."/><Panel title="All partner bookings"><BookingTable bookings={data.bookings} role="partner" action={onBooking}/></Panel></>;
  if(section==='services')return <><Heading title="My services" subtitle="Manage approved offerings and publish class slots." action={<button className="btn btn-primary" onClick={()=>onForm({kind:'service'})}>+ New service</button>}/><div className="notice notice-gap">Active price changes need Admin approval in production. Publishing new services here is for the pilot.</div><Panel title="Your services"><Table columns={['Service','Category','Credits','Slots','Action']} rows={data.partnerServices.map(s=>[<b>{s.name}</b>,labels[s.group],`${s.credits} credits`,`${s.slots.length} slots`,<button className="btn btn-outline btn-sm" onClick={()=>onForm({kind:'slot',id:s.id})}>Add slot +</button>])}/></Panel></>;
  if(section==='settlements')return <><Heading title="Settlement reports" subtitle="Monthly payouts based on confirmed attendance."/><div className="notice notice-gap">Bank transfers are processed outside the app. Admin maintains settlement statuses.</div><Panel title="Settlement history" action={<button className="btn btn-outline btn-sm" onClick={()=>void exportPayouts()}>Export CSV ↗</button>}><Table columns={['Period','Visits','Amount','Status','Invoice ref.']} rows={data.settlements.map(s=>[s.period,s.bookings,money(s.amount_cents),<StatusTag status={s.status}/>,s.invoice_reference||'—'])}/></Panel></>;
  return null;
}
function AdminView({section,data,onSection,onForm,onGenerate,onConfirmOrder,onResendInvitation,onOpenDemoSetup}:{section:Section;data:AllData;onSection:(v:Section)=>void;onForm:(f:FormDialog)=>void;onGenerate:()=>void;onConfirmOrder:(o:ClientOrder)=>void;onResendInvitation:(id:number)=>void;onOpenDemoSetup:()=>void}){const s=data.adminSummary!;
  if(section==='overview')return <>
    <Heading title="Operations at a glance" subtitle="Client purchases, partner reservations and actions that need review." action={<button className="btn btn-outline btn-sm" onClick={()=>onSection('orders')}>Review orders <UIIcon name="arrow" size={16}/></button>}/>
    <SummaryCards items={[["","Clients",s.clients,"Personal and legacy accounts"],["","Partners",s.partners,"Registered business partners"],["","Pending client orders",s.orders_pending,"Review payments before crediting"],["","Bookings",s.bookings,"All reservation statuses"]]}/>
    <div className="dash-grid">
      <Panel title="Latest payment requests">
        <Table columns={['Client','Product','Amount','Status']} rows={data.orders.slice(0,5).map(o=>[o.email||`Client #${o.client_id}`,o.product,money(o.amount_cents),<StatusTag status={o.status}/>])}/>
        <button className="btn btn-tertiary btn-sm" onClick={()=>onSection('orders')}>View all orders <UIIcon name="arrow" size={15}/></button>
      </Panel>
      <div className="stack">
        <Panel title="Operational snapshot">
          <div className="ops-summary-list"><div><span>Published services</span><strong>{s.services}</strong></div><div><span>Completed visits</span><strong>{s.visits}</strong></div><div><span>Partner payables</span><strong>{money(s.partner_payables_cents)}</strong></div></div>
        </Panel>
        <div className="notice"><strong>Payment verification</strong><p>Bank transfers are confirmed outside FlexPass. Record an order as paid only after independent verification of the actual incoming funds.</p></div>
      </div>
    </div>
  </>;
  if(section==='companies')return <><Heading title="Companies" subtitle="Track employer accounts and HR contacts." action={<button className="btn btn-primary" onClick={()=>onForm({kind:'company'})}>+ Add company</button>}/><Panel title="Registered companies"><Table columns={['Company','HR email','Employees','Status']} rows={data.companies.map(c=>[<b>{c.name}</b>,c.hr_email,c.employees,<StatusTag status={c.status}/>])}/></Panel></>;
  if(section==='partners')return <><Heading title="Business partners" subtitle="Register businesses and invite their managers by email." action={<button className="btn btn-primary" onClick={()=>onForm({kind:'partner-invite'})}>+ Register business</button>}/><Panel title="Registered partners"><Table columns={['Business','Location','Contact accounts','Status']} rows={data.partners.map(p=>[<b>{p.name}</b>,p.zone,<div>{p.accounts.length?p.accounts.map(a=><div key={a.id}><small>{a.email} ({a.status})</small>{a.status==='INVITED'&&<button className="btn btn-outline btn-sm" style={{marginLeft:8}} onClick={()=>onResendInvitation(a.id)}>Send activation email</button>}</div>):'No contact'}</div>,<StatusTag status={p.status}/>])}/></Panel></>;
  if(section==='clients')return <><Heading title="Clients" subtitle="Personal accounts and their purchased credits."/><Panel title="Client accounts"><Table columns={['Client','Credits','Orders','Account status']} rows={data.clients.map(c=>[<><b>{c.name}</b><br/><small>{c.email}</small></>,c.balance,c.orders,<StatusTag status={c.status}/>])}/></Panel></>;
  if(section==='products')return <><Heading title="Credit products" subtitle="Offer personal-credit packages to registered clients." action={<button className="btn btn-primary" onClick={()=>onForm({kind:'product-create'})}>+ New credit package</button>}/><Panel title="Available packages"><Table columns={['Name','Credits','Price','Status']} rows={data.products.map(p=>[p.name,p.credits,money(p.price_cents),p.active?'Active':'Inactive'])}/></Panel></>;
  if(section==='orders')return <><Heading title="Client orders" subtitle="Confirm purchases only after verifying external payment."/><div className="notice notice-gap">No payment gateway is connected. Check bank records or another independently verified payment source before confirming any order. Confirmation allocates credits and cannot be repeated.</div><Panel title="Purchase requests"><Table columns={['Client','Product','Credits','Amount','Status','Action']} rows={data.orders.map(o=>[o.email||o.client_id,o.product,o.credits,money(o.amount_cents),<StatusTag status={o.status}/>,o.status==='PENDING'?<button className="btn btn-outline btn-sm" onClick={()=>onConfirmOrder(o)}>Confirm verified payment</button>:o.payment_reference||'—'])}/></Panel></>;
  if(section==='employees')return <><Heading title="Employees" subtitle="Invite and administer employer-funded members." action={<button className="btn btn-primary" onClick={()=>onForm({kind:'employee'})}>+ Invite employee</button>}/><div className="notice notice-gap">Invited employees activate their own accounts through a 24-hour email link. Email delivery must be configured for hosted deployment.</div><Panel title="Employees"><Table columns={['Name','Company','Plan','Wallet','Status','Action']} rows={data.employees.map(e=>[<><b>{e.full_name}</b><br/><small>{e.email}</small></>,e.company,e.plan,`${e.balance} credits`,<StatusTag status={e.status}/>,<button className="btn btn-outline btn-sm" onClick={()=>onForm({kind:'adjust',id:e.id})}>Adjust credits</button>])}/></Panel></>;
  if(section==='plans')return <><Heading title="Credit plans" subtitle="Configure up to three approved employer packages." action={data.plans.length<3?<button className="btn btn-primary" onClick={()=>onForm({kind:'plan-create'})}>+ Add plan</button>:undefined}/><div className="stats three-cols">{data.plans.map((p,i)=><Stat key={p.id} icon={['✧','✦','◈'][i]||'✦'} label={p.name} value={`${p.credits} credits`} small="Monthly allowance · price unapproved"/>)}</div><div className="notice">Plan prices, rollover, expiration and change dates require FlexPass approval.</div></>;
  if(section==='invoices')return <><Heading title="Company invoices" subtitle="Track invoice references and manual payment confirmation." action={<button className="btn btn-primary" onClick={()=>onForm({kind:'invoice'})}>+ New invoice</button>}/><Panel title="Invoice register"><Table columns={['Reference','Company','Period','Amount','Status','Action']} rows={data.invoices.map(i=>[<b>{i.reference}</b>,i.company,i.period,money(i.amount_cents),<StatusTag status={i.status}/>,<button className="btn btn-outline btn-sm" onClick={()=>onForm({kind:'invoice-status',id:i.id})}>Update status</button>])}/></Panel></>;
  if(section==='settlements')return <><Heading title="Partner settlements" subtitle="Create and review monthly partner payout reports." action={<button className="btn btn-primary" onClick={onGenerate}>Generate {month()} ↗</button>}/><div className="notice notice-gap">Settlement amounts use the original booking payout snapshot and confirmed attendance; payments occur outside the app.</div><Panel title="Settlement register"><Table columns={['Partner','Period','Visits','Payable','Status','Action']} rows={data.settlements.map(st=>[<b>{st.partner}</b>,st.period,st.bookings,money(st.amount_cents),<StatusTag status={st.status}/>,<button className="btn btn-outline btn-sm" onClick={()=>onForm({kind:'settlement-status',id:st.id})}>Update status</button>])}/></Panel></>;
  if(section==='audit')return <><Heading title="Audit log" subtitle="Trace administrative changes and bookings."/><Panel title="Recent events"><Table columns={['Timestamp','Actor ID','Action','Details']} rows={data.audit.map(a=>[dateTime(a.at),a.actor_id||'System',<b>{a.action}</b>,a.detail])}/></Panel></>;
  return null;
}
