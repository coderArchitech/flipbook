import {Worker} from 'node:worker_threads';
import {existsSync} from 'node:fs';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {get,all,run,tx,now,dataDir} from './db.mjs';
import {assetIds,fontIds,validateDocument} from '../shared/document.mjs';
import {renderPrint} from '../shared/render.mjs';
import {builtinFontFiles} from '../shared/fonts.mjs';
export const fontPaths=Object.fromEntries(builtinFontFiles().map(f=>[f.name,resolve('node_modules/@fontsource/'+f.pkg+'/files/'+f.file)]));
export function enqueue(userId,pubId,versionId,kind){const id=randomUUID();run('INSERT OR IGNORE INTO jobs(id,user_id,publication_id,version_id,kind,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',id,userId,pubId,versionId,kind,now(),now());return get('SELECT * FROM jobs WHERE version_id=? AND kind=?',versionId,kind);}
export async function inspectAndRender(doc,{pdf=false,userId}={}){
  const assets={};
  for(const id of assetIds(doc)){const asset=get('SELECT * FROM assets WHERE id=? AND user_id=?',id,userId);if(!asset)throw new Error('An image is no longer available.');assets[id]={path:asset.path,width:asset.width,height:asset.height};}
  const customFonts={};
  for(const id of fontIds(doc)){const font=get('SELECT * FROM fonts WHERE id=? AND user_id=?',id,userId);if(!font)throw new Error('A font is no longer available.');customFonts[id]=font.path;}
  const worker=new Worker(new URL('./pdf-worker.mjs',import.meta.url),{execArgv:[],workerData:{document:doc,assets,fonts:fontPaths,customFonts},resourceLimits:{maxOldGenerationSizeMb:384}});
  return new Promise((resolve,reject)=>{
    let done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);worker.terminate();if(error)reject(error);else resolve(value);};
    const timer=setTimeout(()=>finish(new Error('Rendering exceeded the 180 second limit.')),180000);
    worker.on('message',message=>{if(message.error){const e=new Error(message.error);if(message.findings)e.findings=message.findings;finish(e);}else finish(null,pdf?Buffer.from(message.bytes):null);});
    worker.on('error',error=>finish(error));worker.on('exit',code=>{if(!done)finish(new Error('PDF worker exited before completing ('+code+').'));});
  });
}
let busy=false,stopping=false;
export function startWorker(){
  const tick=async()=>{
    if(busy||stopping)return;busy=true;let job;
    try{
      job=tx(()=>{const j=get("SELECT * FROM jobs WHERE (status='queued' AND run_at<=?) OR (status='running' AND lease_until<?) ORDER BY CASE kind WHEN 'publish' THEN 0 ELSE 1 END,created_at LIMIT 1",Date.now(),Date.now());if(!j)return null;const lease=randomUUID();run("UPDATE jobs SET status='running',stage='Checking content',attempts=attempts+1,lease=?,lease_until=?,updated_at=? WHERE id=?",lease,Date.now()+60000,now(),j.id);return {...j,lease,attempts:j.attempts+1};});
      if(!job)return;
      const heartbeat=setInterval(()=>run('UPDATE jobs SET lease_until=? WHERE id=? AND lease=? AND status=?',Date.now()+60000,job.id,job.lease,'running'),15000);
      try{
        const version=get('SELECT * FROM versions WHERE id=?',job.version_id),pub=get('SELECT * FROM publications WHERE id=?',job.publication_id);
        if(!pub||pub.state!=='active'||(job.kind==='publish'&&pub.generation!==version.generation)){run("UPDATE jobs SET status='cancelled',stage='Superseded',updated_at=? WHERE id=? AND lease=?",now(),job.id,job.lease);return;}
        const doc=JSON.parse(version.document);const findings=validateDocument(doc,true);if(findings.length){const e=new Error('Complete the publication checklist.');e.findings=findings;throw e;}
        run('UPDATE jobs SET stage=? WHERE id=? AND lease=?',job.kind==='pdf'?'Rendering PDF':'Checking page layouts',job.id,job.lease);
        const bytes=await inspectAndRender(doc,{pdf:job.kind==='pdf',userId:job.user_id});
        let file=null;if(bytes){file=join(dataDir,'exports',job.version_id+'.'+job.lease+'.pdf');const temp=file+'.'+job.lease;await writeFile(temp,bytes,{mode:0o600});await rename(temp,file);}
        tx(()=>{
          const current=get('SELECT * FROM publications WHERE id=?',pub.id),lease=get('SELECT * FROM jobs WHERE id=?',job.id);
          if(lease.lease!==job.lease||lease.status!=='running')return;
          if(current.state!=='active'||(job.kind==='publish'&&current.generation!==version.generation)){run("UPDATE jobs SET status='cancelled',stage='Superseded' WHERE id=?",job.id);return;}
          if(job.kind==='publish'){run("UPDATE versions SET status='ready' WHERE id=?",version.id);run('UPDATE publications SET live_version=?,updated_at=? WHERE id=?',version.id,now(),pub.id);enqueue(job.user_id,pub.id,version.id,'pdf');}
          run("UPDATE jobs SET status='succeeded',stage='Ready',path=?,error=NULL,updated_at=? WHERE id=?",file,now(),job.id);
        });
      }catch(e){
        const retry=!e.findings&&job.attempts<3;
        run('UPDATE jobs SET status=?,stage=?,error=?,run_at=?,updated_at=? WHERE id=? AND lease=?',retry?'queued':'failed',retry?'Waiting to retry':'Needs attention',JSON.stringify({message:e.message,findings:e.findings||[]}),Date.now()+job.attempts*10000,now(),job.id,job.lease);
        if(!retry&&job.kind==='publish')run("UPDATE versions SET status='failed' WHERE id=? AND status='building'",job.version_id);
        console.error(JSON.stringify({event:'job_error',jobId:job.id,message:e.message}));
      }finally{clearInterval(heartbeat);}
    }catch(e){console.error(JSON.stringify({event:'worker_error',message:e.message}));}finally{busy=false;}
  };
  const interval=setInterval(tick,1000);tick();return()=>{stopping=true;clearInterval(interval);};
}
