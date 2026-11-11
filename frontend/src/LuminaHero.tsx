import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {BrandLogo} from './BrandLogo';
import {UIIcon} from './UIIcon';

const SLIDE_MS=6800;

const EXPERIENCES=[
  {
    title:'The art of',
    accent:'feeling well.',
    eyebrow:'WELLNESS & RENEWAL',
    description:'Space for restoration, slow rituals and the moments that are entirely yours.',
    label:'Wellness',
    detail:'Rest & renew',
    image:'hero-spa.webp',
  },
  {
    title:'Move with',
    accent:'intention.',
    eyebrow:'PILATES & MOVEMENT',
    description:'Strength, balance and a little more time for the things that make you feel good.',
    label:'Pilates',
    detail:'Strength & balance',
    image:'hero-pilates.webp',
  },
  {
    title:'Find a moment',
    accent:'to breathe.',
    eyebrow:'YOGA & MINDFULNESS',
    description:'A quieter rhythm. Experiences that help you reconnect with your everyday.',
    label:'Yoga',
    detail:'Breathe & restore',
    image:'hero-yoga.webp',
  },
  {
    title:'Make space',
    accent:'to play.',
    eyebrow:'SPORT & ACTIVE LEISURE',
    description:'Movement made enjoyable, at a pace and in a way that feels like you.',
    label:'Active leisure',
    detail:'Move & play',
    image:'hero-padel.webp',
  }
] as const;

const assetPath=(name:string)=>`${import.meta.env.BASE_URL}brand/${name}`;

/**
 * Home-only, Lumina-inspired cinematic showcase.
 *
 * Intentionally built with React/CSS rather than injecting third-party GSAP
 * and Three.js scripts. It matches the interactive slide-list experience while
 * avoiding fragile CDN dependencies, WebGL support gaps and heavy animations.
 */
export function LuminaHero(){
  const [active,setActive]=useState(0);
  const [generation,setGeneration]=useState(0);
  const [paused,setPaused]=useState(false);
  // Load the visible slide first; fetch other slide images only when needed.
  const [loadedSlides,setLoadedSlides]=useState<Set<number>>(()=>new Set([0]));
  const [isVisible,setIsVisible]=useState(()=>typeof document==='undefined'||!document.hidden);
  const [reduceMotion,setReduceMotion]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const navRef=useRef<HTMLElement>(null);
  const selected=EXPERIENCES[active];

  useEffect(()=>{
    const query=window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange=()=>setReduceMotion(query.matches);
    query.addEventListener('change',onChange);
    return()=>query.removeEventListener('change',onChange);
  },[]);
  useEffect(()=>{
    const onVisibility=()=>setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>document.removeEventListener('visibilitychange',onVisibility);
  },[]);
  useEffect(()=>{
    if(paused||reduceMotion||!isVisible)return;
    const timeout=window.setTimeout(()=>{
      setActive(previous=>{
        const next=(previous+1)%EXPERIENCES.length;
        setLoadedSlides(loaded=>new Set(loaded).add(next));
        return next;
      });
      setGeneration(previous=>previous+1);
    },SLIDE_MS);
    return()=>window.clearTimeout(timeout);
  },[active,generation,paused,reduceMotion,isVisible]);

  useEffect(()=>{
    if(!isVisible||paused)return;
    const id=window.setTimeout(()=>{
      const next=(active+1)%EXPERIENCES.length;
      setLoadedSlides(previous=>previous.has(next)?previous:new Set(previous).add(next));
    },2400);
    return()=>window.clearTimeout(id);
  },[active,isVisible,paused]);

  function select(index:number){
    setLoadedSlides(previous=>new Set(previous).add(index));
    setActive(index);
    setGeneration(previous=>previous+1);
  }
  function photoFallback(event:React.SyntheticEvent<HTMLImageElement>){
    const image=event.currentTarget;
    const fallback=assetPath('arch-view.jpg');
    if(!image.src.endsWith('/arch-view.jpg'))image.src=fallback;
  }

  return <section className="lumina-hero" aria-labelledby="home-title">
    <div className="lumina-hero-copy">
      <div className="lumina-hero-top">
        <span className="lumina-hero-identity"><BrandLogo variant="monogram" tone="ivory" decorative/></span>
      </div>
  
      <div className="lumina-hero-main">
        <span className="lumina-hero-overline" key={`overline-${active}`}>{selected.eyebrow}</span>
        <div className="lumina-hero-text" key={`message-${active}`}>
          <h1 id="home-title">{selected.title}<br/><em>{selected.accent}</em></h1>
          <p>{selected.description}</p>
        </div>
        <div className="lumina-hero-actions" aria-label="FlexPass account access">
          <Link className="lumina-hero-entry lumina-hero-entry-primary" to="/login/client">Client login <UIIcon name="arrow" size={17}/></Link>
          <Link className="lumina-hero-entry lumina-hero-entry-secondary" to="/login/business">Business login <UIIcon name="arrow" size={17}/></Link>
        </div>
        <p className="lumina-hero-caption">More experiences. A more flexible everyday.</p>
      </div>
    </div>
    <div className="lumina-hero-media">
      {EXPERIENCES.map((item,index)=><img
        key={item.image}
        className={`lumina-hero-photo ${active===index?'is-active':''}`}
        src={loadedSlides.has(index)?assetPath(item.image):undefined}
        alt=""
        loading={index===active?'eager':'lazy'}
        decoding="async"
        fetchPriority={index===active?'high':'low'}
        onError={photoFallback}
      />)}
      <div className="lumina-hero-scrim"/>
    </div>

    <nav ref={navRef} className={`lumina-hero-navigation ${paused?'is-paused':''}`}
      aria-label="Explore FlexPass lifestyles"
      onPointerEnter={event=>{if(event.pointerType==='mouse')setPaused(true)}}
      onPointerLeave={event=>{if(event.pointerType==='mouse')setPaused(false)}}
      onFocusCapture={()=>setPaused(true)}
      onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setPaused(false)}}>
      {EXPERIENCES.map((item,index)=><button
        type="button"
        key={item.image}
        className={`lumina-hero-nav-item ${active===index?'is-active':''}`}
        aria-pressed={active===index}
        aria-label={`Show ${item.label}: ${item.detail}`}
        onPointerEnter={event=>{if(event.pointerType==='mouse')select(index)}}
        onFocus={()=>select(index)}
        onClick={()=>select(index)}>
        <span className="lumina-nav-progress-track">
          {active===index&&<span key={generation} className={`lumina-nav-progress-fill ${reduceMotion?'no-motion':''}`} style={{animationDuration:`${SLIDE_MS}ms`}}/>}
        </span>
        <span className="lumina-nav-row">
          <span className="lumina-nav-text"><strong>{item.label}</strong><small>{item.detail}</small></span>
          {active===index&&<UIIcon name="arrow" size={15}/>}
        </span>
      </button>)}
    </nav>
  </section>;
}
