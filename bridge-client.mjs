export const DEFAULT_BRIDGE='http://192.168.200.143:8788';
export function initialBridge({published,origin,saved='',presetApplied=false}){if(!published)return origin;return presetApplied&&saved?bridgeOrigin(saved):DEFAULT_BRIDGE;}
export function bridgeOrigin(value){
 if(!value?.trim())return '';
 let input=value.trim();const ip=input.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
 if(ip){if(ip[1].split('.').some(x=>Number(x)>255||String(Number(x))!==x))throw Error('請輸入有效 IPv4 位址');const port=ip[2]?Number(ip[2]):8788;if(port<1||port>65535)throw Error('Port 必須介於 1–65535');input='http://'+ip[1]+':'+port;}
 let url;try{url=new URL(input);}catch{throw Error('請填電腦 IP，例如 192.168.200.143');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!['/','/A_ZONE_OSC.html'].includes(url.pathname))throw Error('請填電腦 IP 或不含帳號、參數的轉送網址');return url.origin;
}
export function relayInput(base){const url=new URL(bridgeOrigin(base));return url.protocol==='http:'&&/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)?url.hostname+(url.port&&url.port!=='8788'?':'+url.port:''):url.origin;}
export function bridgeRequest(base,route,data){
 const origin=bridgeOrigin(base);if(!origin)throw Error('請在 OSC 設定填入電腦 IP');const options={cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)};
 if(data){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}
 const host=new URL(origin).hostname;if(host==='localhost'||host==='127.0.0.1'||host==='[::1]')options.targetAddressSpace='loopback';else if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||host.endsWith('.local'))options.targetAddressSpace='local';return {url:origin+route,options};
}
export async function requestBridge(base,route,data){const {url,options}=bridgeRequest(base,route,data);const response=await fetch(url,options);if(!response.headers.get('content-type')?.includes('application/json'))throw Error('此 IP 不是 A 區 OSC 轉送服務');const value=await response.json();if(!response.ok)throw Error(value.error||'連線失敗');return value;}
