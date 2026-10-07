export function bridgeOrigin(value){
 if(!value?.trim())return '';
 let url;try{url=new URL(value.trim());}catch{throw Error('請填入完整橋接網址，例如 http://192.168.0.2:8788');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!['/','/A_ZONE_OSC.html'].includes(url.pathname))throw Error('橋接網址需使用 http／https，且不含帳號或查詢參數');
 return url.origin;
}
export function bridgeRequest(base,route,data){
 const origin=bridgeOrigin(base);if(!origin)throw Error('請在 OSC 設定填入現場橋接網址');
 const options={cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)};
 if(data){options.method='POST';options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(data);}
 const host=new URL(origin).hostname;
 if(host==='localhost'||host==='127.0.0.1'||host==='[::1]')options.targetAddressSpace='loopback';
 else if(/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||host.endsWith('.local'))options.targetAddressSpace='local';
 return {url:origin+route,options};
}
export async function requestBridge(base,route,data){
 const {url,options}=bridgeRequest(base,route,data);
 const response=await fetch(url,options);
 if(!response.headers.get('content-type')?.includes('application/json'))throw Error('此網址不是 A 區橋接服務');
 const value=await response.json();if(!response.ok)throw Error(value.error||'連線失敗');return value;
}
