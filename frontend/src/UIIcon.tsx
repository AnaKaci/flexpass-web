import type {SVGProps} from 'react';

/** Consistent outlined interface icon set. Purely decorative when adjacent to a visible label. */
export type IconName='overview'|'compass'|'calendar'|'clock'|'wallet'|'receipt'|'users'|'store'|'layers'|'shield'|'check'|'filter'|'search'|'arrow'|'spark'|'list'|'activity'|'credit'|'settings'|'menu'|'close'|'refresh'|'location'|'info'|'chevron'|'log-out';
export function UIIcon({name,size=19,...props}:{name:IconName;size?:number}&Omit<SVGProps<SVGSVGElement>,'children'>){
  const common={fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common} {...props}>
    {name==='overview'&&<><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>}
    {name==='compass'&&<><circle cx="12" cy="12" r="9"/><path d="m16.3 7.7-2.6 6-6 2.6 2.6-6Z"/></>}
    {name==='calendar'&&<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 17h4"/></>}
    {name==='clock'&&<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    {name==='wallet'&&<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z"/><path d="M3 9V6a2 2 0 0 1 2-2h13"/></>}
    {name==='receipt'&&<><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M8 8h8M8 12h8M8 16h5"/></>}
    {name==='users'&&<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>}
    {name==='store'&&<><path d="M4 10V21h16V10M3 10l2-7h14l2 7a3 3 0 0 1-5 2 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-5-2Z"/><path d="M9 21v-7h6v7"/></>}
    {name==='layers'&&<><path d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5"/></>}
    {name==='shield'&&<><path d="m12 2 8 4v6c0 5-3 8-8 10-5-2-8-5-8-10V6l8-4Z"/><path d="m9 12 2 2 4-4"/></>}
    {name==='check'&&<><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>}
    {name==='filter'&&<><path d="M3 5h18l-7 8v6l-4 2v-8Z"/></>}
    {name==='search'&&<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>}
    {name==='arrow'&&<><path d="M4 12h15m-6-6 6 6-6 6"/></>}
    {name==='spark'&&<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></>}
    {name==='list'&&<><path d="M9 6h12M9 12h12M9 18h12M3 6h2M3 12h2M3 18h2"/></>}
    {name==='activity'&&<><path d="M2 12h4l3-7 5 14 3-7h5"/></>}
    {name==='credit'&&<><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h4"/></>}
    {name==='settings'&&<><circle cx="12" cy="12" r="3"/><path d="m19 13 2-1-2-1-.8-2 1-2-2-2-2 1-2-.8-1-2-1 2-2 .8-2-1-2 2 1 2-.8 2-2 1 2 1 .8 2-1 2 2 2 2-1 2 .8 1 2 1-2 2-.8 2 1 2-2-1-2Z"/></>}
    {name==='menu'&&<path d="M4 6h16M4 12h16M4 18h16"/>}
    {name==='close'&&<path d="M5 5 19 19M19 5 5 19"/>}
    {name==='refresh'&&<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 12-3L20 12M4 12l2.4 6a7 7 0 0 0 12-3"/></>}
    {name==='location'&&<><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>}
    {name==='info'&&<><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></>}
    {name==='chevron'&&<path d="m9 5 7 7-7 7"/>}
    {name==='log-out'&&<><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></>}
  </svg>;
}
