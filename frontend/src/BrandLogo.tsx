/** Supplied official FlexPass artwork, preserved as SVG paths. */
export function BrandLogo({
  variant='full',
  tone='teal',
  className='',
  decorative=false
}:{
  variant?:'full'|'monogram';
  tone?:'teal'|'ivory';
  className?:string;
  decorative?:boolean;
}){
  const file=`flexpass-${variant}${tone==='ivory'?'-ivory':''}.svg`;
  return <img
    className={`official-brand-logo official-brand-logo-${variant} ${className}`.trim()}
    src={`${import.meta.env.BASE_URL}brand/${file}`}
    alt={decorative?'':variant==='full'?'FlexPass':'FlexPass FP monogram'}
    aria-hidden={decorative||undefined}
    decoding="async"
    draggable={false}
  />;
}
