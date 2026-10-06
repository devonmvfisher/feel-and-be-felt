// Adapted from WORLD-SHELL v1; decoder support is provided by the runtime.
export function inspectGlb(input,{selfContained=false}={}) {
  try {
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    if(bytes.length<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length)return ['Not a complete GLB version 2 file.'];
    const length=v.getUint32(12,true);if(v.getUint32(16,true)!==0x4e4f534a||20+length>bytes.length)return ['Invalid GLB JSON chunk.'];
    const doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+length)).trim()),issues=[];
    const walk=value=>{if(value&&typeof value==='object')for(const [key,part]of Object.entries(value)){if(key==='uri'&&(!String(part).startsWith('data:'))){if(selfContained||typeof part!=='string'||/^(?:[a-z]+:|\/|\\)/i.test(part)||part.split(/[\\/]/).includes('..'))issues.push('External or escaping asset URI: use embedded assets or local models/ sidecars.');}walk(part);}};walk(doc);
    return [...new Set(issues)];
  }catch{return ['GLB metadata cannot be read.'];}
}
