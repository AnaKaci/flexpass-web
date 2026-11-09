import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Booking} from './types';
import {dateTime,request} from './api';
import {StatusTag,useApp} from './App';
import './partner-calendar.css';

type CalendarView = 'month'|'week'|'day';
type BookingStatus = 'ALL' | Booking['status'];

const WEEKDAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const pad=(n:number)=>String(n).padStart(2,'0');
const localKey=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const startOfDay=(d:Date)=>new Date(d.getFullYear(),d.getMonth(),d.getDate());
const addDays=(d:Date,days:number)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+days);
const startOfWeek=(d:Date)=>addDays(startOfDay(d),-((d.getDay()+6)%7));
const dayLabel=(d:Date)=>d.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const timeLabel=(value:string)=>new Date(value).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
const sameDay=(a:Date,b:Date)=>localKey(a)===localKey(b);

function visibleDates(anchor:Date,view:CalendarView):Date[]{
  if(view==='day')return [startOfDay(anchor)];
  if(view==='week'){
    const first=startOfWeek(anchor);
    return Array.from({length:7},(_,i)=>addDays(first,i));
  }
  const first=startOfWeek(new Date(anchor.getFullYear(),anchor.getMonth(),1));
  const last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
  const end=addDays(startOfWeek(last),6);
  const count=Math.round((end.getTime()-first.getTime())/86400000)+1;
  return Array.from({length:count},(_,i)=>addDays(first,i));
}
function viewTitle(anchor:Date,view:CalendarView):string{
  if(view==='month')return anchor.toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  if(view==='day')return dayLabel(anchor);
  const begin=startOfWeek(anchor),end=addDays(begin,6);
  const start=begin.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  const finish=end.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
  return `${start} – ${finish}`;
}
function moveAnchor(date:Date,view:CalendarView,direction:number):Date{
  if(view==='month')return new Date(date.getFullYear(),date.getMonth()+direction,1);
  if(view==='week')return addDays(date,direction*7);
  return addDays(date,direction);
}
function badgeClass(status:Booking['status']){return 'calendar-event calendar-'+status.toLowerCase().replace('_','-');}

export function PartnerCalendar({initialBookings}:{initialBookings:Booking[]}){
  const {token}=useApp();
  const [bookings,setBookings]=useState<Booking[]>(initialBookings);
  const [view,setView]=useState<CalendarView>(()=>typeof window!=='undefined'&&window.matchMedia('(max-width:700px)').matches?'day':'month');
  const [anchor,setAnchor]=useState<Date>(()=>startOfDay(new Date()));
  const [status,setStatus]=useState<BookingStatus>('ALL');
  const [service,setService]=useState('');
  const [selectedId,setSelectedId]=useState<number|null>(null);
  const [lastUpdated,setLastUpdated]=useState<Date|null>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const pending=useRef(false);
  const alive=useRef(false);

  const update=useCallback(async()=>{
    if(pending.current || !alive.current)return;
    pending.current=true;
    setLoading(true);
    try{
      // The API enforces partner_id from the logged-in session, not a supplied query param.
      const rows=await request<Booking[]>('/partner/bookings',token,{cache:'no-store'});
      if(!alive.current)return;
      setBookings(rows);
      setLastUpdated(new Date());
      setError('');
    }catch(e){
      if(alive.current)setError((e as Error).message||'Could not refresh bookings');
    }finally{
      pending.current=false;
      if(alive.current)setLoading(false);
    }
  },[token]);

  useEffect(()=>{
    alive.current=true;
    void update();
    const timer=window.setInterval(()=>{
      if(document.visibilityState==='visible')void update();
    },15000);
    const onVisible=()=>{if(document.visibilityState==='visible')void update();};
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{
      alive.current=false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange',onVisible);
    };
  },[update]);

  const services=useMemo(()=>Array.from(new Set(bookings.map(b=>b.service))).sort((a,b)=>a.localeCompare(b)),[bookings]);
  const filtered=useMemo(()=>bookings
    .filter(b=>(status==='ALL'||b.status===status)&&(!service||b.service===service))
    .sort((a,b)=>new Date(a.start_at).getTime()-new Date(b.start_at).getTime()||a.id-b.id),[bookings,status,service]);
  const dates=useMemo(()=>visibleDates(anchor,view),[anchor,view]);
  const dayBookings=useMemo(()=>{
    const grouped=new Map<string,Booking[]>();
    for(const booking of filtered){
      const key=localKey(new Date(booking.start_at));
      grouped.set(key,[...(grouped.get(key)||[]),booking]);
    }
    return grouped;
  },[filtered]);
  const selected=bookings.find(b=>b.id===selectedId);
  const visible=dates.flatMap(d=>dayBookings.get(localKey(d))||[]);
  const count=(s:Booking['status'])=>visible.filter(b=>b.status===s).length;
  const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||'local time';
  const today=startOfDay(new Date());

  function selectBooking(booking:Booking){
    setSelectedId(booking.id);
  }
  function openDay(date:Date){
    setAnchor(startOfDay(date));
    setView('day');
    setSelectedId(null);
  }
  function chipsFor(date:Date,limit:number){
    const rows=dayBookings.get(localKey(date))||[];
    return <div className="calendar-events">
      {rows.slice(0,limit).map(b=><button key={b.id} type="button" className={badgeClass(b.status)}
        title={`${timeLabel(b.start_at)} · ${b.service} · ${b.user} · ${b.status}`}
        onClick={()=>selectBooking(b)}>
          <span className="calendar-event-time">{timeLabel(b.start_at)}</span>
          <span className="calendar-event-title">{b.service}</span>
          <span className="calendar-event-guest">{b.user}</span>
        </button>)}
      {rows.length>limit&&<button type="button" className="calendar-more" onClick={()=>openDay(date)}>+ {rows.length-limit} more bookings</button>}
    </div>;
  }

  return <div className="partner-calendar">
    <div className="calendar-summary">
      <span><b>{visible.length}</b> visible bookings</span>
      <span><i className="calendar-dot dot-booked"/> {count('BOOKED')} booked</span>
      <span><i className="calendar-dot dot-checked"/> {count('CHECKED_IN')} checked in</span>
      <span><i className="calendar-dot dot-cancelled"/> {count('CANCELLED')} cancelled</span>
    </div>
    <section className="calendar-panel" aria-label="Business booking calendar">
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <button type="button" className="calendar-arrow" aria-label="Previous period" onClick={()=>setAnchor(a=>moveAnchor(a,view,-1))}>‹</button>
          <button type="button" className="calendar-arrow" aria-label="Next period" onClick={()=>setAnchor(a=>moveAnchor(a,view,1))}>›</button>
          <button type="button" className="calendar-today" onClick={()=>setAnchor(startOfDay(new Date()))}>Today</button>
        </div>
        <h2 className="calendar-title">{viewTitle(anchor,view)}</h2>
        <div className="calendar-view-switch" aria-label="Calendar view">
          {(['month','week','day'] as const).map(v=><button key={v} type="button" aria-pressed={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{v[0].toUpperCase()+v.slice(1)}</button>)}
        </div>
      </div>
      <div className="calendar-filters">
        <label>Status <select aria-label="Filter bookings by status" className="calendar-select" value={status} onChange={e=>setStatus(e.target.value as BookingStatus)}>
          <option value="ALL">All statuses</option>
          <option value="BOOKED">Booked</option>
          <option value="CHECKED_IN">Checked in</option>
          <option value="CANCELLED">Cancelled</option>
        </select></label>
        <label>Service <select aria-label="Filter bookings by service" className="calendar-select" value={service} onChange={e=>setService(e.target.value)}>
          <option value="">All services</option>
          {services.map(name=><option value={name} key={name}>{name}</option>)}
        </select></label>
        <div className="calendar-sync">
          <span role="status">{error?'Sync unavailable':loading?'Refreshing…':lastUpdated?`Updated ${lastUpdated.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Connecting…'}</span>
          <button type="button" onClick={()=>void update()} disabled={loading} className="calendar-refresh">Refresh ↻</button>
        </div>
      </div>
      {error&&<p role="alert" className="calendar-error">Couldn't refresh reservations: {error}. Showing the last available data.</p>}
      {view==='day'?<div className="calendar-day-list">
        <div className="calendar-day-heading"><strong>{dayLabel(anchor)}</strong><span>{visible.length} booking{visible.length===1?'':'s'}</span></div>
        {visible.length===0?<p className="calendar-empty">No matching reservations for this day.</p>:
        visible.map(b=><button type="button" className={badgeClass(b.status)+' calendar-list-event'} key={b.id} onClick={()=>selectBooking(b)}>
          <span className="calendar-list-time">{timeLabel(b.start_at)}</span>
          <span className="calendar-list-main"><strong>{b.service}</strong><small>{b.user} · {b.reference}</small></span>
          <StatusTag status={b.status}/>
        </button>)}
      </div>:<div className={`calendar-grid calendar-grid-${view}`}>
        {WEEKDAYS.map(d=><div key={d} className="calendar-weekday">{d}</div>)}
        {dates.map(date=><div key={localKey(date)} className={`calendar-cell ${sameDay(date,today)?'is-today':''} ${view==='month'&&date.getMonth()!==anchor.getMonth()?'is-outside':''}`}>
          <button type="button" className="calendar-date" aria-label={`Open ${dayLabel(date)}`} onClick={()=>openDay(date)}>
            <span>{view==='week'?date.toLocaleDateString('en-GB',{day:'numeric',month:'short'}):date.getDate()}</span>
            <small>{(dayBookings.get(localKey(date))||[]).length||''}</small>
          </button>
          {chipsFor(date,view==='month'?3:20)}
        </div>)}
      </div>}
      <footer className="calendar-footer">
        <span>Times shown in {timezone}. All views include bookings, check-ins and cancellations unless filtered.</span>
        <span>Automatically checks for changes every 15 seconds while this tab is visible.</span>
      </footer>
    </section>
    {selected&&<section className="calendar-details" aria-label="Selected reservation">
      <div className="calendar-details-heading"><div><span className="calendar-detail-label">RESERVATION DETAILS</span><h3>{selected.service}</h3></div><button type="button" className="calendar-close" onClick={()=>setSelectedId(null)} aria-label="Close booking details">×</button></div>
      <div className="calendar-details-grid">
        <div><span>Client</span><strong>{selected.user}</strong><small>{selected.email}</small></div>
        <div><span>When</span><strong>{dateTime(selected.start_at)}</strong><small>{timezone}</small></div>
        <div><span>Booking reference</span><strong>{selected.reference}</strong><small>{selected.credits} credits</small></div>
        <div><span>Status</span><StatusTag status={selected.status}/></div>
      </div>
      <p className="calendar-details-note">To confirm attendance, open Reservations from the Business sidebar. Booking changes appear here on the next refresh.</p>
    </section>}
  </div>;
}
