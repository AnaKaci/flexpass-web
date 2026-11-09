import type {Group,Service,EmployeeSummary} from './types';
import {labels} from './api';
import {ServiceCard} from './ServicesPage';
import {UIIcon} from './UIIcon';
import {BrandLogo} from './BrandLogo';
import type {IconName} from './UIIcon';

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
  onService,
  summary,
  onWallet
}:{
  category:Group;
  onCategory:(v:Group)=>void;
  catalog:Service[];
  onService:(s:Service)=>void;
  summary:EmployeeSummary;
  onWallet:()=>void;
}){
  const openSessions=catalog.reduce((count,item)=>count+item.slots.filter(slot=>slot.available>0).length,0);
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
        <img src={`${import.meta.env.BASE_URL}brand/arch-view.jpg`} alt="Mediterranean stone arch framing calm blue water" decoding="async"/>
        <span className="client-explore-visual-caption">WELLBEING, YOUR WAY</span>
      </div>
    </section>

    <section className="client-explore-collection" id="client-explore-collection" aria-labelledby="client-explore-category-heading">
      <div className="client-explore-section-intro">
        <div>
          <span className="client-explore-section-kicker">01 / DISCOVER</span>
          <h2 id="client-explore-category-heading">Choose what moves you.</h2>
          <p>Explore experiences across our five collections.</p>
        </div>
        <span className="client-explore-editorial-aside">WELLNESS <span aria-hidden="true">·</span> MOVEMENT <span aria-hidden="true">·</span> LIFESTYLE</span>
      </div>

      <div className="client-explore-categories" role="group" aria-label="Experience categories">
        {categories.map(item=><button type="button" key={item.key}
          className={`client-explore-category ${category===item.key?'is-active':''}`}
          aria-pressed={category===item.key}
          onClick={()=>onCategory(item.key)}>
          <UIIcon name={item.icon} size={23}/>
          <span className="client-explore-category-text"><strong>{labels[item.key]}</strong><small>{item.note}</small></span>
          <UIIcon name="arrow" size={16}/>
        </button>)}
      </div>

      <div className="client-explore-results-heading">
        <div>
          <span className="client-explore-section-kicker">02 / EXPERIENCE LIST</span>
          <h2>{labels[category]} <em>experiences</em></h2>
        </div>
        <div className="client-explore-results-meta" role="status">
          <strong>{catalog.length}</strong> {catalog.length===1?'experience':'experiences'}
          <span aria-hidden="true">·</span>
          <strong>{openSessions}</strong> available session {openSessions===1?'time':'times'}
        </div>
      </div>
      {catalog.length
        ?<div className="services-grid client-explore-service-grid">
          {catalog.map(service=><ServiceCard service={service} onSelect={onService} key={service.id}/>)}
        </div>
        :<div className="client-explore-empty" role="status">
          <UIIcon name="calendar" size={29}/>
          <h3>Nothing available here just yet.</h3>
          <p>Explore another collection to find your next experience.</p>
          <button type="button" className="btn btn-outline" onClick={()=>onCategory('fitness')}>Browse Fitness <UIIcon name="arrow" size={16}/></button>
        </div>
      }
    </section>
  </div>;
}
