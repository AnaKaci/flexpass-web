import {mkdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import sharp from 'sharp';

// Keep the originals untouched; create high-quality, full-resolution browser assets.
const source=fileURLToPath(new URL('../src/assets/',import.meta.url));
const destination=fileURLToPath(new URL('../src/optimized/',import.meta.url));
const images=[
  [
    "Blush Silk and Lily Serenity.png",
    "blush-silk-lily.webp"
  ],
  [
    "Abstract Teal Satin Wave Texture.png",
    "deep-teal-satin.webp"
  ],
  [
    "Tranquil Turquoise Caustic Waves.png",
    "turquoise-caustics.webp"
  ],
  [
    "Warm Plaster Archway Geometry.png",
    "warm-plaster-arch.webp"
  ],
  [
    "blush_pink_recreated_4K.png",
    "blush-palm-shadows.webp"
  ]
];
await mkdir(destination,{recursive:true});
for(const [input,output] of images){
  const sourceFile=join(source,input);
  const outputFile=join(destination,output);
  const original=await stat(sourceFile);
  let current;
  try{current=await stat(outputFile)}catch{current=null}
  if(current&&current.mtimeMs>=original.mtimeMs&&current.size>0)continue;
  const pipeline=sharp(sourceFile);
  // This decorative texture appears in small cards: 1600px is ample for high-DPI rendering.
  // Its 3540px original remains unchanged in the repository.
  if(input==='blush_pink_recreated_4K.png')pipeline.resize({width:1600,withoutEnlargement:true});
  const result=await pipeline.webp({quality:92,effort:5,smartSubsample:true}).toFile(outputFile);
  console.log(`Optimized ${input}: ${Math.round(original.size/1024)} KB → ${Math.round(result.size/1024)} KB (${result.width}×${result.height})`);
}
