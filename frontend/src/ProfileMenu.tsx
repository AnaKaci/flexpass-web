import {useEffect,useRef,useState} from 'react';
import type {User} from './types';
import {UIIcon} from './UIIcon';

/** Sidebar account menu. Hover on pointer devices; click/focus for touch and keyboard. */
export function ProfileMenu({user,onSignOut}:{user:User;onSignOut:()=>void}){
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);

  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{
      if(!container.current?.contains(event.target as Node))setOpen(false);
    };
    document.addEventListener('pointerdown',dismiss);
    return()=>document.removeEventListener('pointerdown',dismiss);
  },[open]);

  const roleName=user.role==='partner'?'Business partner':user.role==='admin'?'Administrator':'Client';
  return <div ref={container} className={`sidebar-profile-menu ${open?'is-open':''}`}
    onPointerEnter={event=>{if(event.pointerType==='mouse')setOpen(true)}}
    onPointerLeave={event=>{if(event.pointerType==='mouse')setOpen(false)}}
    onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false)}}
    onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();event.stopPropagation()}}}>
    {open&&<div id="sidebar-account-menu" className="sidebar-profile-popover" aria-label="Account options">
      <div className="sidebar-profile-popover-heading">
        <span className="sidebar-profile-overline">YOUR PROFILE</span>
        <div className="sidebar-profile-popover-identity">
          <span className="sidebar-profile-menu-avatar" aria-hidden="true">{user.full_name.slice(0,1).toUpperCase()}</span>
          <span className="sidebar-profile-popover-text">
            <strong>{user.full_name}</strong>
            <small>{user.email}</small>
            <span className="sidebar-profile-role">{roleName}</span>
          </span>
        </div>
      </div>
      <button type="button" className="sidebar-profile-sign-out" onClick={onSignOut}>
        <UIIcon name="log-out" size={18}/>
        <span>Sign out</span>
      </button>
    </div>}
    <button ref={trigger} type="button" className="sidebar-profile-trigger"
      aria-label={`Account: ${user.full_name}. Show profile and sign out`}
      aria-expanded={open} aria-controls={open?'sidebar-account-menu':undefined}
      onClick={()=>setOpen(value=>!value)}>
      <span className="sidebar-profile-menu-avatar" aria-hidden="true">{user.full_name.slice(0,1).toUpperCase()}</span>
      <span className="sidebar-profile-trigger-text">
        <strong>{user.full_name}</strong>
        <small>{user.email}</small>
      </span>
      <UIIcon name="chevron" size={16} className={`sidebar-profile-chevron ${open?'is-open':''}`}/>
    </button>
  </div>;
}
