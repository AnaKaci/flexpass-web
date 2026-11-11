import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const css=readFileSync(new URL('../src/dashboard-gradient.css',import.meta.url),'utf8');
const entry=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
const brand=readFileSync(new URL('../src/brand.css',import.meta.url),'utf8');
const dashboard=readFileSync(new URL('../src/Dashboard.tsx',import.meta.url),'utf8');

test('Client, Partner and Admin dashboards share the supplied lily-and-silk background',()=>{
  for(const variable of ['--ivory','--paper','--blush','--mist']){
    assert.ok(brand.includes(variable+':'),'missing FlexPass brand token '+variable);
  }
  assert.match(css,/\.dashboard-app-shell \.dashboard-main\{[\s\S]*?background-image:/);
  assert.ok(css.includes("url('./assets/Blush Silk and Lily Serenity.png')"));
  assert.ok(!css.includes('.dashboard-app-shell:has(> .dashboard-client-sidebar) .dashboard-main{'),
    'client-only background overrides would hide the shared artwork');
  assert.ok(!css.includes('.quiet-home'));
  assert.ok(!css.includes('.auth-photo-stage'));
  const assets=[
    'Blush Silk and Lily Serenity.png',
    'Abstract Teal Satin Wave Texture.png',
    'Tranquil Turquoise Caustic Waves.png',
    'Warm Plaster Archway Geometry.png',
    'blush_pink_recreated_4K.png',
  ];
  const optimized=['blush-silk-lily.webp','deep-teal-satin.webp','turquoise-caustics.webp','warm-plaster-arch.webp','blush-palm-shadows.webp'];
  for(const [index,name] of assets.entries()){
    assert.ok(css.includes("url('./optimized/"+optimized[index]+"')"),'missing optimized image reference '+name);
    const image=readFileSync(new URL('../src/assets/'+name,import.meta.url));
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a','invalid original PNG '+name);
    assert.ok(image.length>100_000,'original image is unexpectedly small '+name);
  }
  assert.ok(!css.includes("url('./assets/client-card-textures.jpg')"),'low-resolution sprite must not be used');
  assert.ok(!css.includes("url('./assets/blush-silk-lily-dashboard.webp')"),'old compressed background must not be used');
});

test('dashboard background is not covered by ivory content or mobile navigation strips',()=>{
  assert.ok(css.includes('.dashboard-app-shell .dashboard-main .dash-content,'));
  assert.ok(css.includes('.dashboard-app-shell .dashboard-main .dashboard-nav-opener{'));
  assert.ok(css.includes('background:transparent;'));
  assert.ok(dashboard.includes('className="dash-main dashboard-main"'));
  const names=[...entry.matchAll(/import '\.\/(.*?)\.css';/g)].map(m=>m[1]);
  assert.ok(names.indexOf('dashboard-gradient')>names.indexOf('auth-login'),'gradient must load after global and auth styles');
  assert.deepEqual(names.slice(-2),['dashboard-gradient','sidebar-motion'],'only scoped sidebar motion may follow dashboard gradient');
});
