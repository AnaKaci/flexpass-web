import {useSearchParams} from 'react-router-dom';
import type {Group,Service,EmployeeSummary} from './types';
import {labels} from './api';
import {ServiceCard} from './ServicesPage';
import {UIIcon} from './UIIcon';
import {BrandLogo} from './BrandLogo';
import type {IconName} from './UIIcon';
import {filterExploreServices} from './clientServiceSearch';

const categories:ReadonlyArray<{key:Group;icon:IconName;note:string}>= [
  {key:'fitness',icon:'activity',note:'Strength & movement'},
  {key:'sport',icon:'compass',note:'Play & performance'},
  {key:'wellness',icon:'spark',note:'Rest & renewal'},
  {key:'glow',icon:'layers',note:'Care & beauty'},
  {key:'kids-family',icon:'users',note:'Time together'}
];

export function ClientExplore({
  category,
  onCategory,
  catalog,
  allServices,
  onService,
  summary,
  onWallet
}:{
  category:Group;
  onCategory:(v:Group)=>void;
  catalog:Service[];
  allServices:Service[];
  onService:(s:Service)=>void;
  summary:EmployeeSummary;
  onWallet:()=>void;
}){
  const [params,setParams]=useSearchParams();
  const search=params.get('q')||'';
  const hasSearch=Boolean(search.trim());
  const results=hasSearch?filterExploreServices(allServices,search):catalog;
  const openSessions=results.reduce((count,item)=>count+item.slots.filter(slot=>slot.available>0).length,0);
  function updateSearch(next:string){
    const nextParams=new URLSearchParams(params);
    const value=next.slice(0,120);
    if(value.trim())nextParams.set('q',value);
    else nextParams.delete('q');
    setParams(nextParams,{replace:true});
  }
  function selectCategory(next:Group){
    if(search)updateSearch('');
    onCategory(next);
  }
  return <div className="client-explore-page">
    <section className="client-explore-hero" aria-labelledby="client-explore-heading">
      <div className="client-explore-hero-content">
        <span className="client-explore-eyebrow"><BrandLogo variant="monogram" tone="ivory" className="client-explore-official-monogram" decorative/> THE FLEXPASS COLLECTION</span>
        <div className="client-explore-hero-copy">
          <h1 id="client-explore-heading">Make room for <em>more.</em></h1>
          <p>Find your next moment of movement, restoration or discovery. Your everyday, on your terms.</p>
          <a className="client-explore-hero-link" href="#client-explore-collection">
            Explore experiences <UIIcon name="arrow" size={18}/>
          </a>
        </div>
        <div className="client-explore-hero-bottom">
          <span>A FLEXIBLE EVERYDAY</span>
          <button type="button" className="client-explore-balance" onClick={onWallet} aria-label={`View wallet with ${summary.balance} available credits`}>
            <UIIcon name="wallet" size={20}/>
            <span><small>YOUR WALLET</small><strong>{summary.balance} <span>credits</span></strong></span>
            <UIIcon name="arrow" size={16}/>
          </button>
        </div>
      </div>
      <div className="client-explore-hero-visual">
        <img
          src="https://images.unsplash.com/photo-1781455495642-63c87143b8eb?auto=format&amp;fit=crop&amp;w=2000&amp;q=88"
          srcSet="https://images.unsplash.com/photo-1781455495642-63c87143b8eb?auto=format&amp;fit=crop&amp;w=900&amp;q=85 900w, https://images.unsplash.com/photo-1781455495642-63c87143b8eb?auto=format&amp;fit=crop&amp;w=1600&amp;q=88 1600w, https://images.unsplash.com/photo-1781455495642-63c87143b8eb?auto=format&amp;fit=crop&amp;w=2400&amp;q=88 2400w"
          sizes="(max-width: 720px) 100vw, 46vw"
          alt="Sunlit white Mediterranean terrace overlooking the blue Aegean Sea"
          loading="eager"
          decoding="async"
        />
        <span className="client-explore-visual-caption">WELLBEING, YOUR WAY</span>
      </div>
    </section>

    <section className="client-explore-collection" id="client-explore-collection" aria-labelledby="client-explore-category-heading">
      <div className="client-explore-section-intro">
        <div>
          <span className="client-explore-section-kicker">DISCOVER</span>
          <h2 id="client-explore-category-heading">Choose what moves you.</h2>
          <p>Explore experiences across our five collections.</p>
        </div>
        <span className="client-explore-editorial-aside">WELLNESS <span aria-hidden="true">·</span> MOVEMENT <span aria-hidden="true">·</span> LIFESTYLE</span>
      </div>

      <div className="client-explore-categories" role="group" aria-label="Experience categories">
        {categories.map(item=><button type="button" key={item.key}
          className={`client-explore-category ${!hasSearch&&category===item.key?'is-active':''}`}
          aria-pressed={!hasSearch&&category===item.key}
          onClick={()=>selectCategory(item.key)}>
          <UIIcon name={item.icon} size={23}/>
          <span className="client-explore-category-text"><strong>{labels[item.key]}</strong><small>{item.note}</small></span>
          <UIIcon name="arrow" size={16}/>
        </button>)}
      </div>

      <div className="client-explore-search" role="search">
        <label htmlFor="client-explore-search-input">Find an experience or business</label>
        <div className="client-explore-search-control">
          <UIIcon name="search" size={21}/>
          <input id="client-explore-search-input" type="search" value={search}
            onChange={event=>updateSearch(event.target.value)}
            maxLength={120} autoComplete="off"
            placeholder="Search services, businesses, wellness, locations…"
            aria-describedby="client-explore-search-hint"/>
          {hasSearch&&<button type="button" className="client-explore-search-clear" onClick={()=>updateSearch('')} aria-label="Clear experience search">
            Clear <UIIcon name="close" size={15}/>
          </button>}
        </div>
        <p id="client-explore-search-hint">{hasSearch
          ?'Searching all collections. Select a category above to return to browsing.'
          :'Search across every business and experience, regardless of category.'}</p>
      </div>

      <div className="client-explore-results-heading">
        <div>
          <span className="client-explore-section-kicker">EXPERIENCE LIST</span>
          <h2>{hasSearch?'Search results':labels[category]} <em>{hasSearch?'for you':'experiences'}</em></h2>
        </div>
        <div className="client-explore-results-meta" role="status">
          <strong>{results.length}</strong> {results.length===1?'experience':'experiences'}
          <span aria-hidden="true">·</span>
          <strong>{openSessions}</strong> available session {openSessions===1?'time':'times'}
        </div>
      </div>
      {results.length
        ?<div className="services-grid client-explore-service-grid">
          {results.map(service=><ServiceCard service={service} onSelect={onService} key={service.id}/>)}
        </div>
        :<div className="client-explore-empty" role="status">
          <UIIcon name="calendar" size={29}/>
          <h3>{hasSearch?'No matching experiences.':'Nothing available here just yet.'}</h3>
          <p>{hasSearch?'Try a different service name, business or location.':'Explore another collection to find your next experience.'}</p>
          {hasSearch
            ?<button type="button" className="btn btn-outline" onClick={()=>updateSearch('')}>Clear search <UIIcon name="arrow" size={16}/></button>
            :<button type="button" className="btn btn-outline" onClick={()=>selectCategory('fitness')}>Browse Fitness <UIIcon name="arrow" size={16}/></button>}
        </div>
      }
    </section>
  </div>;
}
