import sharp from 'sharp';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {dataDir,run,tx,now} from './db.mjs';
import {makeDocument,makePage,emptyProduct} from '../shared/document.mjs';
const illustrations=[
  {name:'The everyday vessel',summary:'A quiet ritual. Hand-finished stoneware with a soft matte glaze.',price:'38',category:'Objects',badge:'Studio favorite',bg:'#ddd5c7',art:'<ellipse cx="450" cy="650" rx="235" ry="38" fill="#b5ab98" opacity=".45"/><path d="M290 300h300l-25 290q-115 95-250 0z" fill="#b26545"/><ellipse cx="440" cy="300" rx="150" ry="40" fill="#db9875"/><ellipse cx="440" cy="300" rx="120" ry="25" fill="#593b2e"/><path d="M584 345c150-25 160 210-8 170" fill="none" stroke="#ac5b3e" stroke-width="38"/>'},
  {name:'Arc table light',summary:'Warm light, thoughtful curves. A sculptural accent for slow evenings.',price:'145',category:'Lighting',badge:'New arrival',bg:'#c7c9b8',art:'<ellipse cx="450" cy="700" rx="210" ry="28" fill="#a1a590"/><path d="M435 330h30v340h-30z" fill="#555749"/><ellipse cx="450" cy="673" rx="125" ry="26" fill="#626554"/><path d="M210 370q30-230 240-230t240 230z" fill="#e8dfb8"/><ellipse cx="450" cy="370" rx="240" ry="35" fill="#d0bf87"/>'},
  {name:'Sunday lounge chair',summary:'An invitation to pause. Solid oak and a naturally woven seat.',price:'420',category:'Furniture',badge:'Made to last',bg:'#d9b9a4',art:'<ellipse cx="450" cy="690" rx="260" ry="35" fill="#ba937b" opacity=".5"/><path d="M240 350l45-170h310l65 170-45 200H285z" fill="#976a45"/><path d="M285 215h265l50 155H260z" fill="#d9bd8c"/><path d="M250 410h370l-25 120H275z" fill="#dfc797"/><path d="M280 530l-30 155m340-155 35 155" stroke="#745034" stroke-width="30"/>'},
  {name:'Linen, naturally',summary:'Soft texture, subtle color. European linen that gets better with time.',price:'62',category:'Textiles',badge:'Small batch',bg:'#d8d4c8',art:'<ellipse cx="450" cy="680" rx="240" ry="32" fill="#aaa699" opacity=".3"/><path d="M240 220l360 35 50 390-390-20z" fill="#e6d7b7"/><path d="M300 245l220 20 45 340-240-15z" fill="#b4bda4"/><path d="M340 260l10 320m50-315 15 320m45-310 22 315" stroke="#7e9076" stroke-width="2" opacity=".5"/>'}
];
export async function seedWorkspace(user){
  const products=[];const assets=[];
  for(const item of illustrations){
    const id=randomUUID();const file=join(dataDir,'assets',id+'.webp');
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900"><rect width="900" height="900" fill="'+item.bg+'"/>'+item.art+'</svg>';
    const bytes=await sharp(Buffer.from(svg)).webp({quality:88}).toBuffer();await writeFile(file,bytes,{mode:0o600});
    assets.push({id,file,bytes:bytes.length,name:item.name});
    products.push({...emptyProduct(),name:item.name,summary:item.summary,description:item.summary+'\n\nThoughtfully chosen for the spaces we call home. Each piece brings together considered materials, useful details, and enduring design.',price:item.price,category:item.category,badge:item.badge,url:'https://example.com',images:[id]});
  }
  const doc=makeDocument('The considered collection');doc.publisher=user.name+' Studio';doc.subtitle='Everyday objects. Extraordinary details.';
  doc.pages[0].blocks[1].assetId=assets[2].id;doc.pages[0].blocks[1].alt='A sculptural wooden lounge chair';
  const grid=makePage('grid');grid.blocks.slice(1).forEach((b,i)=>b.product=products[i]);doc.pages.push(grid);
  const story=makePage('story');story.blocks[1].assetId=assets[0].id;story.blocks[1].alt='Hand-finished terracotta stoneware';doc.pages.push(story);
  doc.pages.push(makePage('closing'));
  tx(()=>{
    for(const a of assets)run('INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?,?)',a.id,user.id,a.name,a.file,a.file,'image/webp',900,900,a.bytes,now());
    for(const p of products)run('INSERT INTO products VALUES(?,?,?,?,?,?)',randomUUID(),user.id,JSON.stringify(p),1,now(),now());
    run('INSERT INTO publications(id,user_id,slug,title,document,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',randomUUID(),user.id,'the-considered-collection-'+randomUUID().slice(0,8),doc.title,JSON.stringify(doc),now(),now());
  });
}
