// Read-only, fictional preview data derived from backend/app.py's local demo seed.
// The public Pages build does not authenticate, reserve capacity or move credits.
import type { AppInfo, Group, Service } from './types';

export const previewInfo: AppInfo = {
  app: 'FlexPass', preview: true, seeded: true, demo_mode: true,
  groups: ['fitness', 'sport', 'wellness', 'glow', 'kids-family'],
  zones: ['Blloku', 'Komuna e Parisit', 'Arena', 'Liqeni i Thate', 'Myslym Shyri', 'Pazari i Ri', '21 Dhjetori', 'ABA Center', 'Farka', 'Air Albania'],
  subcategories: {
    fitness: ['Gyms', 'Pilates', 'Yoga', 'Zumba', 'CrossFit', 'Aerobics'],
    sport: ['Swimming', 'Tennis', 'Football', 'Martial Arts', 'Dance'],
    wellness: ['Spa', 'Massage', 'Sauna', 'Recovery'],
    glow: ['Facials', 'Hair', 'Beauty'],
    'kids-family': ['Kids Sports', 'Family Activities', 'Creative Play'],
  },
  tagline: 'Preview-only catalog of fictional experiences in Tirana.',
};
const partners: Array<[string, string]> = [
  ['FlexPass Fitness Studio', 'Blloku'],
  ['Urban Movement House', 'Komuna e Parisit'],
  ['Zen & Balance Studio', 'Arena'],
  ['Pulse Sports Club', '21 Dhjetori'],
  ['Wellness Corner', 'Myslym Shyri'],
  ['Glow Atelier', 'Pazari i Ri'],
  ['Family Activity Center', 'Farka'],
  ['Lake Pilates Studio', 'Liqeni i Thate'],
];
type Definition = [number, string, Group, string, number, number];
const definitions: Definition[] = [
  [0, 'Open Gym Session', 'fitness', 'Gyms', 3, 60],
  [0, 'Strength & Conditioning', 'fitness', 'CrossFit', 5, 50],
  [1, 'Pilates Reformer', 'fitness', 'Pilates', 5, 50],
  [1, 'Zumba Dance', 'fitness', 'Zumba', 3, 55],
  [2, 'Vinyasa Yoga', 'fitness', 'Yoga', 4, 60],
  [2, 'Low-Impact Aerobics', 'fitness', 'Aerobics', 3, 50],
  [3, 'Swimming Session', 'sport', 'Swimming', 5, 60],
  [3, 'Tennis Court', 'sport', 'Tennis', 5, 60],
  [3, 'Social Football', 'sport', 'Football', 4, 60],
  [4, 'Relaxing Massage', 'wellness', 'Massage', 7, 60],
  [4, 'Sauna & Recovery', 'wellness', 'Sauna', 5, 45],
  [4, 'Spa Access', 'wellness', 'Spa', 8, 90],
  [5, 'Skin Care Ritual', 'glow', 'Facials', 6, 50],
  [5, 'Beauty Express', 'glow', 'Beauty', 5, 45],
  [6, 'Kids Movement Class', 'kids-family', 'Kids Sports', 4, 60],
  [6, 'Creative Play Workshop', 'kids-family', 'Creative Play', 3, 60],
  [7, 'Mat Pilates', 'fitness', 'Pilates', 4, 55],
];
const samples: Service[] = definitions.map(([partnerIndex, name, group, subcategory, credits, duration_minutes], index) => ({
  id: index + 1,
  name, group, subcategory, credits, duration_minutes,
  description: `Explore a fictional ${duration_minutes}-minute ${name.toLowerCase()} experience in Tirana.`,
  partner: partners[partnerIndex][0], partner_id: partnerIndex + 1, zone: partners[partnerIndex][1],
  slots: [],
}));
export function previewCatalog(path: string): Service[] {
  const params = new URLSearchParams(path.split('?')[1] || '');
  const group = params.get('group') || '';
  const subcategory = params.get('subcategory') || '';
  const zone = params.get('zone') || '';
  const search = (params.get('search') || '').toLowerCase().trim();
  const maxCredits = Number(params.get('maxCredits') || 0);
  return samples.filter(s =>
    (!group || s.group === group) &&
    (!subcategory || s.subcategory === subcategory) &&
    (!zone || s.zone === zone) &&
    (!maxCredits || s.credits <= maxCredits) &&
    (!search || `${s.name} ${s.partner} ${s.description}`.toLowerCase().includes(search))
  );
}
