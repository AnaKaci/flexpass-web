import {useEffect,useState} from 'react';
import type {Booking} from './types';
import {dateTime,post,request} from './api';
import {Heading,Panel,StatusTag,useApp} from './App';

type AdminBooking=Booking&{refunded_credits:number};

/** Restricted Admin operations: no check-in can be refunded through this screen. */
export function AdminBookingAdjustments(){
  const {token,notify}=useApp();
  const [rows,setRows]=useState<AdminBooking[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<number|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let current=true;
    setLoading(true);
    request<AdminBooking[]>('/admin/bookings',token).then(result=>{
      if(current){setRows(result);setError('')}
    }).catch((e:Error)=>{if(current)setError(e.message)})
      .finally(()=>{if(current)setLoading(false)});
    return()=>{current=false};
  },[token,revision]);

  async function correct(booking:AdminBooking){
    if(busy!==null)return;
    const raw=window.prompt('Total credits to refund for '+booking.reference+
      '\nOriginal charge: '+booking.credits+
      '\nAlready refunded: '+booking.refunded_credits+
      '\nEnter a number from '+booking.refunded_credits+' to '+booking.credits,
      String(booking.credits));
    if(raw===null)return;
    if(!/^\d+$/.test(raw.trim())){notify('Enter a whole number of credits.',true);return}
    const refund=Number(raw.trim());
    if(refund<booking.refunded_credits||refund>booking.credits){
      notify('Refund must be between the already-refunded amount and the original charge.',true);
      return;
    }
    const reason=window.prompt('Reason for the refund or correction (at least 8 characters):');
    if(!reason)return;
    if(reason.trim().length<8){notify('Please provide a meaningful explanation.',true);return}
    if(!window.confirm((booking.status==='BOOKED'?'Cancel this booking and set':'Set')+
      ' the TOTAL refunded credits to '+refund+' for '+booking.reference+'?\n\nReason: '+reason.trim()))return;
    setBusy(booking.id);
    try{
      const result=await post<{additional_refund:number}>('/admin/bookings/'+booking.id+'/refund',
        token,{refund_credits:refund,reason:reason.trim()});
      notify('Correction recorded. '+result.additional_refund+' additional credits returned.');
      setRevision(v=>v+1);
    }catch(e){notify((e as Error).message,true)}
    finally{setBusy(null)}
  }

  return <>
    <Heading title="Booking corrections" subtitle="Review reservations and make audited credit-refund corrections."/>
    <div className="notice notice-gap">Only Admin can correct a booking. A correction cannot reverse a completed visit or withdraw credits already refunded. Every change requires a reason.</div>
    <Panel title="Recent bookings (last 150)">
      {loading?<p className="muted">Loading bookings…</p>:error?
        <div className="notice warn" role="alert">{error} <button className="btn btn-outline btn-sm" onClick={()=>setRevision(v=>v+1)}>Retry</button></div>:
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Reservation</th><th>Client</th><th>Session</th><th>Credits</th><th>Status</th><th>Correction</th></tr></thead>
          <tbody>{rows.length?rows.map(b=><tr key={b.id}>
            <td data-label="Reservation"><strong>{b.reference}</strong><small style={{display:'block'}}>{b.service}</small></td>
            <td data-label="Client">{b.user}<small style={{display:'block'}}>{b.email}</small></td>
            <td data-label="Session">{dateTime(b.start_at)}<small style={{display:'block'}}>{b.partner}</small></td>
            <td data-label="Credits">{b.credits} charged<br/><small>{b.refunded_credits} refunded</small></td>
            <td data-label="Status"><StatusTag status={b.status}/></td>
            <td data-label="Correction">{b.status==='CHECKED_IN'?'Completed':b.refunded_credits>=b.credits?'Fully refunded':
              <button className="btn btn-outline btn-sm" disabled={busy!==null} onClick={()=>void correct(b)}>
                {busy===b.id?'Saving…':'Adjust refund'}
              </button>}</td>
          </tr>):<tr><td colSpan={6}>No bookings found.</td></tr>}</tbody>
        </table></div>}
    </Panel>
  </>;
}
