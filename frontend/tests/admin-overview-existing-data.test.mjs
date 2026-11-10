import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const insights=readFileSync(new URL('../src/AdminOverviewInsights.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/admin-overview-insights.css',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('Admin Overview uses only previously loaded admin client, business and audit data',()=>{
  for(const api of ["get<ClientRecord[]>('/admin/clients')","get<AdminPartner[]>('/admin/partners')","get<AuditRow[]>('/admin/audit')"]){
    assert.ok(dashboard.includes(api),api);
  }
  assert.ok(dashboard.includes("<AdminOverviewInsights clients={data.clients} partners={data.partners} audit={data.audit} onSection={onSection}/>"));
  assert.ok(insights.includes('clients:ClientRecord[]'));
  assert.ok(insights.includes('partners:AdminPartner[]'));
  assert.ok(insights.includes('audit:AuditRow[]'));
  assert.ok(insights.includes('clients.slice(0,4)'));
  assert.ok(insights.includes('partners.slice(0,4)'));
  assert.ok(insights.includes('recentAudit=[...audit].sort'));
  for(const field of ['client.name','client.email','client.balance','client.orders','client.status',
                      'partner.name','partner.zone','partner.accounts.length','partner.status',
                      'item.action','item.detail','item.at']){
    assert.ok(insights.includes(field),field);
  }
  for(const dummy of ['app1Projects','app1Activity','Task throughput','Completion rate','Team members','+2 from last month']){
    assert.ok(!insights.includes(dummy),dummy);
  }
  assert.ok(!insights.includes('fetch('));
  assert.ok(!insights.includes('request('));
});

test('Existing Admin Overview KPIs, original record pages, and navigation remain intact',()=>{
  for(const section of ['clients','partners','products','orders','settlements','audit']){
    assert.ok(dashboard.includes(`if(section==='${section}')`));
  }
  for(const panel of ['Operations at a glance','Latest payment requests','Operational snapshot','Payment verification']){
    assert.ok(dashboard.includes(panel),panel);
  }
  for(const page of ["role==='client'","role==='partner'","role==='admin'"]){
    assert.ok(dashboard.includes(page),page);
  }
  for(const tab of ["onSection('clients')","onSection('partners')","onSection('audit')"]){
    assert.ok(insights.includes(tab),tab);
  }
});

test('New panels reuse existing brand typography and dashboard components',()=>{
  assert.ok(insights.includes("import {Panel,StatusTag} from './App'"));
  assert.ok(insights.includes('className="admin-overview-insights"'));
  assert.ok(styles.includes('var(--ivory)')===false);
  for(const color of ['var(--teal)','var(--teal-dark)','var(--blush)','var(--mist)','var(--warm-gray)']){
    assert.ok(styles.includes(color),color);
  }
  assert.ok(!styles.includes('font-family:'));
  assert.ok(!styles.includes('.home-page'));
  assert.ok(!styles.includes('.auth-photo-stage'));
  const names=[...entry.matchAll(/import '\.\/(.*?)\.css';/g)].map(x=>x[1]);
  assert.ok(names.indexOf('admin-overview-insights')>names.indexOf('auth-login'));
  assert.deepEqual(names.slice(-2),['dashboard-gradient','sidebar-motion']);
});
