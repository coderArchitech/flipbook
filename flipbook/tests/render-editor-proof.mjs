// Reproducible, synthetic PDF proof; never reads or modifies an existing workspace.
import {startTestServer} from './server-fixture.mjs';
import {mkdir,writeFile,readFile,rm,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {renderPDF} from '../server/pdf-render.mjs';
import {upgradeDocument,newElement} from '../shared/editor-commands.mjs';
import {makePage,uid} from '../shared/document.mjs';
const server=await startTestServer(),dir=await mkdtemp(join(tmpdir(),'flipbook-proof-'));
try{
 const auth=await fetch(server.url+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Edition Studio',email:'proof@example.test',password:'proof-only-local-2026'})});
 const cookie=auth.headers.get('set-cookie').split(';')[0];
 const get=async path=>fetch(server.url+'/api'+path,{headers:{Cookie:cookie}});
 const seed=(await (await get('/publications')).json())[0];const doc=upgradeDocument((await (await get('/publications/'+seed.id)).json()).document);
 const items=await (await get('/assets')).json(),assets={};
 for(const a of items){const path=join(dir,a.id+'.webp');await writeFile(path,Buffer.from(await (await get('/assets/'+a.id)).arrayBuffer()));assets[a.id]={path,width:a.width,height:a.height};}
 const fonts={};for(const [name,family,weight,style] of [['sans','dm-sans',400,'normal'],['sans-bold','dm-sans',700,'normal'],['sans-italic','dm-sans',400,'italic'],['sans-bold-italic','dm-sans',700,'italic'],['serif','instrument-serif',400,'normal'],['serif-italic','instrument-serif',400,'italic']])fonts[name+'.woff2']=resolve(`node_modules/@fontsource/${family}/files/${family}-latin-${weight}-${style}.woff2`);
 doc.title='The art of everyday';doc.publisher='EDITION STUDIO';doc.brand.accent='#a45132';doc.pages=[makePage('blank'),makePage('blank')];
 const [p,q]=doc.pages;p.title='The art of everyday';q.title='Objects with a story';
 p.background={type:'gradient',color:'#f4eddf',color2:'#d6dfc8',angle:135};
 p.blocks=[{...newElement('text',[0,1,12,2]),size:14,text:'EDITION 04 / OBJECTS & RITUALS',textStyle:{font:'sans',letterSpacing:2}},
 {...newElement('text',[0,4,12,5]),size:58,text:'The art of everyday',richText:[{kind:'paragraph',runs:[{text:'The art of ',italic:true},{text:'everyday',color:'#a45132'}]}]},
 {...newElement('image',[1,10,10,16]),assetId:items[0].id,alt:items[0].name,crop:{x:50,y:50,zoom:1.2},appearance:{frame:'ellipse',rotation:3}},
 {...newElement('text',[1,27,10,4]),size:20,text:'A slower morning. A thoughtful object.\nSmall things, beautifully considered.',richText:[{kind:'paragraph',runs:[{text:'A slower morning. A thoughtful object.',bold:true}]},{kind:'paragraph',runs:[{text:'Small things, beautifully considered.',href:'https://example.com/collection',underline:true}]}]},
 {...newElement('shape',[10,26,2,3]),shape:'star',appearance:{fill:'#a45132',opacity:.85}},
 {...newElement('hotspot',[1,31,8,2]),label:'Explore the collection',showLabel:true,action:{kind:'page',pageId:q.id}}];
 q.background={type:'solid',color:'#faf7ef'};
 q.blocks=[{...newElement('text',[0,0,12,3]),size:42,text:'Objects with a story'},
 {...newElement('gallery',[0,4,12,13]),images:items.slice(0,3).map(a=>({assetId:a.id,alt:a.name})),columns:3,gap:12},
 {...newElement('text',[0,18,5,11]),size:20,text:'Thoughtful materials\nConsidered details\nMade for everyday living',richText:[{kind:'bullet',runs:[{text:'Thoughtful materials',bold:true}]},{kind:'bullet',runs:[{text:'Considered details'}]},{kind:'bullet',runs:[{text:'Made for everyday living'}]}]},
 {...newElement('media',[6,18,6,13]),mediaKind:'video',url:'https://example.com/studio-film',title:'Inside the studio',description:'Meet the makers behind the collection.',posterId:items[2].id}];
 const master={id:uid(),name:'Edition footer',blocks:[{...newElement('text',[0,34,12,2]),size:12,text:'EDITION STUDIO                                      {{page}} / {{pages}}',textStyle:{font:'sans',letterSpacing:1}}]};doc.masters=[master];doc.pages.forEach(p=>{p.masterId=master.id;p.footer=false;});
 await mkdir('verification',{recursive:true});await writeFile('verification/editor-proof.pdf',await renderPDF({document:doc,assets,fonts}));console.log('verification/editor-proof.pdf');
}finally{await server.stop();await rm(dir,{recursive:true,force:true});}
