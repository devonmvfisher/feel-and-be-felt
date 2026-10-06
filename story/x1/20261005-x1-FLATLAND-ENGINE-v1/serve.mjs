import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]??fileURLToPath(new URL('./flatland-engine',import.meta.url))),port=Number(process.argv[3]??8041);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.wasm':'application/wasm'};
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+name+(name.endsWith('/')?'index.html':''));if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end('Outside site root');return;}const info=await stat(file);if(!info.isFile())throw new Error('Not a file');res.writeHead(200,{'Content-Type':types[path.extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});res.end(await readFile(file));}catch{res.writeHead(404);res.end('File not found');}});
server.listen(port,'127.0.0.1',()=>console.log('Flatland static files: http://127.0.0.1:'+port+' (Ctrl+C stops).'));
