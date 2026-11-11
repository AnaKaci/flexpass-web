import type {Booking,EmployeeSummary,Service,User,Section} from './types';
import {dateTime,labels} from './api';
import {UIIcon} from './UIIcon';
import {upcomingClientBookings,completedClientVisits} from './clientBookingTimeline';

interface Props {
  user:User;
  summary:EmployeeSummary;
  bookings:Booking[];
  services:Service[];
  onSection:(section:Section)=>void;
  onService:(service:Service)=>void;
}

/** Client-only editorial overview inspired by the supplied Figma membership screen.
 * All account balances, bookings and experiences come from the authenticated API.
 */
export function ClientOverview({user,summary,bookings,services,onSection,onService}:Props){
  const now=new Date();
  const hour=now.getHours();
  const greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  const firstName=user.full_name.trim().split(/\s+/)[0]||'there';
  const today=now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  const upcoming=upcomingClientBookings(bookings,now);
  const completedVisits=completedClientVisits(bookings,now);
  const next=upcoming[0];
  const picks=services.filter(item=>item.slots.some(slot=>slot.available>0)).slice(0,3);
  return <div className="member-overview">
    <header className="member-welcome">
      <div>
        <span className="member-kicker">{today}</span>
        <h1>{greeting}, <em>{firstName}.</em></h1>
        <p>A little movement. A moment of calm. What feels right today?</p>
      </div>
      <button type="button" className="member-action member-action-teal" onClick={()=>onSection('discover')}>Explore experiences <UIIcon name="arrow" size={16}/></button>
    </header>
    <div className="member-metrics">
      <button type="button" className="member-metric member-metric-primary" onClick={()=>onSection('wallet')} aria-label={`Available balance ${summary.balance} credits. View wallet`}>
        <span className="member-metric-label">AVAILABLE BALANCE</span>
        <span className="member-metric-middle"><strong>{summary.balance}</strong><span>View wallet <UIIcon name="arrow" size={14}/></span></span>
        <small>credits to make your own</small>
      </button>
      <button type="button" className="member-metric" onClick={()=>onSection('bookings')} aria-label="View your next booking">
        <span className="member-metric-label">YOUR NEXT EXPERIENCE</span>
        <span className="member-metric-middle"><strong className="member-metric-next">{next?new Date(next.start_at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}):'—'}</strong><span>View booking <UIIcon name="arrow" size={14}/></span></span>
        <small>{next?`${next.service} · ${new Date(next.start_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}`:'No upcoming bookings'}</small>
      </button>
      <button type="button" className="member-metric" onClick={()=>onSection('bookings')} aria-label="View completed visits">
        <span className="member-metric-label">VISITS COMPLETED</span>
        <span className="member-metric-middle"><strong>{String(completedVisits).padStart(2,'0')}</strong><span>View activity <UIIcon name="arrow" size={14}/></span></span>
        <small>experiences enjoyed to date</small>
      </button>
    </div>
    <div className="member-highlights">
      <section className="member-bookings-panel" aria-labelledby="member-upcoming-title">
        <div className="member-panel-heading">
          <h2 id="member-upcoming-title">Your next good moments</h2>
          <button type="button" className="member-inline-link" onClick={()=>onSection('bookings')}>All bookings <UIIcon name="arrow" size={15}/></button>
        </div>
        <div className="member-booking-list">
          {upcoming.length?upcoming.slice(0,2).map(b=><div className="member-booking-row" key={b.id}>
            <div className="member-booking-date" aria-hidden="true"><strong>{new Date(b.start_at).toLocaleDateString('en-GB',{day:'2-digit'})}</strong><span>{new Date(b.start_at).toLocaleDateString('en-GB',{month:'short'}).toUpperCase()}</span></div>
            <div className="member-booking-summary">
              <span className="member-booking-time">{dateTime(b.start_at).toUpperCase()}</span>
              <h3>{b.service}</h3>
              <p>{b.partner}{b.zone?' · '+b.zone:''}</p>
            </div>
            <div className="member-booking-state"><span>{b.status==='CHECKED_IN'?'Checked in':'Booked'}</span><small>{b.credits} credits</small></div>
          </div>):<div className="member-empty-bookings">
            <p>No upcoming bookings yet.</p>
            <button type="button" className="member-inline-link" onClick={()=>onSection('discover')}>Find your next experience <UIIcon name="arrow" size={15}/></button>
          </div>}
        </div>
      </section>
      <aside className="member-credit-invitation">
        <span className="member-kicker">YOUR NEXT CHAPTER</span>
        <h2>More of what<br/>makes you <em>feel good.</em></h2>
        <p>Choose a credit package and make room for something you love.</p>
        <button type="button" className="member-action member-action-burgundy" onClick={()=>onSection('shop')}>Browse credit packages <UIIcon name="arrow" size={16}/></button>
      </aside>
    </div>
    <section className="member-recommendations" aria-labelledby="member-recommendations-title">
      <div className="member-panel-heading">
        <div><h2 id="member-recommendations-title">Make time for yourself.</h2><p>A few ideas for your next experience.</p></div>
        <button type="button" className="member-inline-link" onClick={()=>onSection('discover')}>Explore the collection <UIIcon name="arrow" size={15}/></button>
      </div>
      {picks.length?<div className="member-recommendations-grid">
        {picks.map((item,i)=><button type="button" key={item.id} className="member-recommendation-card" onClick={()=>onService(item)}>
          <div className={`member-recommendation-art member-recommendation-art-${i+1}`} aria-hidden="true">
            <span className="member-recommendation-art-label">{labels[item.group]}</span>
            <span className="member-recommendation-art-letter">{String(i+1).padStart(2,'0')}</span>
          </div>
          <div className="member-recommendation-body">
            <h3>{item.name}</h3>
            <span className="member-recommendation-details"><small>{item.duration_minutes} min · {labels[item.group]}</small><small>{item.credits} credits <UIIcon name="arrow" size={14}/></small></span>
          </div>
        </button>)}
      </div>:<div className="member-recommendations-empty">
        <p>No bookable experiences are available in the catalog at the moment.</p>
        <button type="button" className="member-inline-link" onClick={()=>onSection('discover')}>Explore categories <UIIcon name="arrow" size={15}/></button>
      </div>}
    </section>
  </div>;
}
