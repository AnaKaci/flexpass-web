import {useState} from 'react';
import type {FormEvent} from 'react';
import type {Company,Plan,Invoice,Settlement,FormDialog,PartnerService,Employee} from './types';
import {month,post,labels} from './api';
import {Modal,useApp} from './App';

interface Options {value:string;label:string}
interface Field {name:string;label:string;type?:'text'|'email'|'number'|'month'|'date'|'datetime-local'|'select'|'textarea';required?:boolean;defaultValue?:string|number;options?:Options[];step?:string;min?:string;}
interface Source {companies:Company[];plans:Plan[];invoices:Invoice[];settlements:Settlement[];partnerServices:PartnerService[];employees:Employee[];}
const options=(items:Array<string|number>)=>items.map(x=>({value:String(x),label:String(x)}));
function fieldsFor(dialog:FormDialog,data:Source):{title:string;submit:string;fields:Field[]}{
  const inv=data.invoices.find(x=>x.id===dialog.id);
  const st=data.settlements.find(x=>x.id===dialog.id);
  switch(dialog.kind){
    case 'company':return {title:'Add company',submit:'Create company',fields:[{name:'name',label:'Company name'},{name:'hr_email',label:'HR contact email',type:'email'}]};
    case 'plan-create':return {title:'Create credit plan',submit:'Save plan',fields:[{name:'name',label:'Plan name'},{name:'credits',label:'Credits per month',type:'number',min:'1'},{name:'monthly_price',label:'Monthly price (ALL)',type:'number',min:'0',step:'0.01'}]};
    case 'partner-invite':return {title:'Invite business partner',submit:'Send activation invitation',fields:[{name:'name',label:'Business name'},{name:'zone',label:'Location / zone'},{name:'contact_name',label:'Business contact name'},{name:'contact_email',label:'Business contact email',type:'email'}]};
    case 'product-create':return {title:'Create credit package',submit:'Publish package',fields:[{name:'name',label:'Package name'},{name:'credits',label:'Credits included',type:'number',min:'1'},{name:'price',label:'Price (ALL)',type:'number',min:'0.01',step:'0.01'}]};
    case 'employee':return {title:'Invite an employee',submit:'Record invitation',fields:[{name:'full_name',label:'Full name'},{name:'email',label:'Email address',type:'email'},{name:'company_id',label:'Company',type:'select',options:data.companies.map(c=>({value:String(c.id),label:c.name}))},{name:'plan_id',label:'Credit plan',type:'select',options:data.plans.map(p=>({value:String(p.id),label:`${p.name} · ${p.credits} credits`}))}]};
    case 'invoice':return {title:'New company invoice',submit:'Record invoice',fields:[{name:'company_id',label:'Company',type:'select',options:data.companies.map(c=>({value:String(c.id),label:c.name}))},{name:'period',label:'Billing period',type:'month',defaultValue:month()},{name:'reference',label:'Invoice reference'},{name:'amount',label:'Total amount (ALL)',type:'number',min:'0',step:'0.01'},{name:'due_date',label:'Due date',type:'date'}]};
    case 'service':return {title:'New partner service',submit:'Publish service',fields:[{name:'name',label:'Service name'},{name:'group_name',label:'Category',type:'select',options:Object.entries(labels).map(([value,label])=>({value,label}))},{name:'subcategory',label:'Subcategory'},{name:'credits',label:'Credits per visit',type:'number',min:'1'},{name:'payout',label:'Partner payout (ALL)',type:'number',min:'0',step:'0.01'},{name:'duration_minutes',label:'Duration (minutes)',type:'number',min:'1',defaultValue:60},{name:'description',label:'Description',type:'textarea'}]};
    case 'slot':return {title:'Publish a class time',submit:'Add slot',fields:[{name:'start_at',label:'Start date and time',type:'datetime-local'},{name:'capacity',label:'Available places',type:'number',min:'1',defaultValue:8}]};
    case 'adjust':return {title:'Adjust employee credits',submit:'Record adjustment',fields:[{name:'amount',label:'Credit change (+ or −)',type:'number',step:'1'},{name:'reason',label:'Reason for correction'}]};
    case 'invoice-status':return {title:`Update invoice ${inv?.reference||''}`,submit:'Update invoice',fields:[{name:'status',label:'Status',type:'select',defaultValue:inv?.status,options:options(['DRAFT','SENT','PAID','OVERDUE','CANCELLED'])},{name:'payment_reference',label:'Payment reference',required:false,defaultValue:inv?.payment_reference||''}]};
    case 'settlement-status':return {title:`Update settlement · ${st?.partner||''}`,submit:'Save settlement',fields:[{name:'status',label:'Status',type:'select',defaultValue:st?.status,options:options(['DRAFT','REVIEW','DISPUTED','FINAL','INVOICED','PAID'])},{name:'invoice_reference',label:'Partner invoice reference',defaultValue:st?.invoice_reference||'',required:false},{name:'payment_reference',label:'Payment reference',defaultValue:st?.payment_reference||'',required:false}]};
  }
}
export function ActionDialog({dialog,data,onClose,onSuccess}:{dialog:FormDialog;data:Source;onClose:()=>void;onSuccess:()=>void}){
  const {token,notify}=useApp();const [busy,setBusy]=useState(false);const {title,submit,fields}=fieldsFor(dialog,data);
  async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const f=Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string,string>;let path='';let body:Record<string,unknown>={...f};
    switch(dialog.kind){
      case 'company':path='/admin/companies';break;
      case 'partner-invite':path='/admin/partners';break;
      case 'plan-create':path='/admin/plans';body={name:f.name,credits:Number(f.credits),monthly_price_cents:Math.round(Number(f.monthly_price)*100)};break;
      case 'product-create':path='/admin/client-products';body={name:f.name,credits:Number(f.credits),price_cents:Math.round(Number(f.price)*100)};break;
      case 'employee':path='/admin/employees';body={...f,company_id:Number(f.company_id),plan_id:Number(f.plan_id)};break;
      case 'invoice':path='/admin/invoices';body={company_id:Number(f.company_id),period:f.period,reference:f.reference,amount_cents:Math.round(Number(f.amount)*100),due_date:f.due_date};break;
      case 'invoice-status':path=`/admin/invoices/${dialog.id}/status`;break;
      case 'service':path='/partner/services';body={name:f.name,group_name:f.group_name,subcategory:f.subcategory,credits:Number(f.credits),payout_cents:Math.round(Number(f.payout)*100),duration_minutes:Number(f.duration_minutes),description:f.description};break;
      case 'slot':path='/partner/slots';body={service_id:dialog.id,start_at:new Date(f.start_at).toISOString(),capacity:Number(f.capacity)};break;
      case 'adjust':path='/admin/adjust-credits';body={user_id:dialog.id,amount:Number(f.amount),reason:f.reason};break;
      case 'settlement-status':path=`/admin/settlements/${dialog.id}/status`;break;
    }
    try{await post(path,token,body);onSuccess();}catch(err){notify((err as Error).message,true)}finally{setBusy(false)}
  }
  return <Modal title={title} onClose={onClose}><form className="form-grid" style={{marginTop:20}} onSubmit={save}>
    {fields.map(field=><label key={field.name} className={`form-field ${field.type==='textarea'?'full':''}`}>{field.label}
      {field.type==='select'?<select className="select" name={field.name} defaultValue={field.defaultValue} required={field.required!==false}>{field.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:field.type==='textarea'?<textarea rows={3} className="input" name={field.name} defaultValue={field.defaultValue} required={field.required!==false}/>:<input className="input" name={field.name} type={field.type||'text'} step={field.step} min={field.min} defaultValue={field.defaultValue} required={field.required!==false}/>}
    </label>)}
    <div className="form-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Saving...':submit}</button></div>
  </form></Modal>;
}
