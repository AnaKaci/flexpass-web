import type {CreditProduct} from './types';
import {money} from './api';
import {UIIcon} from './UIIcon';
import {BrandLogo} from './BrandLogo';

export function CreditShop({
  products,
  balance,
  onPurchase,
}:{
  products:CreditProduct[];
  balance:number;
  onPurchase:(product:CreditProduct)=>void;
}){
  return <section className="credit-shop" aria-labelledby="credit-shop-heading">
    <header className="credit-shop-intro">
      <div className="credit-shop-intro-copy">
        <span className="credit-shop-eyebrow">FLEXPASS <span aria-hidden="true">/</span> YOUR MEMBERSHIP</span>
        <h1 id="credit-shop-heading">Credit <em>packages.</em></h1>
        <p>Choose credits for your FlexPass experiences.</p>
      </div>
      <div className="credit-shop-balance" aria-label={`Current available balance: ${balance} credits`}>
        <UIIcon name="wallet" size={22}/>
        <span><small>YOUR AVAILABLE BALANCE</small><strong>{balance} <span>credits</span></strong></span>
      </div>
    </header>

    <div className="credit-shop-section-heading">
      <div>
        <span className="credit-shop-section-index">YOUR OPTIONS</span>
        <h2>Make more room for <em>you.</em></h2>
      </div>
      <p>Select the package that suits the experiences you want to explore.</p>
    </div>

    {products.length?
    <div className="credit-shop-card-grid">
      {products.map((product,index)=><article key={product.id} className={`credit-package ${index===Math.floor(products.length/2)&&products.length>1?'credit-package-emphasis':''}`}>
        <div className="credit-package-top">
          <span className="credit-package-index">PACKAGE {String(index+1).padStart(2,'0')}</span>
          <BrandLogo variant="monogram" tone={index===Math.floor(products.length/2)&&products.length>1?"ivory":"teal"} className="credit-package-monogram" decorative/>
        </div>
        <h3>{product.name}</h3>
        <div className="credit-package-credits">
          <strong>{product.credits}</strong>
          <span>FLEXPASS CREDITS</span>
        </div>
        <div className="credit-package-divider" aria-hidden="true"/>
        <div className="credit-package-details">
          <div><span>Package</span><strong>{product.name}</strong></div>
          <div><span>Credits included</span><strong>{product.credits}</strong></div>
          <div><span>Payment method</span><strong>Bank transfer request</strong></div>
        </div>
        <div className="credit-package-bottom">
          <span className="credit-package-price-label">PACKAGE PRICE</span>
          <div className="credit-package-price"><strong>{money(product.price_cents)}</strong></div>
          <button type="button" className="credit-package-request" onClick={()=>onPurchase(product)}>
            Request package <UIIcon name="arrow" size={17}/>
          </button>
          <p>No payment is collected when you request a package.</p>
        </div>
      </article>)}
    </div>:
    <div className="credit-shop-empty" role="status">
      <UIIcon name="info" size={25}/>
      <h3>No packages available yet.</h3>
      <p>No credit packages have been published yet.</p>
    </div>}


  </section>;
}
