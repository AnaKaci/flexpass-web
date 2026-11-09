import {Link} from 'react-router-dom';
import {UIIcon} from './UIIcon';

const collections=[
  {
    name:'Restore',
    eyebrow:'WELLNESS & RESTORATION',
    description:'Space to slow down.',
    image:'hero-spa.webp',
    alt:'Illustrative Mediterranean spa courtyard with soft light and natural materials'
  },
  {
    name:'Move',
    eyebrow:'PILATES & MOVEMENT',
    description:'Find your own rhythm.',
    image:'hero-pilates.webp',
    alt:'Illustrative sunlit Pilates studio with refined, calm interiors'
  },
  {
    name:'Play',
    eyebrow:'SPORT & ACTIVE LEISURE',
    description:'Make room for something new.',
    image:'hero-padel.webp',
    alt:'Illustrative Mediterranean padel court surrounded by greenery'
  }
] as const;

/**
 * Editorial public-home sections only. Experience imagery is conceptual,
 * and the purchase copy reflects the current bank-transfer request model.
 */
export function HomeStory(){
  return <>
    <section className="home-editorial-collections" aria-labelledby="home-collections-title">
      <div className="home-editorial-wrap">
        <div className="home-editorial-introduction">
          <div className="home-editorial-label">THE EXPERIENCES</div>
          <div className="home-editorial-heading">
            <h2 id="home-collections-title">Make space for <em>what moves you.</em></h2>
            <p>Wellbeing is personal. Some days call for stillness; others for movement, play or discovering something new. FlexPass brings those possibilities together, so you can choose what suits your everyday.</p>
          </div>
        </div>
        <div className="home-collection-grid">
          {collections.map(item=><figure className="home-collection" key={item.name}>
            <div className="home-collection-image">
              <img
                src={`${import.meta.env.BASE_URL}brand/${item.image}`}
                alt={item.alt}
                loading="lazy"
                decoding="async"
              />
            </div>
            <figcaption className="home-collection-caption">
              <span>{item.eyebrow}</span>
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </figcaption>
          </figure>)}
        </div>
        <p className="home-editorial-photo-note">Imagery is illustrative and does not represent specific FlexPass partner venues.</p>
      </div>
    </section>

    <section className="home-editorial-journey" aria-labelledby="home-journey-title">
      <div className="home-editorial-wrap">
        <div className="home-editorial-journey-heading">
          <div className="home-editorial-label">THE FLEXPASS EXPERIENCE</div>
          <h2 id="home-journey-title">Your time, <em>your way.</em></h2>
          <p>Choose an experience, make space in your schedule, and return whenever something inspires you.</p>
        </div>
        <div className="home-editorial-steps">
          <div className="home-editorial-step">
            <span className="home-editorial-step-word">Discover</span>
            <h3>Follow your interests.</h3>
            <p>Explore wellness, fitness, sport and lifestyle experiences, with available sessions and credit costs clearly shown.</p>
          </div>
          <div className="home-editorial-step">
            <span className="home-editorial-step-word">Choose</span>
            <h3>Make room for more.</h3>
            <p>Request a credit package that fits your plans. Credits are issued once payment has been verified.</p>
          </div>
          <div className="home-editorial-step">
            <span className="home-editorial-step-word">Experience</span>
            <h3>Enjoy the everyday.</h3>
            <p>Use your available credits to book sessions and manage reservations in your Client account.</p>
          </div>
        </div>
      </div>
    </section>

    <section className="home-editorial-invitation" aria-labelledby="home-invitation-title">
      <div className="home-editorial-wrap">
        <header className="home-editorial-invitation-heading">
          <span className="home-editorial-label">A FLEXIBLE EVERYDAY</span>
          <h2 id="home-invitation-title">A place for <em>every possibility.</em></h2>
        </header>
        <div className="home-editorial-portals">
          <div className="home-editorial-portal">
            <span>FOR CLIENTS</span>
            <h3>More moments for you.</h3>
            <p>Explore the collection, discover available sessions and manage your FlexPass experiences in one place.</p>
            <Link to="/login/client">Client login <UIIcon name="arrow" size={18}/></Link>
          </div>
          <div className="home-editorial-portal">
            <span>FOR BUSINESS PARTNERS</span>
            <h3>Share what you do best.</h3>
            <p>Manage your listed services, upcoming reservations and the experiences you offer through FlexPass.</p>
            <Link to="/login/business">Business login <UIIcon name="arrow" size={18}/></Link>
          </div>
        </div>
      </div>
    </section>
  </>;
}
