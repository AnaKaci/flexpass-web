import type { LoginResult } from './types';
import { previewCatalog, previewInfo } from './preview';
export const pagesPreview = import.meta.env.VITE_GITHUB_PAGES === 'true';
export const TOKEN_KEY = 'flexpass_demo_token';
export async function request<T>(path:string, token = '', options:RequestInit = {}):Promise<T> {
  if (pagesPreview) {
    if (path === '/info') return previewInfo as T;
    if (path.startsWith('/catalog')) return previewCatalog(path) as T;
    throw new Error('Read-only GitHub Pages preview: logins, bookings and credits need the separately hosted API.');
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error(`Unexpected response from API (${response.status}).`); }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' && 'detail' in payload ? (payload as {detail:unknown}).detail : `HTTP ${response.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return payload as T;
}
export function post<T>(path:string, token:string, body:Record<string,unknown> = {}):Promise<T> {
  return request<T>(path, token, {method:'POST', body:JSON.stringify(body)});
}
export function login(email:string, password:string):Promise<LoginResult> { return post<LoginResult>('/auth/login','',{email,password}); }
export const month = () => new Date().toISOString().slice(0,7);
export const money = (cents:number) => `${new Intl.NumberFormat('en-AL', {maximumFractionDigits:0}).format((cents || 0)/100)} ALL`;
export const shortDate = (value:string) => new Date(value).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});
export const dateTime = (value:string) => new Date(value).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
export const labels = {fitness:'Fitness',sport:'Sport',wellness:'Wellness',glow:'Glow','kids-family':'Kids & Family'} as const;
export const icons = {fitness:'🏋️',sport:'🎾',wellness:'🧘',glow:'✨','kids-family':'🎨'} as const;
