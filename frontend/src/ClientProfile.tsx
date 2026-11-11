import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent,FormEvent} from 'react';
import type {Booking,ClientOrder,ClientProfileDetails,EmployeeSummary,LedgerRow,Section,User} from './types';
import {dateTime,request} from './api';
import {useApp} from './App';
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
  const {token,notify,refreshUser}=useApp();
  const [profile,setProfile]=useState<ClientProfileDetails|null>(null);
  const [draft,setDraft]=useState<ClientProfileDetails|null>(null);
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [formError,setFormError]=useState('');
  const fileInput=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    let active=true;
    request<ClientProfileDetails>('/client/profile',token).then(value=>{
      if(active){setProfile(value);setDraft(value);setLoadError('');}
    }).catch((error:Error)=>{if(active)setLoadError(error.message)});
    return()=>{active=false};
  },[token]);

  const currentName=profile?.full_name||user.full_name;
  const currentEmail=profile?.email||user.email;

  function editField<K extends keyof ClientProfileDetails>(field:K,value:ClientProfileDetails[K]){
    setDraft(old=>old?{...old,[field]:value}:old);
  }
  function startEditing(){
    if(!profile)return;
    setDraft({...profile});
    setFormError('');
    setEditing(true);
  }
  function cancelEditing(){
    setDraft(profile);
    setFormError('');
    setEditing(false);
  }
  async function saveDetails(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!draft||saving)return;
    setSaving(true);setFormError('');
    try{
      const updated=await request<ClientProfileDetails>('/client/profile',token,{
        method:'PATCH',body:JSON.stringify({
          full_name:draft.full_name.trim(),birthday:draft.birthday||null,
          phone:draft.phone,city:draft.city,country:draft.country,about:draft.about
        })
      });
      setProfile(updated);setDraft(updated);setEditing(false);
      await refreshUser();
      notify('Your profile has been updated.');
    }catch(error){setFormError(error instanceof Error?error.message:'Unable to save profile')}
    finally{setSaving(false)}
  }
  async function changePhoto(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file||uploading)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
      notify('Choose a JPEG, PNG or WebP photo.',true);return;
    }
    if(file.size>5*1024*1024){notify('Choose a photo smaller than 5 MB.',true);return}
    setUploading(true);
    try{
      const bitmap=await createImageBitmap(file);
      const width=Math.max(1,Math.round(bitmap.width*Math.min(1,320/Math.max(bitmap.width,bitmap.height))));
      const height=Math.max(1,Math.round(bitmap.height*Math.min(1,320/Math.max(bitmap.width,bitmap.height))));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const context=canvas.getContext('2d');
      if(!context){bitmap.close();throw new Error('Photo processing is unavailable in this browser')}
      context.drawImage(bitmap,0,0,width,height);
      bitmap.close();
      const image_data=canvas.toDataURL('image/jpeg',.78);
      const updated=await request<{avatar_data:string}>('/client/profile/avatar',token,{
        method:'PUT',body:JSON.stringify({image_data})
      });
      setProfile(old=>old?{...old,avatar_data:updated.avatar_data}:old);
      setDraft(old=>old?{...old,avatar_data:updated.avatar_data}:old);
      notify('Your profile photo has been saved.');
    }catch(error){notify(error instanceof Error?error.message:'Unable to upload photo',true)}
    finally{setUploading(false)}
  }
  async function removePhoto(){
    if(uploading)return;
    setUploading(true);
    try{
      await request('/client/profile/avatar',token,{method:'DELETE'});
      setProfile(old=>old?{...old,avatar_data:null}:old);
      setDraft(old=>old?{...old,avatar_data:null}:old);
      notify('Profile photo removed.');
    }catch(error){notify(error instanceof Error?error.message:'Unable to remove photo',true)}
    finally{setUploading(false)}
  }
  const recentBookings=[...bookings]
    .sort((a,b)=>Date.parse(b.start_at)-Date.parse(a.start_at))
    .slice(0,4);
  const recentLedger=[...ledger]
    .sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at))
    .slice(0,3);
  const totalOrders=orders.length;
  const booked=bookings.filter(item=>item.status==='BOOKED').length;
  const completed=bookings.filter(item=>item.status==='CHECKED_IN').length;
  const initials=currentName.trim().split(/\s+/).slice(0,2).map(part=>part.charAt(0).toUpperCase()).join('')||'FP';

  return <div className="client-profile-page">
    <header className="client-profile-hero">
      <div className="client-profile-hero-content">
        <span className="client-profile-eyebrow">YOUR FLEXPASS MEMBERSHIP</span>
        <h1>My <em>profile.</em></h1>
        <p>Your membership, personal details and recent activity, together in one place.</p>
        <span className="client-profile-status"><span aria-hidden="true"/>Account {user.status.toLowerCase().replace(/_/g,' ')}</span>
      </div>
      <div className="client-profile-hero-identity">
        <span className="client-profile-avatar" aria-hidden="true">{profile?.avatar_data?<img src={profile.avatar_data} alt="" className="client-profile-photo"/>:initials}</span>
        <strong>{currentName}</strong>
        <small>{currentEmail}</small>
        <input ref={fileInput} className="client-profile-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void changePhoto(event)} aria-label="Choose profile photo"/>
        <div className="client-profile-avatar-actions">
          <button type="button" disabled={uploading||!profile} onClick={()=>fileInput.current?.click()}>{uploading?'Processing…':profile?.avatar_data?'Change photo':'Add profile photo'}</button>
          {profile?.avatar_data&&<button type="button" disabled={uploading} onClick={()=>void removePhoto()}>Remove</button>}
        </div>
        <small className="client-profile-photo-hint">JPEG, PNG or WebP · up to 5 MB</small>
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
          <button className="client-profile-edit-trigger" type="button" disabled={!profile||saving} onClick={editing?cancelEditing:startEditing}>
            <UIIcon name={editing?'close':'settings'} size={16}/>{editing?'Cancel':'Edit details'}
          </button>
        </div>
        {loadError&&<p className="client-profile-error" role="alert">Unable to load editable profile details: {loadError}</p>}
        {editing&&draft?<form className="client-profile-edit-form" onSubmit={event=>void saveDetails(event)}>
          <label>Full name <input required minLength={2} maxLength={160} autoComplete="name" value={draft.full_name} onChange={event=>editField('full_name',event.target.value)}/></label>
          <label>Email address <input type="email" value={currentEmail} disabled aria-describedby="client-profile-email-hint"/></label>
          <small id="client-profile-email-hint">Email changes require verification and are not supported here.</small>
          <div className="client-profile-edit-grid">
            <label>Date of birth <input type="date" max={new Date().toLocaleDateString('en-CA')} value={draft.birthday||''} onChange={event=>editField('birthday',event.target.value||null)}/></label>
            <label>Phone <input type="tel" maxLength={35} autoComplete="tel" placeholder="Optional" value={draft.phone} onChange={event=>editField('phone',event.target.value)}/></label>
            <label>City <input maxLength={100} autoComplete="address-level2" placeholder="Optional" value={draft.city} onChange={event=>editField('city',event.target.value)}/></label>
            <label>Country <input maxLength={80} autoComplete="country-name" placeholder="Optional" value={draft.country} onChange={event=>editField('country',event.target.value)}/></label>
          </div>
          <label>About me <textarea rows={3} maxLength={300} placeholder="Optional — a little about yourself" value={draft.about} onChange={event=>editField('about',event.target.value)}/></label>
          <small>{draft.about.length}/300 characters</small>
          {formError&&<p role="alert" className="client-profile-error">{formError}</p>}
          <div className="client-profile-edit-actions">
            <button type="button" className="btn btn-outline" onClick={cancelEditing} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'Save details'}</button>
          </div>
        </form>:<dl className="client-profile-details">
          <div><dt>Full name</dt><dd>{currentName}</dd></div>
          <div><dt>Email address</dt><dd>{currentEmail}</dd></div>
          <div><dt>Birthday</dt><dd>{profile?.birthday?new Date(profile.birthday+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'Not added'}</dd></div>
          <div><dt>Phone</dt><dd>{profile?.phone||'Not added'}</dd></div>
          <div><dt>City</dt><dd>{profile?.city||'Not added'}</dd></div>
          <div><dt>Country</dt><dd>{profile?.country||'Not added'}</dd></div>
          <div><dt>About me</dt><dd>{profile?.about||'Not added'}</dd></div>
          <div><dt>Account status</dt><dd className="client-profile-detail-status">{user.status.replace(/_/g,' ')}</dd></div>
          <div><dt>Account ID</dt><dd>#{user.id}</dd></div>
        </dl>}
        <p className="client-profile-panel-note">Optional information can be added any time after registration.</p>
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
    <section className="client-profile-panel client-profile-payment" aria-labelledby="client-profile-payment-heading">
      <div className="client-profile-panel-heading">
        <div><span className="client-profile-panel-kicker">PAYMENTS</span><h2 id="client-profile-payment-heading">Payment methods</h2></div>
        <UIIcon name="credit" size={22}/>
      </div>
      <div className="client-profile-payment-content">
        <div className="client-profile-payment-symbol"><UIIcon name="credit" size={28}/></div>
        <div>
          <strong>No credit or debit card linked</strong>
          <p>FlexPass currently supports bank-transfer purchase requests. Card payments and securely saved cards require a payment-provider integration and are not yet available.</p>
          <p className="client-profile-payment-safety">For security, card numbers and CVVs are never collected or stored in your FlexPass profile.</p>
          <button type="button" className="client-profile-inline-link" onClick={()=>onSection('orders')}>View purchase and transfer details <UIIcon name="arrow" size={16}/></button>
        </div>
      </div>
    </section>

    <div className="client-profile-footer">
      <span>THE FLEXPASS COLLECTION</span>
      <button type="button" className="client-profile-inline-link" onClick={()=>onSection('discover')}>Find your next experience <UIIcon name="arrow" size={16}/></button>
    </div>
  </div>;
}
