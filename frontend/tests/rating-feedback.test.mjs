import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const popup=readFileSync(new URL('../src/RatingPopup.tsx',import.meta.url),'utf8');
const feedback=readFileSync(new URL('../src/PartnerFeedback.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/service-feedback.css',import.meta.url),'utf8');
const types=readFileSync(new URL('../src/types.ts',import.meta.url),'utf8');

test('client reviews use the animated popup and optional feedback rather than prompts',()=>{
  assert.ok(dashboard.includes('<RatingPopup booking={reviewBooking}'));
  assert.ok(dashboard.includes('function leaveReview(booking:Booking){setReviewBooking(booking)}'));
  assert.ok(dashboard.includes('onReview={leaveReview}'));
  assert.ok(dashboard.includes('await post(`/client/bookings/${reviewBooking.id}/review`,token,{rating,comment});'));
  assert.ok(!dashboard.includes("window.prompt('Rate your completed experience"));
  assert.ok(popup.includes('onSubmit:(rating:number,comment:string)=>Promise<void>'));
  assert.ok(popup.includes('onChange={setRating}'));
  assert.ok(popup.includes('Leave a note'));
  assert.ok(popup.includes('(optional)'));
  assert.ok(popup.includes('disabled={!rating||submitting}'));
  assert.ok(popup.includes('maxLength={500}'));
});

test('star interaction retains keyboard-accessible buttons and reduced motion fallback',()=>{
  assert.ok(popup.includes('aria-label={`Rate ${number} out of 5 stars`}'));
  assert.ok(popup.includes('aria-pressed={value===number}'));
  assert.ok(popup.includes('onMouseEnter={()=>setHovered(number)}'));
  assert.ok(popup.includes('onFocus={()=>setHovered(number)}'));
  assert.ok(popup.includes('onClick={()=>onChange?.(number)}'));
  assert.ok(popup.includes('aria-live="polite"'));
  assert.ok(css.includes('animation:flexpass-rating-bloom'));
  assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
  for(const color of ['var(--burgundy)','var(--teal)','var(--teal-dark)','var(--ivory)','var(--paper)']){
    assert.ok(css.includes(color),color);
  }
  assert.ok(!css.includes('.home-page'));
  assert.ok(!css.includes('.auth-photo-stage'));
});

test('business feedback uses authenticated existing review data and per-service summaries',()=>{
  assert.ok(types.includes(" | 'feedback' | 'notifications';"));
  assert.ok(dashboard.includes("['feedback','Client feedback','activity']"));
  assert.ok(dashboard.includes("get<PartnerFeedbackData>('/partner/reviews')"));
  assert.ok(dashboard.includes("if(section==='feedback')return data.partnerFeedback?"));
  assert.ok(dashboard.includes("onSection('feedback')"));
  assert.ok(dashboard.includes("'/api/partner/reviews/export'"));
  assert.ok(dashboard.includes('ratingForService(s.id)'));
  assert.ok(feedback.includes('feedback.services.map'));
  assert.ok(feedback.includes("feedback.reviews.filter(item=>String(item.service_id)===service)"));
  assert.ok(feedback.includes('item.comment||'));
  assert.ok(feedback.includes('onClick={()=>void exportFeedback()}'));
  assert.ok(!feedback.includes("Math.random("));
});

test('rating stars are solid-filled with distinct idle and selected FlexPass colors',()=>{
  assert.ok(css.includes('fill:var(--mist);stroke:var(--mist);'), 'unselected stars should have a muted solid fill');
  assert.ok(css.includes('fill:var(--burgundy);stroke:var(--burgundy);'), 'selected/hovered stars should have a burgundy solid fill');
  assert.ok(!css.includes('fill:transparent;'), 'no hollow star outlines');
  assert.ok(css.includes('animation:flexpass-rating-bloom'), 'retain existing star animation');
  assert.ok(popup.includes("filled?'is-selected':''"), 'preserve rating-dependent star selection');
});

test('booking actions remain aligned and reviewed bookings show a muted state',()=>{
  assert.ok(dashboard.includes('<div className="booking-action-slot">'));
  assert.ok(dashboard.includes("{b.status==='CHECKED_IN'&&role==='employee'&&onReview&&!b.reviewed&&<button"));
  assert.ok(dashboard.includes("{b.status==='CHECKED_IN'&&role==='employee'&&b.reviewed&&<span className=\"booking-action-state\">Reviewed</span>}"));
  assert.ok(dashboard.includes('className="booking-action-empty">—</span>'));
  assert.ok(css.includes('.dashboard-app-shell .booking-action-slot{'));
  assert.ok(css.includes('min-height:38px;'));
  assert.ok(css.includes('align-items:flex-start;'));
  assert.ok(css.includes('justify-content:center;'));
  assert.ok(css.includes('color:var(--warm-gray);'));
  assert.ok(!css.includes('font-family:'));
});
