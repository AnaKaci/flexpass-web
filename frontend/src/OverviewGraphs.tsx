import type {CSSProperties} from 'react';
import type {AdminAnalytics,Booking,Group} from './types';
import {labels} from './api';
import {Panel} from './App';
import {LogMiniChart} from './LogMiniChart';
import './overview-graphs.css';

type BreakdownItem={label:string;count:number};

function RecordBreakdown({items,emptyMessage}:{items:ReadonlyArray<BreakdownItem>;emptyMessage:string}){
  const total=items.reduce((sum,item)=>sum+item.count,0);
  const maximum=Math.max(1,...items.map(item=>item.count));
  if(total===0)return <p className="flexpass-overview-graphs-empty">{emptyMessage}</p>;
  return <div className="flexpass-overview-breakdown" role="list" aria-label="Recorded counts by category">
    {items.map(item=>{
      const style={'--flexpass-bar-fill':`${item.count/maximum*100}%`} as CSSProperties;
      return <div className="flexpass-overview-breakdown-row" role="listitem" key={item.label}>
        <div className="flexpass-overview-breakdown-heading">
          <span>{item.label}</span>
          <strong>{item.count}</strong>
        </div>
        <div className="flexpass-overview-breakdown-track" role="img" aria-label={`${item.label}: ${item.count} records`}>
          <span style={style}/>
        </div>
      </div>;
    })}
  </div>;
}

export function PartnerOverviewGraphs({bookings}:{bookings:ReadonlyArray<Booking>}){
  const statuses:BreakdownItem[]=[
    {label:'Booked',count:bookings.filter(booking=>booking.status==='BOOKED').length},
    {label:'Checked in',count:bookings.filter(booking=>booking.status==='CHECKED_IN').length},
    {label:'Cancelled',count:bookings.filter(booking=>booking.status==='CANCELLED').length},
  ];
  return <section className="flexpass-overview-graphs" aria-label="Business overview charts">
    <div className="flexpass-overview-graphs-grid">
      <Panel title="Reservation activity">
        <div className="flexpass-overview-trends two">
          <LogMiniChart title="New reservations" timestamps={bookings.map(booking=>booking.created_at)} unit="bookings"/>
          <LogMiniChart title="Completed check-ins" timestamps={bookings.map(booking=>booking.checked_in_at)} unit="visits"/>
        </div>
      </Panel>
      <Panel title="Booking status">
        <p className="flexpass-overview-graphs-description">Status of all reservations currently available to this business.</p>
        <RecordBreakdown items={statuses} emptyMessage="No reservations to summarize yet."/>
      </Panel>
    </div>
  </section>;
}

export function AdminOverviewGraphs({analytics}:{analytics?:AdminAnalytics}){
  const monthly=analytics?.monthly||[];
  const categories=(analytics?.categories||[])
    .filter(item=>item.bookings>0)
    .sort((a,b)=>b.bookings-a.bookings)
    .map(item=>({label:labels[item.name as Group]||item.name,count:item.bookings}));
  return <section className="flexpass-overview-graphs" aria-label="Admin overview charts">
    <div className="flexpass-overview-graphs-grid">
      <Panel title="Platform activity">
        <div className="flexpass-overview-trends three">
          <LogMiniChart title="Bookings created" interval="month" points={monthly.map(item=>({period:item.period,count:item.bookings}))} unit="bookings"/>
          <LogMiniChart title="Visits confirmed" interval="month" points={monthly.map(item=>({period:item.period,count:item.visits}))} unit="visits"/>
          <LogMiniChart title="Client orders" interval="month" points={monthly.map(item=>({period:item.period,count:item.orders}))} unit="orders"/>
        </div>
      </Panel>
      <Panel title="Bookings by experience category">
        <p className="flexpass-overview-graphs-description">Recorded booking counts across existing experience categories.</p>
        <RecordBreakdown items={categories} emptyMessage="No experience bookings recorded yet."/>
      </Panel>
    </div>
  </section>;
}
