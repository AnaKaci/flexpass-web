import type {CSSProperties} from 'react';
import type {AdminAnalytics,Booking,Group} from './types';
import {labels} from './api';
import {Panel} from './App';
import {activityBuckets} from './LogMiniChart';
import './overview-graphs.css';

type BreakdownItem={label:string;count:number};
type TrendSeries={label:string;values:ReadonlyArray<number>;tone:'teal'|'burgundy'|'mist'};

/** Keep the points tied to the exact booking / analytics periods already returned. */
function TrendLineChart({title,periodLabels,series,range}:{title:string;periodLabels:ReadonlyArray<string>;series:ReadonlyArray<TrendSeries>;range:string}){
  const total=series.reduce((sum,item)=>sum+item.values.reduce((n,count)=>n+count,0),0);
  const max=Math.max(1,...series.flatMap(item=>item.values));
  const left=12,right=628,top=13,bottom=147;
  const xAt=(index:number)=>left+(periodLabels.length>1?index/(periodLabels.length-1):0)*(right-left);
  const yAt=(count:number)=>bottom-count/max*(bottom-top);
  const ticks=[0,1,2,3,4].map(index=>bottom-index/4*(bottom-top));
  return <div className="flexpass-overview-line-chart" aria-label={`${title}: ${range}`}>
    <div className="flexpass-overview-line-heading">
      <span>{range}</span>
      <strong>{title}</strong>
    </div>
    <div className="flexpass-overview-line-legend" aria-label="Chart series">
      {series.map(item=><span key={item.label} className={`flexpass-overview-line-key tone-${item.tone}`}><i aria-hidden="true"/>{item.label}</span>)}
    </div>
    <svg className="flexpass-overview-line-svg" viewBox="0 0 640 160" role="group" aria-label={`${title} trend lines`} preserveAspectRatio="none">
      {ticks.map((y,i)=><line key={i} className="flexpass-overview-gridline" x1={left} y1={y} x2={right} y2={y}/>)}
      {series.map(item=>{
        const points=item.values.map((value,index)=>[xAt(index),yAt(value)] as const);
        const d=points.map(([x,y],index)=>`${index?'L':'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
        return <g key={item.label} className={`flexpass-overview-line-series tone-${item.tone}`}>
          <path className="flexpass-overview-line-path" d={d} pathLength={100}/>
          {points.map(([x,y],index)=><circle key={index} className="flexpass-overview-line-point" cx={x} cy={y} r={3.7} role="img" tabIndex={0}
            aria-label={`${item.label}, ${periodLabels[index]}: ${item.values[index]}`}>
            <title>{`${item.label} · ${periodLabels[index]}: ${item.values[index]}`}</title>
          </circle>)}
        </g>;
      })}
    </svg>
    <div className="flexpass-overview-line-axis" aria-hidden="true">
      <span>{periodLabels[0]||'—'}</span>
      <span>{periodLabels[Math.floor((periodLabels.length-1)/2)]||'—'}</span>
      <span>{periodLabels[periodLabels.length-1]||'—'}</span>
    </div>
    {total===0&&<p className="flexpass-overview-graphs-empty">No activity recorded in this period.</p>}
  </div>;
}

function BookingStatusDonut({items}:{items:ReadonlyArray<BreakdownItem>}){
  const total=items.reduce((sum,item)=>sum+item.count,0);
  const booked=total?items[0].count/total*100:0;
  const checkedIn=total?(items[0].count+items[1].count)/total*100:0;
  const background=total
    ?`conic-gradient(var(--teal) 0% ${booked}%, var(--burgundy) ${booked}% ${checkedIn}%, var(--mist) ${checkedIn}% 100%)`
    :'var(--mist)';
  return <div className="flexpass-overview-donut-layout">
    <div className="flexpass-overview-donut" style={{background}} role="img"
      aria-label={`${total} reservations: ${items.map(item=>`${item.label} ${item.count}`).join(', ')}`}>
      <div className="flexpass-overview-donut-hole" aria-hidden="true"><strong>{total}</strong><small>reservations</small></div>
    </div>
    <div className="flexpass-overview-donut-legend" role="list">
      {items.map((item,index)=><div key={item.label} role="listitem" className="flexpass-overview-donut-legend-row">
        <span className={`flexpass-overview-donut-key tone-${index===0?'teal':index===1?'burgundy':'mist'}`} aria-hidden="true"/>
        <span>{item.label}</span><strong>{item.count}</strong>
      </div>)}
    </div>
  </div>;
}

function RecordBreakdown({items,emptyMessage}:{items:ReadonlyArray<BreakdownItem>;emptyMessage:string}){
  const total=items.reduce((sum,item)=>sum+item.count,0);
  const maximum=Math.max(1,...items.map(item=>item.count));
  if(total===0)return <p className="flexpass-overview-graphs-empty">{emptyMessage}</p>;
  return <div className="flexpass-overview-breakdown" role="list" aria-label="Recorded counts by category">
    {items.map(item=>{
      const style={'--flexpass-bar-fill':`${item.count/maximum*100}%`} as CSSProperties;
      return <div className="flexpass-overview-breakdown-row" role="listitem" key={item.label}>
        <div className="flexpass-overview-breakdown-heading">
          <span>{item.label}</span><strong>{item.count}</strong>
        </div>
        <div className="flexpass-overview-breakdown-track" role="img" aria-label={`${item.label}: ${item.count} records`}>
          <span style={style}/>
        </div>
      </div>;
    })}
  </div>;
}

export function PartnerOverviewGraphs({bookings}:{bookings:ReadonlyArray<Booking>}){
  const today=new Date();
  const reservations=activityBuckets(bookings.map(booking=>booking.created_at),'day',today);
  const visits=activityBuckets(bookings.map(booking=>booking.checked_in_at),'day',today);
  const statuses:BreakdownItem[]=[
    {label:'Booked',count:bookings.filter(booking=>booking.status==='BOOKED').length},
    {label:'Checked in',count:bookings.filter(booking=>booking.status==='CHECKED_IN').length},
    {label:'Cancelled',count:bookings.filter(booking=>booking.status==='CANCELLED').length},
  ];
  return <section className="flexpass-overview-graphs" aria-label="Business overview charts">
    <div className="flexpass-overview-graphs-grid">
      <Panel title="Reservation trends">
        <TrendLineChart title="Bookings and completed visits" periodLabels={reservations.map(item=>item.label)} range="Last 14 days"
          series={[{label:'New reservations',values:reservations.map(item=>item.count),tone:'teal'},
                   {label:'Completed check-ins',values:visits.map(item=>item.count),tone:'burgundy'}]}/>
      </Panel>
      <Panel title="Booking status">
        <p className="flexpass-overview-graphs-description">Current status of all reservations recorded for this business.</p>
        <BookingStatusDonut items={statuses}/>
      </Panel>
    </div>
  </section>;
}

export function AdminOverviewGraphs({analytics}:{analytics?:AdminAnalytics}){
  const monthly=analytics?.monthly||[];
  const today=new Date();
  const bookings=activityBuckets([],'month',today,monthly.map(item=>({period:item.period,count:item.bookings})));
  const visits=activityBuckets([],'month',today,monthly.map(item=>({period:item.period,count:item.visits})));
  const orders=activityBuckets([],'month',today,monthly.map(item=>({period:item.period,count:item.orders})));
  const categories=(analytics?.categories||[])
    .filter(item=>item.bookings>0)
    .sort((a,b)=>b.bookings-a.bookings)
    .map(item=>({label:labels[item.name as Group]||item.name,count:item.bookings}));
  return <section className="flexpass-overview-graphs" aria-label="Admin overview charts">
    <div className="flexpass-overview-graphs-grid">
      <Panel title="Platform trends">
        <TrendLineChart title="Bookings, visits and orders" periodLabels={bookings.map(item=>item.label)} range="Last 6 months"
          series={[{label:'Bookings',values:bookings.map(item=>item.count),tone:'teal'},
                   {label:'Confirmed visits',values:visits.map(item=>item.count),tone:'burgundy'},
                   {label:'Client orders',values:orders.map(item=>item.count),tone:'mist'}]}/>
      </Panel>
      <Panel title="Bookings by experience category">
        <p className="flexpass-overview-graphs-description">Recorded booking counts across existing experience categories.</p>
        <RecordBreakdown items={categories} emptyMessage="No experience bookings recorded yet."/>
      </Panel>
    </div>
  </section>;
}
