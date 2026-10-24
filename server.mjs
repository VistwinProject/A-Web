import http from 'node:http';
import dgram from 'node:dgram';
import os from 'node:os';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {encodeOSC,decodeOSC,validateCommand,validateConfig as checkedConfig,validatePlayback} from './osc.mjs';
import {Playback} from './playback.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)), configPath=path.join(root,'config.json');
const pagesOrigin='https://vistwinproject.github.io';
const httpPort=Number(process.env.PORT||8788),defaultReplyPort=Number(process.env.OSC_REPLY_PORT||9202);
function validateConfig(input){return checkedConfig(input,defaultReplyPort);}
let config={host:'127.0.0.1',port:9200,replyPort:defaultReplyPort};try{config=validateConfig(JSON.parse(await readFile(configPath,'utf8')));}catch(error){if(error.code!=='ENOENT')console.error('Config:',error.message);}
const playbackPath=path.join(root,'playback.json'),playback=new Playback();
try{playback.configure(JSON.parse(await readFile(playbackPath,'utf8')).durations,Date.now());}catch(error){if(error.code!=='ENOENT')console.error('Playback:',error.message);}
let udp,live=null,receivedAt=0,lastSent=null,lastError='',count=0,operations=Promise.resolve(),primaryAt=0,handPending=false;
const primaryPending=new Map();
const handClients=new Map();
function send(address,args,target=config){return new Promise((resolve,reject)=>udp.send(encodeOSC(address,args),target.port,target.host,error=>{if(error){lastError=error.message;reject(error);}else resolve();}));}
function serialize(fn){const task=operations.then(fn);operations=task.catch(()=>{});return task;}
function receive(packet,peer){try{if(peer.address!==config.host)return;const data=decodeOSC(packet);if(data.address!=='/ac/web/state'||data.args.length!==1)return;const state=JSON.parse(data.args[0]);if(!Number.isInteger(state.sceneIndex)||state.sceneIndex<0||state.sceneIndex>4||![0,1].includes(state.view))return;const now=Date.now();playback.observe(state,now,!live||now-receivedAt>=3500);live=state;receivedAt=now;lastError='';for(const [kind,value] of primaryPending)if(state[kind==='scene'?'sceneIndex':'view']===value)primaryPending.delete(kind);if(state.sceneIndex!==2)handPending=false;}catch{}}
async function bindReply(port){const socket=dgram.createSocket('udp4');try{await new Promise((resolve,reject)=>{socket.once('error',reject);socket.bind(port,'0.0.0.0',()=>{socket.removeListener('error',reject);resolve();});});}catch(error){socket.close();throw Error(error.code==='EADDRINUSE'?'回傳 Port 已被其他程式使用，原設定保留':error.message);}socket.on('message',receive);socket.on('error',error=>{console.error(error);lastError=error.message;});return socket;}
function status(){const now=Date.now(),connected=Boolean(live&&now-receivedAt<3500);return {config,connected,ageMs:receivedAt?now-receivedAt:null,state:live?{...live,playback:playback.snapshot(now,connected)}:null,lastSent,count,lastError,replyPort:config.replyPort,urls:Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4'&&!x.internal).map(x=>`http://${x.address}:${httpPort}/A_ZONE_OSC.html`)};}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('Request too large');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 const origin=req.headers.origin;
 const allowed=!origin||origin===pagesOrigin||new URL(origin).host===req.headers.host;
 if(url.pathname.startsWith('/api/')){
  if(!allowed)return json(res,403,{error:'Origin denied'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){
   res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Private-Network':'true','Access-Control-Max-Age':'600'});return res.end();
  }
 }
 if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,status());
 if(req.method==='POST'){
  if(!allowed)return json(res,403,{error:'Origin denied'});
  const data=await body(req);
  if(url.pathname==='/api/action'){
   if(!['play','animation','reset'].includes(data.action))throw Error('Invalid action');
   await serialize(async()=>{
    if(!live||Date.now()-receivedAt>=3500)throw Error('A 主機未回報，請先確認連線');
    playback.action(data.action,Date.now());primaryPending.clear();handPending=false;primaryAt=Date.now();
    await send('/ac/sequence',[{play:0,animation:1,reset:2}[data.action]]);
    primaryPending.set(data.action==='reset'?'view':'scene',data.action==='reset'?0:data.action==='play'?0:3);
    count++;lastSent={address:'/ac/sequence',action:data.action,source:'primary',time:new Date().toISOString()};
    await send('/ac/web/ping',[config.replyPort]);
   });return json(res,200,{sent:true,action:data.action});
  }
  if(url.pathname==='/api/command'){
   const cmd=validateCommand(data.kind,data.value);
   cmd.address=config[data.kind+'Address']||cmd.address;
   if(data.kind==='mode'){
    await serialize(async()=>{
     if(data.value){if(!live||Date.now()-receivedAt>=3500)throw Error('A 主機未回報，請先確認連線');const address=config.sceneAddress||'/ac/scene';await send(address,[0]);primaryPending.set('scene',0);count++;lastSent={address,value:0,source:'auto-restart',time:new Date().toISOString()};}
     playback.mode(data.value,Date.now());primaryAt=Date.now();handPending=false;await send('/ac/web/ping',[config.replyPort]);
    });return json(res,200,{sent:true,handledBy:'relay',mode:data.value,restartScene:data.value?0:null});
   }
   await serialize(async()=>{if(Date.now()-receivedAt>=3500)throw Error('A 主機未回報，請先確認連線');if(data.kind==='scene')playback.command(cmd.value,Date.now());await send(cmd.address,[cmd.value]);primaryPending.set(data.kind,cmd.value);primaryAt=Date.now();handPending=false;count++;lastSent={...cmd,source:'primary',time:new Date().toISOString()};await send('/ac/web/ping',[config.replyPort]);});
   return json(res,200,{sent:true,...cmd});
  }
  if(url.pathname==='/api/hand'){
   if(![0,1].includes(data.value)||typeof data.clientId!=='string'||!data.clientId||data.clientId.length>100)throw Error('手勢需提供 clientId 與數字 0／1');
   const outcome=await serialize(async()=>{
    const previous=handClients.get(data.clientId)||{value:0,at:0};
    if(handClients.size>=512&&!handClients.has(data.clientId))handClients.delete(handClients.keys().next().value);
    handClients.set(data.clientId,{value:data.value,at:Date.now()});
    if(data.value===0||previous.value===1)return {sent:false,reason:'放開或重複訊號'};
    if(Date.now()-receivedAt>=3500)return {sent:false,reason:'A 主機未連線'};
    if(playback.sequence==='play')return {sent:false,reason:'播放鍵停留 Scene3，等待啟動動畫'};
    if(!playback.automatic)return {sent:false,reason:'手動模式由 A 區主控選幕，手勢不切換'};
    if(primaryPending.size||Date.now()-primaryAt<1500||handPending)return {sent:false,reason:'A 區主控正在切換'};
    if(live.view!==1||live.sceneIndex!==2)return {sent:false,reason:'僅 A 區開啟且位於 Scene3 時可觸發'};
    const address=config.sceneAddress||'/ac/scene';playback.command(3,Date.now());await send(address,[3]);handPending=true;count++;lastSent={address,value:3,source:'hand',time:new Date().toISOString()};await send('/ac/web/ping',[config.replyPort]);
    return {sent:true,sceneIndex:3,reason:'已請求 Scene3 → Scene4'};
   });return json(res,200,outcome);
  }
  if(url.pathname==='/api/playback'){
   const profile=validatePlayback(data);
   await serialize(async()=>{await writeFile(playbackPath,JSON.stringify(profile,null,2)+'\n');playback.configure(profile.durations,Date.now());});return json(res,200,{sent:true,handledBy:'relay',...profile});
  }
  if(url.pathname==='/api/config'){
   const next=validateConfig(data);await serialize(async()=>{const replacement=next.replyPort!==config.replyPort?await bindReply(next.replyPort):null;try{await writeFile(configPath,JSON.stringify(next,null,2)+'\n');}catch(error){replacement?.close();throw error;}if(replacement){const old=udp;udp=replacement;old.close();}config=next;live=null;receivedAt=0;playback.reset();primaryPending.clear();primaryAt=Date.now();handPending=false;handClients.clear();await send('/ac/web/ping',[config.replyPort]);});return json(res,200,{config});
  }
  return json(res,404,{error:'Not found'});
 }
 if((req.method==='GET'||req.method==='HEAD')&&['/','/A_ZONE_OSC.html'].includes(url.pathname)){
  const content=await readFile(path.join(root,'A_ZONE_OSC.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:content);
 }
 if((req.method==='GET'||req.method==='HEAD')&&url.pathname==='/bridge-client.mjs'){
  const content=await readFile(path.join(root,'bridge-client.mjs'));res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(req.method==='HEAD'?undefined:content);
 }
 json(res,404,{error:'Not found'});
}catch(error){lastError=error.message;json(res,400,{error:error.message});}});
udp=await bindReply(config.replyPort);
server.listen(httpPort,process.env.A_ZONE_BIND||'0.0.0.0',()=>{console.log(`A Zone Web: http://127.0.0.1:${httpPort}/A_ZONE_OSC.html | OSC ${config.host}:${config.port}`);for(const url of status().urls)console.log('iPad: '+url);});
const timer=setInterval(()=>send('/ac/web/ping',[config.replyPort]).catch(()=>{}),1000);
const autoTimer=setInterval(()=>serialize(async()=>{if(primaryPending.size)return;const next=playback.due(Date.now(),Boolean(live&&Date.now()-receivedAt<3500));if(next===null)return;if(next===-1){await send('/ac/sequence',[2]);primaryPending.set('view',0);count++;lastSent={address:'/ac/sequence',action:'reset',source:'auto',time:new Date().toISOString()};await send('/ac/web/ping',[config.replyPort]);return;}const address=config.sceneAddress||'/ac/scene';await send(address,[next]);primaryPending.set('scene',next);primaryAt=Date.now();count++;lastSent={address,value:next,source:'auto',time:new Date().toISOString()};await send('/ac/web/ping',[config.replyPort]);}).catch(error=>{lastError=error.message;}),100);
send('/ac/web/ping',[config.replyPort]).catch(()=>{});
function close(){clearInterval(timer);clearInterval(autoTimer);server.close();udp.close();}process.on('SIGINT',close);process.on('SIGTERM',close);
