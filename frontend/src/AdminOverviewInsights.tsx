import type {AdminPartner,AuditRow,ClientRecord,Section} from './types';
import {dateTime} from './api';
import {Panel,StatusTag} from './App';
import {UIIcon} from './UIIcon';

interface Props{
  clients:ClientRecord[];
  partners:AdminPartner[];
  audit:AuditRow[];
  onSection:(section:Section)=>void;
}

/** Display-only summaries of already loaded /admin/clients, /admin/partners and /admin/audit. */
function AccountProgress({active,total,label}:{active:number;total:number;label:string}){
  const percent=total?Math.round(active/total*100):0;
  return <div className="admin-insights-progress">
    <div className="admin-insights-progress-label"><span>{label}</span><strong>{active} / {total}</strong></div>
    <div className="admin-insights-progress-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total||1} aria-valuenow={active}>
      <span style={{width:`${percent}%`}}/>
    </div>
  </div>;
}

function Initial({name}:{name:string}){
  return <span className="admin-insights-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()||'—'}</span>;
}

export function AdminOverviewInsights({clients,partners,audit,onSection}:Props){
  const activeClients=clients.filter(client=>client.status.toUpperCase()==='ACTIVE').length;
  const activePartners=partners.filter(partner=>partner.status.toUpperCase()==='ACTIVE').length;
  const recentAudit=[...audit].sort((a,b)=>(Date.parse(b.at)||0)-(Date.parse(a.at)||0)).slice(0,4);
  return <section className="admin-overview-insights" aria-label="Client and business records">
    <div className="admin-insights-grid">
      <Panel title="Client accounts" action={<button type="button" className="btn btn-tertiary btn-sm" onClick={()=>onSection('clients')}>All clients <UIIcon name="arrow" size={15}/></button>}>
        <p className="admin-insights-description">Existing client records, account status and purchased credit balances.</p>
        <AccountProgress active={activeClients} total={clients.length} label="Active client accounts"/>
        {clients.length?<ul className="admin-insights-list">{clients.slice(0,4).map(client=><li key={client.id}>
          <Initial name={client.name}/>
          <div className="admin-insights-identity"><strong>{client.name}</strong><small>{client.email}</small><small>{client.balance} credits · {client.orders} orders</small></div>
          <StatusTag status={client.status}/>
        </li>)}</ul>:<p className="admin-insights-empty">No client records yet.</p>}
      </Panel>
      <Panel title="Business partners" action={<button type="button" className="btn btn-tertiary btn-sm" onClick={()=>onSection('partners')}>All businesses <UIIcon name="arrow" size={15}/></button>}>
        <p className="admin-insights-description">Registered business accounts, locations and contact information.</p>
        <AccountProgress active={activePartners} total={partners.length} label="Active business partners"/>
        {partners.length?<ul className="admin-insights-list">{partners.slice(0,4).map(partner=><li key={partner.id}>
          <Initial name={partner.name}/>
          <div className="admin-insights-identity"><strong>{partner.name}</strong><small>{partner.zone} · {partner.accounts.length} contact accounts</small><small>{partner.accounts[0]?.email||'No contact email'}</small></div>
          <StatusTag status={partner.status}/>
        </li>)}</ul>:<p className="admin-insights-empty">No business records yet.</p>}
      </Panel>
    </div>
    <Panel title="Recent recorded activity" action={<button type="button" className="btn btn-tertiary btn-sm" onClick={()=>onSection('audit')}>Audit log <UIIcon name="arrow" size={15}/></button>}>
      {recentAudit.length?<ol className="admin-insights-activity">{recentAudit.map(item=><li key={item.id}>
        <span className="admin-insights-activity-marker" aria-hidden="true"><UIIcon name="activity" size={17}/></span>
        <div className="admin-insights-activity-copy"><strong>{item.action.replace(/_/g,' ')}</strong><span>{item.detail}</span></div>
        <div className="admin-insights-activity-meta"><time dateTime={item.at}>{dateTime(item.at)}</time><small>{item.actor_id===null?'System':`Actor #${item.actor_id}`}</small></div>
      </li>)}</ol>:<p className="admin-insights-empty">No recorded audit activity yet.</p>}
    </Panel>
  </section>;
}
