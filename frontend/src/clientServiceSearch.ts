import type {Service} from './types';
import {labels} from './api';

/** Normalize case, accents and whitespace for service and business name matching. */
function normalize(value:string):string{
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/\s+/g,' ').trim();
}

/** Search only the live catalog supplied by the authenticated API.
 * Each word may match a different service attribute (e.g. "pilates blloku").
 */
export function filterExploreServices(services:ReadonlyArray<Service>,query:string):Service[]{
  const words=normalize(query).split(' ').filter(Boolean);
  if(!words.length)return [...services];
  return services.filter(service=>{
    const searchable=normalize([
      service.name,
      service.partner,
      service.subcategory,
      service.description,
      service.zone,
      labels[service.group],
      service.group.replace(/-/g,' ')
    ].join(' '));
    return words.every(word=>searchable.includes(word));
  });
}
