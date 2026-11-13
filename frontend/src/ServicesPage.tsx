import {useEffect,useRef,useState} from 'react';
import {Link,useNavigate,useSearchParams} from 'react-router-dom';
import type {Booking,EmployeeSummary,Group,Service} from './types';
import {labels,pagesPreview,request,post,shortDate} from './api';
import {Modal,useApp} from './App';
import {BrandIcon} from './BrandIcon';
import {UIIcon} from './UIIcon';

const fmtTime=(value:string)=>new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});

export function ServiceCard({service,onSelect}:{service:Service;onSelect:(value:Service)=>void}){
  const available=service.slots.filter(s=>s.available>0).length;
  return <article className="service-card editorial-service-card">
    <div className={`service-visual g-${service.group}`}>
      <div className="service-artwork" aria-hidden="true"><BrandIcon group={service.group}/><span>{labels[service.group]}</span></div>
      <span className="credit-tag">{service.credits} credits / visit</span>
    </div>
    <div className="service-body">
      <div className="service-overline">{service.subcategory} <span aria-hidden="true">·</span> {service.zone}</div>
      <h3>{service.name}</h3>
      <p>{service.description}</p>
      <div className="service-meta">
        <span><UIIcon name="store" size={15}/>{service.partner}</span>
        <span><UIIcon name="clock" size={15}/>{service.duration_minutes} min</span>
      </div>
      <div className="service-bottom">
        <div className="service-availability"><span className={available>0?'availability-dot':'availability-dot unavailable'}/>{pagesPreview?'Illustrative listing':available>0?`${available} upcoming times`:'No open sessions'}</div>
        <button type="button" className="btn btn-primary btn-sm" onClick={()=>onSelect(service)}>{pagesPreview?'Details':'View times'} <UIIcon name="arrow" size={15}/></button>
      </div>
    </div>
  </article>;
}

type HeldPlace={id:number;slot_id:number;expires_at:string;offered_from_waitlist:boolean};
type WaitingPlace={id:number;slot_id:number;status:'WAITING'|'OFFERED';start_at:string;joined_at:string;offer_expires_at:string|null;hold_id:number|null};
type CancelPolicy={full_refund_before_hours:number;partial_refund_before_hours:number;partial_refund_percent:number;hold_minutes:number;waitlist_offer_minutes:number;minimum_notice_hours:number};

export function BookingDialog({service,onClose,onBooked}:{service:Service;onClose:()=>void;onBooked?:()=>void}){
  const {user,token,notify}=useApp();
  const navigate=useNavigate();
  const [slot,setSlot]=useState<number|null>(null);
  const bookingKey=useRef<string|null>(null);
  const heldRef=useRef<HeldPlace|null>(null);
  const [held,setHeld]=useState<HeldPlace|null>(null);
  const [waitlist,setWaitlist]=useState<WaitingPlace[]>([]);
  const [policy,setPolicy]=useState<CancelPolicy|null>(null);
  const [busy,setBusy]=useState(false);
  const [balance,setBalance]=useState<number|null>(null);
  const [balanceError,setBalanceError]=useState(false);
  const [confirmed,setConfirmed]=useState<Booking|null>(null);
  const [revision,setRevision]=useState(0);
  const selected=service.slots.find(s=>s.id===slot);
  const queued=waitlist.find(entry=>entry.slot_id===slot);
  const offered=queued?.status==='OFFERED'&&queued.hold_id&&queued.offer_expires_at
    &&new Date(queued.offer_expires_at).getTime()>Date.now()
      ?{id:queued.hold_id,slot_id:queued.slot_id,expires_at:queued.offer_expires_at,offered_from_waitlist:true}
      :null;
  const activeHold=held?.slot_id===slot&&new Date(held.expires_at).getTime()>Date.now()
    ?held:offered;
  const canSpend=balance===null||balance>=service.credits;

  useEffect(()=>{
    let active=true;
    if(user?.role==='client'&&!pagesPreview){
      request<EmployeeSummary>('/client/summary',token).then(data=>{
        if(active)setBalance(data.balance);
      }).catch(()=>{if(active)setBalanceError(true)});
      request<WaitingPlace[]>('/client/waitlist',token).then(rows=>{
        if(active)setWaitlist(rows);
      }).catch(()=>{if(active)notify('Could not load your current waitlist.',true)});
      request<CancelPolicy>('/booking-policy',token).then(result=>{
        if(active)setPolicy(result);
      }).catch(()=>{});
    }
    return()=>{active=false};
  },[token,user?.role,revision]);

  // Release ordinary holds if the modal is abandoned. An accepted booking
  // clears heldRef before unmounting and can never be released by cleanup.
  useEffect(()=>()=>{const current=heldRef.current;
    if(current&&!pagesPreview)void request('/client/holds/'+current.id,token,{method:'DELETE'}).catch(()=>{});
  },[token]);

  function chooseTime(id:number){
    const previous=heldRef.current;
    if(previous&&previous.slot_id!==id){
      heldRef.current=null;setHeld(null);
      void request('/client/holds/'+previous.id,token,{method:'DELETE'}).catch(()=>{});
    }
    setSlot(id);
    bookingKey.current=null;
  }

  async function holdPlace(){
    if(!slot||!canSpend||busy)return;
    setBusy(true);
    try{
      const result=await post<HeldPlace>('/slots/'+slot+'/hold',token,{});
      heldRef.current=result;
      setHeld(result);
      notify('Your spot is held briefly. Confirm the reservation to use your credits.');
      setRevision(value=>value+1);
    }catch(e){notify((e as Error).message,true)}finally{setBusy(false)}
  }
  async function joinQueue(){
    if(!slot||busy)return;
    setBusy(true);
    try{
      const result=await post<WaitingPlace>('/slots/'+slot+'/waitlist',token,{});
      setWaitlist(items=>[...items.filter(x=>x.slot_id!==slot),result]);
      notify('Joined the waitlist. You will receive a notification if a spot opens.');
    }catch(e){notify((e as Error).message,true)}finally{setBusy(false)}
  }
  async function leaveQueue(){
    if(!queued||busy)return;
    setBusy(true);
    try{
      await request('/client/waitlist/'+queued.id,token,{method:'DELETE'});
      const existing=heldRef.current;
      if(existing?.slot_id===slot){heldRef.current=null;setHeld(null)}
      setWaitlist(items=>items.filter(x=>x.id!==queued.id));
      notify('You have left the waitlist.');
    }catch(e){notify((e as Error).message,true)}finally{setBusy(false)}
  }
  async function book(){
    if(!user){notify('Sign in as a client to reserve a session.');onClose();navigate('/login/client');return}
    if(user.role!=='client'){notify('Only client accounts can book services.',true);return}
    if(!slot||!selected||!activeHold||!canSpend||busy)return;
    setBusy(true);
    try{
      bookingKey.current ||= crypto.randomUUID();
      const result=await post<Booking>('/bookings',token,
        {slot_id:slot,hold_id:activeHold.id},{'Idempotency-Key':bookingKey.current});
      heldRef.current=null;
      setHeld(null);
      setConfirmed(result);
      notify('Reservation confirmed. Credits have been deducted from your wallet.');
    }catch(e){notify((e as Error).message,true);setRevision(value=>value+1)}
    finally{setBusy(false)}
  }
  function finish(){
    onClose();
    if(onBooked)onBooked();
    else navigate('/client');
  }
  return <Modal title={confirmed?'Reservation confirmed':service.name} subtitle={service.partner+' · '+service.zone} onClose={confirmed?finish:onClose}>
    {confirmed?<div className="booking-confirmed" role="status">
      <div className="booking-confirmed-icon"><UIIcon name="check" size={30}/></div>
      <h3>Your time is reserved.</h3><p>{confirmed.service} at {confirmed.partner}</p>
      <div className="booking-confirmed-summary"><strong>{shortDate(confirmed.start_at)} · {fmtTime(confirmed.start_at)}</strong><span>Booking reference: {confirmed.reference}</span><span>{confirmed.credits} credits used</span></div>
      <button type="button" className="btn btn-primary full-width" onClick={finish}>View my bookings <UIIcon name="arrow" size={17}/></button>
    </div>:<>
      <div className="booking-service-summary">
        <div className="booking-service-icon"><BrandIcon group={service.group}/></div>
        <div><span className="service-overline">{service.subcategory}</span><h3>{service.name}</h3><p>{service.duration_minutes} minutes · {service.zone}</p></div>
      </div>
      <p className="booking-service-description">{service.description}</p>
      <div className="booking-balance-strip">
        <span><UIIcon name="credit" size={17}/> Cost: <strong>{service.credits} credits</strong></span>
        <span><UIIcon name="wallet" size={17}/> Wallet: <strong>{balance!==null?balance+' credits':balanceError?'Unavailable':'Checking…'}</strong></span>
      </div>
      {pagesPreview?<div className="notice" role="note">Booking requires the live FlexPass application.</div>:<>
        <h3 className="booking-times-title">Choose a session</h3>
        <div className="slot-grid booking-slot-grid" role="group" aria-label="Session times">
          {service.slots.length===0?<div className="notice">No upcoming sessions at this time.</div>:
          service.slots.map(time=>{
            const entry=waitlist.find(x=>x.slot_id===time.id);
            const hasOffer=entry?.status==='OFFERED'&&entry.hold_id!==null;
            return <button key={time.id} type="button" aria-pressed={slot===time.id}
              className={'slot-button '+(slot===time.id?'selected':'')}
              onClick={()=>chooseTime(time.id)}>
              <b>{shortDate(time.start_at)} · {fmtTime(time.start_at)}</b>
              <small>{hasOffer?'Spot offered to you':entry?.status==='WAITING'?'You are on the waitlist':time.available>0?time.available+' places remaining':'Full · join waitlist'}</small>
            </button>;
          })}
        </div>
        {selected&&<div className="booking-selection">
          <UIIcon name="calendar" size={18}/>
          <div><b>{shortDate(selected.start_at)} at {fmtTime(selected.start_at)}</b>
            <small>{activeHold?'Your spot is held until '+fmtTime(activeHold.expires_at):
              queued?.status==='WAITING'?'We will notify you when a place is offered.':
              selected.available>0?'Hold this place before confirming. Credits are charged only on confirmation.':
              'This session is full. Join the waitlist to be notified.'}</small>
          </div>
        </div>}
        {balance!==null&&balance<service.credits&&<div className="notice warn" role="alert">Your wallet needs {service.credits-balance} more credits before reserving this experience.</div>}
        {slot&&queued?.status==='WAITING'
          ?<button type="button" className="btn btn-outline full-width" disabled={busy} onClick={leaveQueue}>{busy?'Updating…':'Leave waitlist'}</button>
          :slot&&activeHold
          ?<button type="button" className="btn btn-primary full-width" disabled={busy||!canSpend} onClick={book}>{busy?'Confirming…':'Confirm reservation'} <UIIcon name="arrow" size={17}/></button>
          :slot&&selected?.available===0
          ?<button type="button" className="btn btn-primary full-width" disabled={busy||!canSpend} onClick={joinQueue}>{busy?'Joining…':'Join waitlist'} <UIIcon name="arrow" size={17}/></button>
          :<button type="button" className="btn btn-primary full-width" disabled={!slot||busy||!canSpend} onClick={holdPlace}>
            {busy?'Holding place…':'Hold place for '+(policy?.hold_minutes||5)+' minutes'} <UIIcon name="arrow" size={17}/>
          </button>}
        <p className="booking-policy-note"><UIIcon name="info" size={16}/>
          {policy?' Cancellations: '+policy.full_refund_before_hours+'h+ before start: full refund; '+policy.partial_refund_before_hours+'–'+policy.full_refund_before_hours+'h: '+policy.partial_refund_percent+'% refund; later cancellations before start: no credit refund.':
            ' Cancellation refunds depend on how far in advance the reservation is cancelled.'}
        </p>
        {slot&&<button type="button" className="btn btn-tertiary btn-sm" onClick={()=>setRevision(v=>v+1)}>Refresh waitlist status</button>}
      </>}
    </>}
  </Modal>;
}

export function ServicesPage(){
  const {info,notify,token}=useApp();
  const [params,setParams]=useSearchParams();
  const group=(params.get('group')||'fitness') as Group;
  const category=Object.prototype.hasOwnProperty.call(labels,group)?group:'fitness';
  const subcategory=params.get('subcategory')||'';
  const [search,setSearch]=useState(params.get('search')||'');
  const [zone,setZone]=useState(params.get('zone')||'');
  const [maxCredits,setMaxCredits]=useState(params.get('maxCredits')||'');
  const [services,setServices]=useState<Service[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [chosen,setChosen]=useState<Service|null>(null);
  const filterKey=params.toString();
  const activeCount=[subcategory,params.get('search'),params.get('zone'),params.get('maxCredits')].filter(Boolean).length;

  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    const p=new URLSearchParams(filterKey);p.set('group',category);
    request<Service[]>(`/catalog?${p.toString()}`,token).then(rows=>{if(active)setServices(rows)})
      .catch((e:Error)=>{if(active)setError(e.message)})
      .finally(()=>{if(active)setLoading(false)});
    return()=>{active=false};
  },[filterKey,category,retry,token]);
  useEffect(()=>{
    setSearch(params.get('search')||'');
    setZone(params.get('zone')||'');
    setMaxCredits(params.get('maxCredits')||'');
  },[filterKey]);
  function apply(patch:Record<string,string>){
    const p=new URLSearchParams(filterKey);
    Object.entries(patch).forEach(([k,v])=>v?p.set(k,v):p.delete(k));
    setParams(p);
  }
  function clear(){
    setSearch('');setZone('');setMaxCredits('');
    setParams({group:category});
  }
  return <main className="container refined-catalog">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><span aria-hidden="true"> / </span><span>Experiences</span><span aria-hidden="true"> / </span>{labels[category]}</nav>
    <section className="market-hero"><div className="eyebrow">THE FLEXPASS COLLECTION</div><h1>Find what <em>moves you.</em></h1><p>More experiences. A more flexible everyday.</p></section>
    <div className="filter-title"><div><h2>{labels[category]} experiences</h2><p>Find experiences that fit your time, location and credit balance.</p></div></div>
    <div className="subcategory-list" aria-label="Filter by experience type">
      <button type="button" aria-pressed={!subcategory} className={`chip ${!subcategory?'active':''}`} onClick={()=>apply({subcategory:''})}>All experiences</button>
      {(info?.subcategories?.[category]||[]).map(name=><button type="button" aria-pressed={subcategory===name} key={name} className={`chip ${subcategory===name?'active':''}`} onClick={()=>apply({subcategory:name})}>{name}</button>)}
    </div>
    <form className="filter-form refined-filter-form" onSubmit={e=>{e.preventDefault();apply({search,zone,maxCredits})}}>
      <label className="filter-field">Search experiences<input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Experience, studio or activity"/></label>
      <label className="filter-field">Location<select className="select" value={zone} onChange={e=>setZone(e.target.value)}><option value="">All neighbourhoods</option>{info?.zones.map(z=><option key={z} value={z}>{z}</option>)}</select></label>
      <label className="filter-field">Credit cost<select className="select" value={maxCredits} onChange={e=>setMaxCredits(e.target.value)}><option value="">Any credit cost</option>{[5,7,10].map(n=><option key={n} value={n}>Up to {n} credits</option>)}</select></label>
      <button type="submit" className="btn btn-primary"><UIIcon name="search" size={16}/> Search</button>
    </form>
    {activeCount>0&&<div className="active-filters" role="status">
      <span>{activeCount} active {activeCount===1?'filter':'filters'}</span>
      {subcategory&&<span className="active-filter-token">{subcategory}</span>}
      {params.get('search')&&<span className="active-filter-token">“{params.get('search')}”</span>}
      {params.get('zone')&&<span className="active-filter-token">{params.get('zone')}</span>}
      {params.get('maxCredits')&&<span className="active-filter-token">Up to {params.get('maxCredits')} credits</span>}
      <button type="button" className="filter-clear" onClick={clear}>Clear filters</button>
    </div>}
    <div className="section-title-row"><div>
      <h2>{loading?'Finding experiences…':error?'Catalog unavailable':`${services.length} ${services.length===1?'experience':'experiences'} found`}</h2>
      <p>{error?error:pagesPreview?'Illustrative listings only — no live booking.':'Explore our available experiences and session times.'}</p>
    </div>{info?.demo_mode&&<span className="notice demo-notice">Demo data · Not verified partner inventory</span>}</div>
    {loading?<div className="catalog-skeleton-grid" role="status" aria-label="Loading experiences">{[0,1,2].map(n=><div className="catalog-skeleton" key={n}><div/><span/><span/><span/></div>)}</div>:
    error?<div className="empty" role="alert"><UIIcon name="info" size={28}/><h2>Experiences are temporarily unavailable</h2><p>We could not load the catalog. Your account and bookings are unchanged.</p><button type="button" className="btn btn-primary" onClick={()=>setRetry(x=>x+1)}>Try again <UIIcon name="refresh" size={16}/></button></div>:
    services.length===0?<div className="empty"><UIIcon name="search" size={28}/><h2>No matching experiences</h2><p>Try a different neighbourhood, activity or credit range.</p><button type="button" className="btn btn-outline" onClick={clear}>Clear all filters</button></div>:
    <div className="services-grid">{services.map(service=><ServiceCard key={service.id} service={service} onSelect={setChosen}/>)}</div>}
    {chosen&&<BookingDialog service={chosen} onClose={()=>setChosen(null)} onBooked={()=>notify('Your reservation is available in My bookings.')}/>}
  </main>;
}
