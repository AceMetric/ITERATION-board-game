// Synchronous SHA-256/HMAC keeps the existing synchronous rules engine unchanged.
// Random seeds and player credentials come only from the runtime CSPRNG.
const encoder = new TextEncoder();
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
const rotate = (x,n) => (x>>>n)|(x<<(32-n));
export function sha256(input) {
  const bytes = typeof input === 'string' ? encoder.encode(input) : input;
  const padded = new Uint8Array(Math.ceil((bytes.length+9)/64)*64);
  padded.set(bytes); padded[bytes.length]=0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length-8,Math.floor(bytes.length/0x20000000));
  view.setUint32(padded.length-4,(bytes.length*8)>>>0);
  const h = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  for(let offset=0;offset<padded.length;offset+=64) {
    for(let i=0;i<16;i++)w[i]=view.getUint32(offset+4*i);
    for(let i=16;i<64;i++) {
      const a=w[i-15],b=w[i-2];
      w[i]=(w[i-16]+(rotate(a,7)^rotate(a,18)^(a>>>3))+w[i-7]+(rotate(b,17)^rotate(b,19)^(b>>>10)))>>>0;
    }
    let [a,b,c,d,e,f,g,z]=h;
    for(let i=0;i<64;i++) {
      const t1=(z+(rotate(e,6)^rotate(e,11)^rotate(e,25))+((e&f)^(~e&g))+K[i]+w[i])>>>0;
      const t2=((rotate(a,2)^rotate(a,13)^rotate(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
      z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
    }
    [a,b,c,d,e,f,g,z].forEach((v,i)=>h[i]=(h[i]+v)>>>0);
  }
  const out=new Uint8Array(32),outView=new DataView(out.buffer);
  h.forEach((v,i)=>outView.setUint32(i*4,v));return out;
}
export const hex = bytes => Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
export const fromHex = value => Uint8Array.from(value.match(/../g)||[],x=>parseInt(x,16));
export const digest = value => hex(sha256(value));
export function hmac(key,input) {
  if(key.length>64)key=sha256(key);
  const message=typeof input==='string'?encoder.encode(input):input;
  const inner=new Uint8Array(64+message.length),outer=new Uint8Array(96);
  for(let i=0;i<64;i++){inner[i]=(key[i]||0)^0x36;outer[i]=(key[i]||0)^0x5c;}
  inner.set(message,64);outer.set(sha256(inner),64);return sha256(outer);
}
export const randomBytes = count => crypto.getRandomValues(new Uint8Array(count));
export const token = () => btoa(String.fromCharCode(...randomBytes(32))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function secureRandom(game) {
  game.rand=function(n){
    const r=this.s.onlineRandom||(this.s.onlineRandom={key:hex(randomBytes(32)),counter:0});
    const limit=Math.floor(0x100000000/n)*n;let x;
    do{const bytes=hmac(fromHex(r.key),String(r.counter++));x=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0,true);}while(x>=limit);
    return x%n;
  };return game;
}
