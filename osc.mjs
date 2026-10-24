function string(value) { const b=Buffer.from(value+'\0');return Buffer.concat([b,Buffer.alloc((4-b.length%4)%4)]); }
export function encodeOSC(address,args=[]) {
 if(!address.startsWith('/'))throw Error('OSC address must start with /');
 return Buffer.concat([string(address),string(','+args.map(x=>typeof x==='string'?'s':'i').join('')), ...args.map(x=>{if(typeof x==='string')return string(x);if(!Number.isInteger(x))throw Error('OSC value must be integer');const b=Buffer.alloc(4);b.writeInt32BE(x);return b;})]);
}
export function decodeOSC(packet) {
 let offset=0;
 function readString(){const end=packet.indexOf(0,offset);if(end<0)throw Error('Invalid OSC string');const s=packet.toString('utf8',offset,end);offset=(end+4)&~3;if(offset>packet.length)throw Error('Truncated OSC');return s;}
 const address=readString(),types=readString();if(!address.startsWith('/')||!types.startsWith(','))throw Error('Invalid OSC');
 const args=[];for(const t of types.slice(1)){if(t==='s')args.push(readString());else if(t==='i'){if(offset+4>packet.length)throw Error('Truncated OSC integer');args.push(packet.readInt32BE(offset));offset+=4;}else throw Error('Unsupported OSC type');}
 return {address,args};
}
export function validateCommand(kind,value){const max=kind==='scene'?4:['view','mode'].includes(kind)?1:-1;if(!Number.isInteger(value)||value<0||value>max)throw Error('Invalid command value');return {address:'/ac/'+kind,value};}
export function validateConfig(input,defaultReplyPort=9202){
 if(!input||typeof input.host!=='string'||!/^\d{1,3}(\.\d{1,3}){3}$/.test(input.host)||input.host.split('.').some(x=>Number(x)>255||String(Number(x))!==x))throw Error('請輸入 A 主機 IPv4 位址');
 const replyPort=input.replyPort??defaultReplyPort;
 for(const [name,value,min] of [['OSC Port',input.port,1],['回傳 Port',replyPort,1024]])if(!Number.isInteger(value)||value<min||value>65535)throw Error(name+' 必須介於 '+min+'–65535');
 const result={host:input.host,port:input.port,replyPort};
 for(const kind of ['scene','view'])if(input[kind+'Address']!==undefined){const value=input[kind+'Address'];if(typeof value!=='string'||!/^\/[A-Za-z0-9_/-]+$/.test(value))throw Error('OSC 位址需以 / 開頭，使用英數字、底線或斜線');result[kind+'Address']=value;}
 if((result.sceneAddress||'/ac/scene')===(result.viewAddress||'/ac/view'))throw Error('幕次與開關需使用不同 OSC 通道');
 return result;
}
export function validatePlayback(input){
 const values=input?.durations;
 if(!Array.isArray(values)||values.length!==5||values[2]!==null)throw Error('第三幕固定等待手勢，秒數需為 null');
 for(const i of [0,1,3,4])if(typeof values[i]!=='number'||!Number.isFinite(values[i])||values[i]<.1||values[i]>86400)throw Error('幕次秒數必須介於 0.1–86400');
 return {durations:values.slice()};
}
