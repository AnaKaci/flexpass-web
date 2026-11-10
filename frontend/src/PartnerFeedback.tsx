import {useState} from 'react';
import type {PartnerFeedbackData} from './types';
import {Heading,Panel} from './App';
import {dateTime} from './api';
import {FlexPassStars} from './RatingPopup';

export function PartnerFeedback({feedback,onExport}:{feedback:PartnerFeedbackData;onExport:()=>Promise<void>}){
  const [service,setService]=useState('all');
  const [exporting,setExporting]=useState(false);
  const summary=feedback.services.find(item=>String(item.id)===service);
  const count=summary?summary.count:feedback.count;
  const average=summary?summary.average_rating:feedback.average_rating;
  const rows=service==='all'?feedback.reviews:feedback.reviews.filter(item=>String(item.service_id)===service);
  async function exportFeedback(){
    if(exporting)return;
    setExporting(true);
    try{await onExport()}finally{setExporting(false)}
  }
  return <div className="flexpass-partner-feedback">
    <Heading title="Client feedback" subtitle="Ratings and optional comments collected from completed visits to your services."
      action={<button type="button" className="btn btn-outline btn-sm" onClick={()=>void exportFeedback()} disabled={exporting}>{exporting?'Preparing CSV…':'Export feedback CSV ↗'}</button>}/>
    <div className="flexpass-feedback-summary">
      <Panel title="Overall rating">
        <div className="flexpass-feedback-average">{average===null?'—':average.toFixed(1)}<small>/ 5</small></div>
        {average!==null&&<FlexPassStars readOnly value={average} label="Average rating"/>}
        <p>Based on {count} {count===1?'client review':'client reviews'}.</p>
      </Panel>
      <Panel title="Reviews by service">
        <div className="flexpass-feedback-services">
          {feedback.services.length?feedback.services.map(item=><button type="button" key={item.id} className={`flexpass-feedback-service ${service===String(item.id)?'is-current':''}`} onClick={()=>setService(service===String(item.id)?'all':String(item.id))} aria-pressed={service===String(item.id)}>
            <span>{item.name}</span>
            <strong>{item.average_rating===null?'No ratings':`${item.average_rating.toFixed(1)} / 5`}</strong>
            <small>{item.count} reviews</small>
          </button>):<p className="flexpass-feedback-empty">No services registered yet.</p>}
        </div>
      </Panel>
    </div>
    <Panel title="Recent client reviews" action={<label className="flexpass-feedback-filter">
      <span>Service</span>
      <select className="select" value={service} onChange={event=>setService(event.target.value)} aria-label="Filter reviews by service">
        <option value="all">All services</option>
        {feedback.services.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>}>
      {rows.length?<div className="flexpass-feedback-review-list">
        {rows.map(item=><article className="flexpass-feedback-review" key={item.id}>
          <div className="flexpass-feedback-review-header">
            <div><strong>{item.service}</strong><small>{dateTime(item.created_at)}</small></div>
            <FlexPassStars readOnly value={item.rating} label={`Rating for ${item.service}`}/>
          </div>
          <p>{item.comment||'Star rating only — no written feedback was provided.'}</p>
        </article>)}
      </div>:<p className="flexpass-feedback-empty">No reviews for this selection yet.</p>}
      {feedback.has_more&&<p className="flexpass-feedback-more">Showing the 100 most recent reviews. Export CSV for the complete record.</p>}
    </Panel>
    <div className="notice notice-gap">Feedback is associated with completed bookings. Only reviews for your business's services are included; client contact details are not displayed or exported.</div>
  </div>;
}
