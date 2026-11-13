import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {request,shortDate} from './api';
import {Panel,useApp} from './App';

type WaitlistRow={
  id:number;slot_id:number;status:'WAITING'|'OFFERED';
  service_name:string;start_at:string;
  offer_expires_at:string|null;hold_id:number|null;
};

/** The client can track and leave queues; an offer links back to the matching experience. */
export function ClientWaitlists(){
  const {token,notify}=useApp();
  const [rows,setRows]=useState<WaitlistRow[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState<number|null>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let current=true;
    request<WaitlistRow[]>('/client/waitlist',token).then(list=>{
      if(current){setRows(list);setError('')}
    }).catch((e:Error)=>{if(current)setError(e.message)});
    return()=>{current=false};
  },[token,revision]);
  async function leave(id:number){
    setBusy(id);
    try{
      await request('/client/waitlist/'+id,token,{method:'DELETE'});
      setRows(previous=>previous.filter(x=>x.id!==id));
      notify('Removed from waitlist.');
    }catch(e){notify((e as Error).message,true)}
    finally{setBusy(null)}
  }
  return <Panel title="My waitlists">
    {error?<div className="notice warn" role="alert">{error} <button className="btn btn-outline btn-sm" onClick={()=>setRevision(x=>x+1)}>Retry</button></div>:
      rows.length===0?<p className="muted">No active waitlists. Full sessions can be joined from Explore experiences.</p>:
      <div className="stack">{rows.map(entry=><div key={entry.id} className="notice">
        <strong>{entry.service_name||'Experience'}</strong>
        <span style={{display:'block'}}>{entry.start_at?shortDate(entry.start_at):''} · {entry.status==='OFFERED'?'A spot is held for you':'Waiting for a spot'}</span>
        {entry.status==='OFFERED'&&entry.offer_expires_at&&<p>Confirm by {new Date(entry.offer_expires_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} to claim this place.</p>}
        <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>
          <Link className="btn btn-primary btn-sm" to={'/client/discover?q='+encodeURIComponent(entry.service_name||'')}>Open experience</Link>
          <button type="button" className="btn btn-outline btn-sm" disabled={busy===entry.id} onClick={()=>void leave(entry.id)}>{busy===entry.id?'Updating…':'Leave waitlist'}</button>
        </div>
      </div>)}</div>
    }
    {rows.length>0&&<button type="button" className="btn btn-tertiary btn-sm" onClick={()=>setRevision(v=>v+1)} style={{marginTop:12}}>Refresh waitlists</button>}
  </Panel>;
}
