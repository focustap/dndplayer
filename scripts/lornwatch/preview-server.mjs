import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Installed only for the explicitly requested, localhost-only preview command.
export function chapterPreviewPlugin(){return {name:'local-chapter-preview',configureServer(server){
  const root=fileURLToPath(new URL('../../outputs/lornwatch/',import.meta.url));
  server.middlewares.use('/__lornwatch',async(req,res)=>{
    const relative=decodeURIComponent((req.url??'').split('?')[0]).replace(/^\/+/,''),path=resolve(root,relative);
    if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!['GET','HEAD'].includes(req.method??'')){res.statusCode=403;res.end();return;}
    try{const info=await stat(path);if(!info.isFile())throw new Error('not a file');res.setHeader('Content-Type',path.endsWith('.json')?'application/json':'image/png');res.setHeader('Cache-Control','no-store');createReadStream(path).pipe(res);}catch{res.statusCode=404;res.end('Preview asset missing');}
  });
}};}
