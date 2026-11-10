import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');

const sections={
  client:['overview','shop','discover','orders','bookings','wallet'],
  partner:['overview','calendar','reservations','services','settlements'],
  admin:['overview','clients','partners','products','orders','settlements','audit'],
};

test('all three roles have URL-addressable dashboard sections and overview redirects',()=>{
  for(const role of Object.keys(sections)){
    assert.ok(app.includes(`<Route path="/${role}" element={<Navigate to="/${role}/overview" replace/>}/>`),role+' overview');
    assert.ok(app.includes(`<Route path="/${role}/:section" element={<Authenticated role="${role}"/>}/>`),role+' routes');
    for(const section of sections[role]){
      assert.ok(dashboard.includes(`['${section}',`),'missing sidebar section '+role+':'+section);
    }
  }
  assert.ok(app.includes('<Route path="/employee/:section" element={<EmployeeSectionRedirect/>}/>'));
  assert.ok(app.includes('<Route path="/admin/login" element={<Login portal="admin"/>}/>'));
});

test('selected section derives from URL, not volatile component state',()=>{
  assert.ok(dashboard.includes('useParams<{section:string}>()'));
  assert.ok(dashboard.includes("menu[role].some(([slug])=>slug===routeSection)"));
  assert.ok(!dashboard.includes("useState<Section>('overview')"));
  assert.ok(!dashboard.includes('setSection('));
  assert.ok(dashboard.includes('navigate(`/${role}/${next}`)'));
  assert.ok(dashboard.includes('if(routeSection&&!menu[role].some'));
  assert.ok(dashboard.includes('navigate(`/${role}/overview`,{replace:true})'));
});

test('internal dashboard links, purchases and booking callbacks update URL as well',()=>{
  assert.ok(dashboard.includes('onClick={()=>changeSection(name)}'));
  assert.ok(dashboard.includes("changeSection('orders');refresh()"));
  assert.ok(dashboard.includes("changeSection('bookings');refresh()"));
  assert.ok(dashboard.includes('onSection={changeSection}'));
  assert.ok(dashboard.includes('if(isNarrowScreen)setSidebarOpen(false)'));
  assert.ok(app.includes('sessionStorage.getItem(TOKEN_KEY)'));
  assert.ok(app.includes("request<User>('/auth/me',token)"));
});
