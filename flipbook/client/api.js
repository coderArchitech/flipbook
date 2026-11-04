export let csrf='';
export const setCsrf=value=>csrf=value;
// The server's shared-code build (X-Flipbook-Build). A server without the
// header predates this check, so it is older than the editor too.
const editorBuild=typeof __SHARED_BUILD__==='string'?__SHARED_BUILD__:null;
let serverBuild;const buildListeners=new Set();
function noteServerBuild(response){if(!editorBuild||import.meta.env?.DEV)return;const build=response.headers.get('X-Flipbook-Build')||'none';if(build===serverBuild)return;serverBuild=build;buildListeners.forEach(f=>f(serverOutdated()));}
// null when they match; 'server' when the server predates build checks; 'different' otherwise.
export const serverOutdated=()=>!serverBuild||serverBuild===editorBuild?null:serverBuild==='none'?'server':'different';
export const onServerBuild=f=>{buildListeners.add(f);return()=>buildListeners.delete(f);};
export async function api(path,{method='GET',body,key,...rest}={}){
  const response=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,...(method!=='GET'?{'Idempotency-Key':key||crypto.randomUUID()}:{})},body:body===undefined?undefined:JSON.stringify(body),...rest});
  noteServerBuild(response);
  const data=await response.json();if(!response.ok){const error=new Error(data.error||'Request failed.');Object.assign(error,data,{status:response.status});throw error;}return data;
}
export function uploadImage(file,progress=()=>{}){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST','/api/assets');xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-CSRF-Token',csrf);xhr.setRequestHeader('X-File-Name',encodeURIComponent(file.name));xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100));};xhr.onerror=()=>reject(new Error('Upload interrupted. Please retry.'));xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return reject(new Error('Upload failed.'));}if(xhr.status>=400)reject(new Error(data.error||'Upload failed.'));else resolve(data);};xhr.send(file);});}
export async function uploadFont(file){const response=await fetch('/api/fonts',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-CSRF-Token':csrf,'X-File-Name':encodeURIComponent(file.name)},body:file});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Font upload failed.');return data;}
export const imageUrl=id=>'/api/assets/'+id;
export const navigate=path=>{location.hash=path;};
