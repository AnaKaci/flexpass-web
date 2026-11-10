import {useState} from 'react';
import type {FormEvent} from 'react';
import type {Booking} from './types';
import {Modal} from './App';
import './service-feedback.css';

const STAR_POINTS='12 2.1 15.1 8.35 22.5 9.25 17 14.3 18.45 21.7 12 18.15 5.55 21.7 7 14.3 1.5 9.25 8.9 8.35';

interface RatingProps {
  value:number;
  onChange?:(rating:number)=>void;
  readOnly?:boolean;
  label?:string;
}

/** Accessible, dependency-free five-star interaction inspired by the 21st.dev rating demo. */
export function FlexPassStars({value,onChange,readOnly=false,label='Experience rating'}:RatingProps){
  const [hovered,setHovered]=useState(0);
  const display=readOnly?value:hovered||value;
  return <div className={`flexpass-stars ${readOnly?'flexpass-stars-readonly':''}`} role={readOnly?'img':'group'} aria-label={readOnly?`${label}: ${value} out of 5 stars`:label} onMouseLeave={()=>setHovered(0)}>
    {Array.from({length:5},(_,index)=>{
      const number=index+1,filled=number<=Math.round(display);
      return readOnly
        ?<span key={number} className={`flexpass-star ${filled?'is-selected':''}`} aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><polygon points={STAR_POINTS}/></svg></span>
        :<button key={number} type="button" className={`flexpass-star ${filled?'is-selected':''}`} aria-label={`Rate ${number} out of 5 stars`} aria-pressed={value===number} onMouseEnter={()=>setHovered(number)} onFocus={()=>setHovered(number)} onBlur={()=>setHovered(0)} onClick={()=>onChange?.(number)}>
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><polygon points={STAR_POINTS}/></svg>
        </button>;
    })}
  </div>;
}

export function RatingPopup({booking,onClose,onSubmit}:{booking:Booking;onClose:()=>void;onSubmit:(rating:number,comment:string)=>Promise<void>}){
  const [rating,setRating]=useState(0);
  const [comment,setComment]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [error,setError]=useState('');
  const descriptors=['','Not for me','Could be better','Good experience','Really enjoyed it','Exceptional'];
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!rating||submitting)return;
    setSubmitting(true);setError('');
    try{await onSubmit(rating,comment.trim())}
    catch(err){setError(err instanceof Error?err.message:'Could not save your feedback.');setSubmitting(false)}
  }
  return <Modal title="How was your experience?" subtitle={`${booking.service} · ${booking.partner}`} onClose={onClose}>
    <form className="flexpass-rating-dialog" onSubmit={event=>void submit(event)}>
      <div className="flexpass-feedback-kicker">YOUR FLEXPASS EXPERIENCE</div>
      <p className="flexpass-feedback-intro">A little feedback helps make every experience better.</p>
      <div className="flexpass-rating-pick">
        <span className="flexpass-rating-label">Your rating <span aria-hidden="true">*</span></span>
        <FlexPassStars value={rating} onChange={setRating}/>
        <span className="flexpass-rating-caption" aria-live="polite">{descriptors[rating]||'Choose your stars'}</span>
      </div>
      <label className="flexpass-feedback-note-label" htmlFor="flexpass-feedback-comment">Leave a note <span>(optional)</span></label>
      <textarea id="flexpass-feedback-comment" className="flexpass-feedback-textarea" rows={4} maxLength={500} value={comment} onChange={event=>setComment(event.target.value)} placeholder="What stood out about this experience?"/>
      <div className="flexpass-feedback-help"><span>Only your rating is required. The business will see your feedback.</span><span>{comment.length}/500</span></div>
      {error&&<p className="flexpass-feedback-error" role="alert">{error}</p>}
      <div className="flexpass-rating-actions">
        <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>Maybe later</button>
        <button type="submit" className="btn btn-primary" disabled={!rating||submitting}>{submitting?'Submitting…':'Submit review'}</button>
      </div>
    </form>
  </Modal>;
}
