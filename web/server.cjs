'use strict';
// The local server serves the tabletop edition with the shared rule engine.
const fs = require('node:fs');
const path = require('node:path');
const {createServer: originalServer} = require('./game/game_server.cjs');
const ROOT = __dirname;
const Testing = require('./src/tabletop-v4-testing.js');
function createServer(options={}) {
  const server = originalServer({base:path.join(ROOT,'game'), html:path.join(ROOT,'standalone.html'), ...options});
  const metricsDir=path.join(options.saveDir||process.env.GAME_SAVE_DIR||path.join(ROOT,'game/rooms'),'metrics');
  fs.mkdirSync(metricsDir,{recursive:true});
  const original = server.listeners('request')[0];
  server.removeListener('request', original);
  server.on('request', (req,res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
    catch { res.writeHead(400); res.end(); return; }
    if(pathname.startsWith('/api/')){
      const end=res.end;
      res.end=function(chunk,...args){
        if(res.statusCode===200&&typeof chunk==='string'){
          try{const value=JSON.parse(chunk);if(value.view&&/^[A-F0-9]{10}$/.test(value.room)){
            const file=path.join(metricsDir,value.room+'.json');let previous=null;try{previous=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}
            value.metrics=Testing.observe(previous,value.view,value.startedAt);
            if(JSON.stringify(previous)!==JSON.stringify(value.metrics)){fs.writeFileSync(file+'.tmp',JSON.stringify(value.metrics));fs.renameSync(file+'.tmp',file);}
            chunk=JSON.stringify(value);
          }}catch(error){console.error('Statistics unavailable:',error.message);}
        }
        return end.call(this,chunk,...args);
      };
    }
    const asset = /^\/assets\/[a-zA-Z0-9_-]+\.webp$/.test(pathname) || /^\/assets\/home-wonder-W\d\d\.png$/.test(pathname);
    const previewV4 = pathname==='/preview-v4';
    const source = ['/source/tabletop-v4.css','/source/tabletop-v4-controller.js','/source/tabletop-v4-board.js','/source/tabletop-v4-assist.js','/source/tabletop-v4-testing.js','/source/tabletop-v4-network.js'].includes(pathname);
    if (!asset && !source && !previewV4) return original(req,res);
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end();return; }
    const file=previewV4?path.join(ROOT,'standalone.html'):source?path.join(ROOT,'src',pathname.slice('/source/'.length)):path.join(ROOT,pathname.slice(1));
    fs.stat(file,(error,stat)=>{
      if(error||!stat.isFile()){res.writeHead(404);res.end();return;}
      const type=pathname.endsWith('.png')?'image/png':asset?'image/webp':previewV4?'text/html; charset=utf-8':pathname.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';
      res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
      if(req.method==='HEAD')return res.end();
      fs.createReadStream(file).on('error',()=>res.destroy()).pipe(res);
    });
  });
  return server;
}
if(require.main===module){
  const server=createServer();
  const port=Number(process.env.PORT||8788),host=process.env.HOST||'127.0.0.1';
  server.listen(port,host,()=>console.log('更迭 · 可视化版 http://'+host+':'+port));
  const stop=()=>server.close(()=>process.exit(0));
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
module.exports={createServer};
