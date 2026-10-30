/* 관문 잠금 — Phase 0(index.html)과 같은 장치·같은 값(비밀번호 12345). 우연한 방문을 막는 장치이지 보안이 아니다.
   인터넷 주소로 열 때만 묻는다. crypto.subtle 은 https 에서만 돼서 SHA-256 을 직접 계산한다. */
const GATE = { salt: 'fc6a4d8b8ec4be63da4c73c17ee5f6c8', hash: 'a1f5f248573af0002dfdbd1bc924e7497740fddfacf0f51798aa8c4525fdfc1a' };
function sha256hex(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  let H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const b=[]; for(const ch of unescape(encodeURIComponent(str))) b.push(ch.charCodeAt(0));
  const bl=b.length*8; b.push(0x80); while(b.length%64!==56) b.push(0);
  for(let i=7;i>=0;i--) b.push((i<4? Math.floor(bl/Math.pow(2,8*i)) : 0)&0xff);
  const rr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let i=0;i<b.length;i+=64){
    const w=new Array(64);
    for(let t=0;t<16;t++) w[t]=(b[i+t*4]<<24)|(b[i+t*4+1]<<16)|(b[i+t*4+2]<<8)|b[i+t*4+3];
    for(let t=16;t<64;t++){
      const s0=rr(w[t-15],7)^rr(w[t-15],18)^(w[t-15]>>>3), s1=rr(w[t-2],17)^rr(w[t-2],19)^(w[t-2]>>>10);
      w[t]=(w[t-16]+s0+w[t-7]+s1)|0;
    }
    let [a,bb,c,d,e,f,g,h]=H;
    for(let t=0;t<64;t++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25), ch=(e&f)^(~e&g), t1=(h+S1+ch+K[t]+w[t])|0;
      const S0=rr(a,2)^rr(a,13)^rr(a,22), mj=(a&bb)^(a&c)^(bb&c), t2=(S0+mj)|0;
      h=g; g=f; f=e; e=(d+t1)|0; d=c; c=bb; bb=a; a=(t1+t2)|0;
    }
    H=[H[0]+a,H[1]+bb,H[2]+c,H[3]+d,H[4]+e,H[5]+f,H[6]+g,H[7]+h].map(x=>x|0);
  }
  return H.map(x=>((x>>>0).toString(16).padStart(8,'0'))).join('');
}
(function(){
  const host = location.hostname;
  const local = !host || host === 'localhost' || host === '127.0.0.1'
    || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || location.protocol === 'file:';
  if(local || !GATE.hash) return;                       // 집 안·파일·비밀번호 미설정이면 그대로
  if(sessionStorage.getItem('gate') === GATE.hash) return;
  const g = document.getElementById('gate'), wrap = document.getElementById('app');
  g.hidden = false; if(wrap) wrap.style.display = 'none';
  document.getElementById('gateForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = document.getElementById('gateErr'), pw = document.getElementById('gatePw');
    if(sha256hex(GATE.salt + pw.value) === GATE.hash){
      try{ sessionStorage.setItem('gate', GATE.hash); }catch(_){}
      g.hidden = true; if(wrap) wrap.style.display = '';
    } else { err.textContent = '비밀번호가 다릅니다'; pw.select(); }
  });
})();
