import type { Group } from './types';
/** Line icons derived from the FlexPass brand guide's minimal iconography. */
export function BrandIcon({group}:{group:Group}) {
  const common={fill:'none',stroke:'currentColor',strokeWidth:1.5,strokeLinecap:'round' as const,strokeLinejoin:'round' as const};
  return <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...common}>
    {group==='fitness'&&<><rect x="8" y="25" width="7" height="14" rx="2"/><rect x="17" y="21" width="6" height="22" rx="2"/><path d="M23 32h18"/><rect x="41" y="21" width="6" height="22" rx="2"/><rect x="49" y="25" width="7" height="14" rx="2"/></>}
    {group==='sport'&&<><ellipse cx="38" cy="23" rx="15" ry="19" transform="rotate(40 38 23)"/><path d="M28 36 11 54M24 43l8 8M28 11l21 23M21 17l21 23M33 7l-13 28M42 9 28 42"/></>}
    {group==='wellness'&&<><path d="M32 43c-13-8-13-20 0-32 13 12 13 24 0 32Z"/><path d="M30 43C15 46 8 38 10 23c11 0 17 7 20 20ZM34 43c15 3 22-5 20-20-11 0-17 7-20 20Z"/><path d="M12 42c8 8 19 10 20 10s12-2 20-10"/></>}
    {group==='glow'&&<><path d="M32 51S11 40 11 25c0-12 15-16 21-5 6-11 21-7 21 5 0 15-21 26-21 26Z"/><path d="M46 7v8M42 11h8"/></>}
    {group==='kids-family'&&<><path d="m32 5 5.5 16L54 26l-16.5 5.5L32 48l-5.5-16.5L10 26l16.5-5Z"/><path d="m48 44 2.5 7.5L58 54l-7.5 2.5L48 64l-2.5-7.5L38 54l7.5-2.5Z"/></>}
  </svg>;
}
