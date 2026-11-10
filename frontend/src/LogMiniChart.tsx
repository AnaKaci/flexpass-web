import {useMemo} from 'react';
import type {CSSProperties} from 'react';
import './log-mini-chart.css';

export interface MiniChartPoint {
  period:string;
  count:number;
}
interface Props{
  title:string;
  timestamps?:ReadonlyArray<string|null|undefined>;
  interval?:'day'|'month';
  points?:ReadonlyArray<MiniChartPoint>;
  unit?:string;
}

const pad=(value:number)=>String(value).padStart(2,'0');
const dayKey=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
const monthKey=(date:Date)=>`${date.getFullYear()}-${pad(date.getMonth()+1)}`;
const dayLabel=(date:Date)=>date.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const monthLabel=(date:Date)=>date.toLocaleDateString('en-GB',{month:'short'});

/** Counts only real records currently supplied by the API. No seeded or generated metrics. */
export function activityBuckets(
  timestamps:ReadonlyArray<string|null|undefined>,
  interval:'day'|'month'='day',
  today:Date=new Date(),
  points?:ReadonlyArray<MiniChartPoint>
){
  const length=interval==='day'?14:6;
  const buckets=Array.from({length},(_,index)=>{
    const offset=index-length+1;
    const date=interval==='day'
      ?new Date(today.getFullYear(),today.getMonth(),today.getDate()+offset)
      :new Date(today.getFullYear(),today.getMonth()+offset,1);
    return {key:interval==='day'?dayKey(date):monthKey(date),
      label:interval==='day'?dayLabel(date):monthLabel(date),
      count:0};
  });
  const byKey=new Map(buckets.map(bucket=>[bucket.key,bucket]));
  if(points){
    for(const point of points){
      const bucket=byKey.get(point.period);
      if(bucket&&Number.isFinite(point.count)&&point.count>=0)bucket.count+=point.count;
    }
  }else{
    for(const value of timestamps){
      if(!value)continue;
      const specialMonth=interval==='month'&&/^\d{4}-\d{2}$/.test(value);
      const date=specialMonth?null:new Date(value);
      if(!specialMonth&&(!date||!Number.isFinite(date.getTime())))continue;
      const key=specialMonth?value:interval==='day'?dayKey(date!):monthKey(date!);
      const bucket=byKey.get(key);
      if(bucket)bucket.count++;
    }
  }
  return buckets;
}

/** Interactive miniature activity visualization adapted to FlexPass typography and palette. */
export function LogMiniChart({title,timestamps=[],interval='day',points,unit='records'}:Props){
  const buckets=useMemo(()=>activityBuckets(timestamps,interval,new Date(),points),[timestamps,interval,points]);
  const total=buckets.reduce((sum,bucket)=>sum+bucket.count,0);
  const max=Math.max(1,...buckets.map(bucket=>bucket.count));
  const range=interval==='day'?'Last 14 days':'Last 6 months';
  return <div className="flexpass-mini-chart" aria-label={`${title}. ${total} ${unit} in ${range.toLowerCase()}.`}>
    <div className="flexpass-mini-chart-intro">
      <div>
        <span className="flexpass-mini-chart-eyebrow">{range}</span>
        <strong>{title}</strong>
        <small>Activity from records currently loaded</small>
      </div>
      <div className="flexpass-mini-chart-total"><strong>{total}</strong><span>{unit}</span></div>
    </div>
    <div className="flexpass-mini-chart-bars" role="group" aria-label={`${title} by ${interval}`}>
      {buckets.map((bucket,index)=>{
        const height=bucket.count===0?3:Math.max(8,Math.round(bucket.count/max*100));
        const style={'--log-mini-height':`${height}%`,'--log-mini-delay':`${index*32}ms`} as CSSProperties;
        return <span key={bucket.key} className={`flexpass-mini-chart-column ${bucket.count?'has-events':''}`}
          tabIndex={0} role="img" aria-label={`${bucket.label}: ${bucket.count} ${unit}`}
          title={`${bucket.label}: ${bucket.count} ${unit}`}>
          <span className="flexpass-mini-chart-bar" style={style}/>
          <span className="flexpass-mini-chart-tooltip" aria-hidden="true">{bucket.label}<b>{bucket.count}</b></span>
        </span>;
      })}
    </div>
    <div className="flexpass-mini-chart-axis" aria-hidden="true"><span>{buckets[0]?.label}</span><span>{buckets[buckets.length-1]?.label}</span></div>
  </div>;
}
