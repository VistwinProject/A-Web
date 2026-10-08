export const PHONE_BRIDGE='https://laptop-k.tailadf849.ts.net:8443';
export function initialBridge({published,origin,saved='',presetApplied=false}){
 if(!published)return origin;const previous=bridgeOrigin(saved);return previous&&(presetApplied||previous.startsWith('https:'))?previous:PHONE_BRIDGE;
}
export function bridgeOrigin(value){
 if(!value?.trim())return '';
 let url;try{url=new URL(value.trim());}catch{throw Error('請填入完整橋接網址，例如 http://192.168.0.2:8788');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!['/','/A_ZONE_OSC.html'].includes(url.pathname))throw Error('橋接網址需使用 http／https，且不含帳號或查詢參數');
 return url.origin;
}
export function bridgeRequest(base,route,data,pairingCode=''){
 const origin=bridgeOrigin(base);if(!origin)throw Error('請在 OSC 設定填入現場橋接網址');
 const options={cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)};
 if(pairingCode){if(!/^\d{8}$/.test(pairingCode))throw Error('手機配對碼需為 8 位數字');options.headers={Authorization:'Bearer '+pairingCode};}
 if(data){options.method='POST';options.headers={...options.headers,'Content-Type':'application/json'};options.body=JSON.stringify(data);}
 const host=new URL(origin).hostname;
 if(host==='localhost'||host==='127.0.0.1'||host==='[::1]')options.targetAddressSpace='loopback';
 else if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||host.endsWith('.local'))options.targetAddressSpace='local';
 return {url:origin+route,options};
}
export async function requestBridge(base,route,data,pairingCode=''){
 const {url,options}=bridgeRequest(base,route,data,pairingCode);
 const response=await fetch(url,options);
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('此網址不是 A 區橋接服務');
 const value=await response.json();if(!response.ok){const error=Error(value.error||'連線失敗');error.status=response.status;throw error;}return value;
}
