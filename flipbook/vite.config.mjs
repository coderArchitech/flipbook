import {defineConfig} from 'vite';
import {sharedBuildId} from './server/build-id.mjs';
export default defineConfig({define:{__SHARED_BUILD__:JSON.stringify(sharedBuildId())},server:{host:'127.0.0.1',port:5173,proxy:{'/fonts':'http://127.0.0.1:3000','/book-':'http://127.0.0.1:3000','/api':'http://127.0.0.1:3000','/m':'http://127.0.0.1:3000','/reader':'http://127.0.0.1:3000'}},build:{outDir:'dist'}});
