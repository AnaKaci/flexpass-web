import type {Booking,ClientOrder,EmployeeSummary,LedgerRow,Section,User} from './types';
import {dateTime} from './api';
import {UIIcon} from './UIIcon';
import './client-profile.css';

interface Props{
  user:User;
  summary:EmployeeSummary;
  bookings:ReadonlyArray<Booking>;
  orders:ReadonlyArray<ClientOrder>;
  ledger:ReadonlyArray<LedgerRow>;
  onSection:(section:Section)=>void;
}

/** Client account overview. All values come from the current authenticated user
 * and that client's existing summary, booking, order and wallet endpoints.
 */
export function ClientProfile({user,summary,bookings,orders,ledger,onSection}:Props){
  const recentBookings=[...bookings]
    .sort((a,b)=>Date.parse(b.start_at)-Date.parse(a.start_at))
    .slice(0,4);
  const recentLedger=[...ledger]
    .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))
    .slice(0,3);
  const totalOrders=orders.length;
  const booked=bookings.filter(item=>item.status==='BOOKED').length;
  const completed=bookings.filter(item=>item.status==='CHECKED_IN').length;
  const initials=user.full_name.trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('')||'FP';

  return <div className="client-profile-page">
    <header className="client-profile-hero">
      <div className="client-profile-hero-content">
        <span className="client-profile-eyebrow">YOUR FLEXPASS MEMBERSHIP</span>
        <h1>My <em>profile.</em></h1>
        <p>Your membership, personal details and recent activity, together in one place.</p>
        <span className="client-profile-status"><span aria-hidden="true"/>Account {user.status.toLowerCase().replace(/_/g,' ')}</span>
      </div>
      <div className="client-profile-hero-identity">
        <span className="client-profile-avatar" aria-hidden="true">{initials}</span>
        <strong>{user.full_name}</strong>
        <small>{user.email}</small>
        <span className="client-profile-identity-role">{summary.personal_account?'Personal membership':'Client membership'}</span>
      </div>
    </header>

    <section className="client-profile-metrics" aria-label="Your membership activity">
      <button type="button" className="client-profile-metric" onClick={()=>onSection('wallet')}>
        <span>AVAILABLE CREDITS</span><strong>{summary.balance}</strong><small>Open wallet <UIIcon name="arrow" size={14}/></small>
      </button>
      <button type="button" className="client-profile-metric" onClick={()=>onSection('bookings')}>
        <span>COMPLETED VISITS</span><strong>{completed}</strong><small>View bookings <UIIcon name="arrow" size={14}/></small>
      </button>
      <button type="button" className="client-profile-metric" onClick={()=>onSection('bookings')}>
        <span>ACTIVE BOOKINGS</span><strong>{booked}</strong><small>View reservations <UIIcon name="arrow" size={14}/></small>
      </button>
      <button type="button" className="client-profile-metric" onClick={()=>onSection('orders')}>
        <span>MY ORDERS</span><strong>{totalOrders}</strong><small>View purchases <UIIcon name="arrow" size={14}/></small>
      </button>
    </section>

    <div className="client-profile-information">
      <section className="client-profile-panel" aria-labelledby="client-profile-details-heading">
        <div className="client-profile-panel-heading">
          <div><span className="client-profile-panel-kicker">ACCOUNT</span><h2 id="client-profile-details-heading">Personal details</h2></div>
          <UIIcon name="users" size={22}/>
        </div>
        <dl className="client-profile-details">
          <div><dt>Full name</dt><dd>{user.full_name}</dd></div>
          <div><dt>Email address</dt><dd>{user.email}</dd></div>
          <div><dt>Account status</dt><dd className="client-profile-detail-status">{user.status.replace(/_/g,' ')}</dd></div>
          <div><dt>Account ID</dt><dd>#{user.id}</dd></div>
        </dl>
        <p className="client-profile-panel-note">These details are displayed from your signed-in FlexPass account.</p>
      </section>
      <section className="client-profile-panel" aria-labelledby="client-profile-membership-heading">
        <div className="client-profile-panel-heading">
          <div><span className="client-profile-panel-kicker">MEMBERSHIP</span><h2 id="client-profile-membership-heading">Your membership</h2></div>
          <UIIcon name="wallet" size={22}/>
        </div>
        <div className="client-profile-membership-balance">
          <span>YOUR CURRENT BALANCE</span>
          <strong>{summary.balance}<small> credits</small></strong>
        </div>
        <dl className="client-profile-details">
          <div><dt>Membership type</dt><dd>{summary.personal_account?'Personal credits':'Client account'}</dd></div>
          {summary.plan&&<div><dt>Plan</dt><dd>{summary.plan}</dd></div>}
          {summary.company&&<div><dt>Organization</dt><dd>{summary.company}</dd></div>}
        </dl>
        <button type="button" className="client-profile-inline-link" onClick={()=>onSection('shop')}>Explore credit packages <UIIcon name="arrow" size={16}/></button>
      </section>
    </div>

    <div className="client-profile-information">
      <section className="client-profile-panel" aria-labelledby="client-profile-bookings-heading">
        <div className="client-profile-panel-heading">
          <div><span className="client-profile-panel-kicker">EXPERIENCES</span><h2 id="client-profile-bookings-heading">Recent bookings</h2></div>
          <button type="button" className="client-profile-inline-link" onClick={()=>onSection('bookings')}>All bookings <UIIcon name="arrow" size={15}/></button>
        </div>
        {recentBookings.length?<ul className="client-profile-activity-list">
          {recentBookings.map(booking=><li key={booking.id}>
            <span className="client-profile-activity-icon" aria-hidden="true"><UIIcon name="calendar" size={19}/></span>
            <div className="client-profile-activity-copy">
              <strong>{booking.service}</strong>
              <small>{booking.partner} · {dateTime(booking.start_at)}</small>
            </div>
            <span className="client-profile-activity-status">{booking.status.replace(/_/g,' ')}</span>
          </li>)}
        </ul>:<p className="client-profile-empty">No bookings recorded on your account yet.</p>}
      </section>
      <section className="client-profile-panel" aria-labelledby="client-profile-credits-heading">
        <div className="client-profile-panel-heading">
          <div><span className="client-profile-panel-kicker">WALLET</span><h2 id="client-profile-credits-heading">Recent credit activity</h2></div>
          <button type="button" className="client-profile-inline-link" onClick={()=>onSection('wallet')}>View wallet <UIIcon name="arrow" size={15}/></button>
        </div>
        {recentLedger.length?<ul className="client-profile-activity-list">
          {recentLedger.map(row=><li key={row.id}>
            <span className="client-profile-activity-icon" aria-hidden="true"><UIIcon name="credit" size={19}/></span>
            <div className="client-profile-activity-copy">
              <strong>{row.reason||row.kind.replace(/_/g,' ')}</strong>
              <small>{dateTime(row.created_at)}</small>
            </div>
            <span className={`client-profile-amount ${row.amount>=0?'is-positive':'is-negative'}`}>{row.amount>0?'+':''}{row.amount}</span>
          </li>)}
        </ul>:<p className="client-profile-empty">No credit transactions recorded yet.</p>}
        <p className="client-profile-panel-note">Balances and transactions reflect the current account ledger. Orders are tracked separately.</p>
      </section>
    </div>
    <div className="client-profile-footer">
      <span>THE FLEXPASS COLLECTION</span>
      <button type="button" className="client-profile-inline-link" onClick={()=>onSection('discover')}>Find your next experience <UIIcon name="arrow" size={16}/></button>
    </div>
  </div>;
}
