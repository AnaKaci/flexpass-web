import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const searchSource=readFileSync(new URL('../src/clientServiceSearch.ts',import.meta.url),'utf8');
const explore=readFileSync(new URL('../src/ClientExplore.tsx',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');
const styles=readFileSync(new URL('../src/client-explore.css',import.meta.url),'utf8');

const compiled=ts.transpileModule(searchSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};
vm.runInNewContext(compiled,{
  exports,
  require:(name)=>{
    assert.equal(name,'./api');
    return {labels:{fitness:'Fitness',sport:'Sport',wellness:'Wellness',glow:'Glow','kids-family':'Kids & Family'}};
  }
});
const filter=exports.filterExploreServices;
const services=[
  {id:1,name:'Pilâtés Reformer',partner:'Vita Studio',subcategory:'Pilates',description:'Guided movement',zone:'Blloku',group:'fitness',slots:[{id:1,available:3}]},
  {id:2,name:'Deep Tissue Massage',partner:'Calm & Co',subcategory:'Massage',description:'Recovery and restoration',zone:'Tirana',group:'wellness',slots:[]},
  {id:3,name:'Kids Art Workshop',partner:'Atelier Familja',subcategory:'Creative arts',description:'Painting and games',zone:'Komuna e Parisit',group:'kids-family',slots:[]},
];

test('search matches service names, provider names, location, subcategories and descriptions',()=>{
  assert.equal(filter(services,'pilates').map(s=>s.id).join(','),'1');
  assert.equal(filter(services,'VITA STUDIO').map(s=>s.id).join(','),'1');
  assert.equal(filter(services,'blloku').map(s=>s.id).join(','),'1');
  assert.equal(filter(services,'recovery').map(s=>s.id).join(','),'2');
  assert.equal(filter(services,'massage').map(s=>s.id).join(','),'2');
  assert.equal(filter(services,'kids family').map(s=>s.id).join(','),'3');
});

test('search is accent tolerant, whitespace tolerant and supports mixed-field terms',()=>{
  assert.equal(filter(services,'PILÂTES').map(s=>s.id).join(','),'1');
  assert.equal(filter(services,'  PILATES   Blloku  ').map(s=>s.id).join(','),'1');
  assert.equal(filter(services,'vita pilates').map(s=>s.id).join(','),'1');
  assert.equal(filter(services,'tIrAnA massage').map(s=>s.id).join(','),'2');
  assert.equal(filter(services,'pilates massage').length,0);
  assert.equal(filter(services,'nonexistent service').length,0);
});

test('empty search preserves the original catalog without mutating source records',()=>{
  const base=services.map(s=>s.id).join(',');
  assert.equal(filter(services,'').map(s=>s.id).join(','),base);
  assert.equal(filter(services,'   ').map(s=>s.id).join(','),base);
  assert.equal(services.map(s=>s.id).join(','),base);
});

test('Client Explore searches the full active catalog across categories, not the selected category only',()=>{
  assert.ok(dashboard.includes("get<Service[]>('/catalog')"),'full active service catalog must already load');
  assert.ok(dashboard.includes('allServices={data.featuredCatalog}'));
  assert.ok(explore.includes('const results=hasSearch?filterExploreServices(allServices,search):catalog;'));
  assert.ok(explore.includes('results.map(service=><ServiceCard'));
  assert.ok(explore.includes('results.reduce((count,item)=>count+item.slots.filter'));
  assert.ok(explore.includes('<strong>{results.length}</strong>'));
  assert.ok(explore.includes("!hasSearch&&category===item.key?'is-active':''"));
  assert.ok(explore.includes('onClick={()=>selectCategory(item.key)}'));
  assert.ok(explore.includes("if(search)updateSearch('');"));
});

test('search input is accessible, persists across refresh, and supports clear and empty-result states',()=>{
  assert.ok(explore.includes('useSearchParams()'));
  assert.ok(explore.includes("params.get('q')||''"));
  assert.ok(explore.includes("nextParams.set('q',value)"));
  assert.ok(explore.includes("nextParams.delete('q')"));
  assert.ok(explore.includes('setParams(nextParams,{replace:true})'));
  assert.ok(explore.includes('role="search"'));
  assert.ok(explore.includes('htmlFor="client-explore-search-input"'));
  assert.ok(explore.includes('type="search" value={search}'));
  assert.ok(explore.includes('onChange={event=>updateSearch(event.target.value)}'));
  assert.ok(explore.includes('aria-label="Clear experience search"'));
  assert.ok(explore.includes('No matching experiences.'));
  assert.ok(explore.includes("onClick={()=>updateSearch('')}>Clear search"));
  assert.ok(explore.includes('Searching all collections.'));
  assert.ok(styles.includes('.client-explore-search-control:focus-within'));
  assert.ok(styles.includes('@media(max-width:720px)'));
  assert.ok(styles.includes('@media(prefers-reduced-motion:reduce)'));
  assert.ok(!styles.includes('.home-page'));
});
