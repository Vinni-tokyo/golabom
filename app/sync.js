// 기기 맞추기(11-03 · 끝과 끝 암호화): 열쇠는 기기 안(localStorage)에만 있다. 서버(Worker /sync)에는 열쇠의 해시를 주소로 암호문만 두므로
// 운영자도 읽지 못하고 누구인지도 모른다. 서버 암호문은 만료 없음(지우기는 「서버 기록 지우기」로만). 합치기는 여기서 한다(3자 비교: 한쪽에서 지운 것이 되살아나지 않게).
import {CONFIG} from './config.js?v=20261104f';

const LISTS = {glb_dig_saved: [x => `${x.platform}:${x.id}`, 100], glb_dig_halls: [x => x.id, 60], glb_dig_paths: [x => String(x.key), 20]};
const MAPS = ['glb_gx_pos', 'glb_gx_seen', 'glb_fb', 'glb_ask'];
const KEYS = [...Object.keys(LISTS), ...MAPS];
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const snap = () => Object.fromEntries(KEYS.map(k => [k, read(k) ?? (LISTS[k] ? [] : {})]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function merge3(L, R, B) {
  const out = {};
  for (const k of KEYS) {
    const kf = LISTS[k]?.[0];
    const toMap = v => kf ? new Map((v || []).map(x => [kf(x), x])) : new Map(Object.entries(v || {}));
    const l = toMap(L[k]), r = toMap(R[k]), b = toMap(B[k]), m = new Map();
    for (const id of new Set([...l.keys(), ...r.keys()])) {
      const inL = l.has(id), inR = r.has(id);
      if (inL && inR) m.set(id, kf ? ((r.get(id).at || 0) > (l.get(id).at || 0) ? r.get(id) : l.get(id)) : (same(l.get(id), b.get(id)) ? r.get(id) : l.get(id)));
      else if (!b.has(id)) m.set(id, inL ? l.get(id) : r.get(id));   // 한쪽에서 새로 생긴 것
      // 한쪽에만 있고 지난번엔 있었다 = 다른 쪽에서 지웠다 → 뺀다
    }
    out[k] = kf ? [...m.values()].sort((a, c) => (c.at || 0) - (a.at || 0)).slice(0, LISTS[k][1]) : Object.fromEntries(m);
  }
  return out;
}

// ── 열쇠와 암호 ──
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const S = {key: '', tok: '', at: 0, serverAt: 0, busy: false, err: '', qr: false, onChange: () => {}, ui: null};
async function setKey(k) {
  S.key = k; try { localStorage.setItem('glb_sync_key', k); } catch {}
  S.tok = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('golabom-sync:' + k)));   // 서버에는 열쇠가 아니라 이 해시만 간다
}
const cryptoKey = () => crypto.subtle.importKey('raw', unb64u(S.key), 'AES-GCM', false, ['encrypt', 'decrypt']);
async function seal(obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await cryptoKey(), new TextEncoder().encode(JSON.stringify(obj))); return {iv: b64u(iv), ct: b64u(new Uint8Array(ct))}; }
async function unseal(box) { const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unb64u(box.iv)}, await cryptoKey(), unb64u(box.ct)); return JSON.parse(new TextDecoder().decode(pt)); }
const api = (method, body) => fetch(`${CONFIG.searchApi}/sync`, {method, headers: {Authorization: `Bearer ${S.tok}`, 'Content-Type': 'application/json'}, body: body && JSON.stringify(body)});
const linkOf = () => `${location.origin}${location.pathname}#/link/${S.key}`;

export async function syncNow() {
  if (!S.key || S.busy) return;
  S.busy = true;
  try {
    const g = await (await api('GET')).json();
    let R = {};
    if (g.box) { try { R = await unseal(g.box); } catch { S.err = '이 열쇠로는 서버 기록을 열 수 없어요'; return; } }
    const L = snap(), M = merge3(L, R, read('glb_sync_last') || {});
    let changed = false;
    for (const k of KEYS) if (!same(M[k], L[k])) { write(k, M[k]); changed = true; }
    if (!same(M, R)) { const r = await (await api('PUT', {box: await seal(M)})).json(); S.serverAt = r.at || Date.now(); }
    else S.serverAt = g.at;
    write('glb_sync_last', M);
    S.at = Date.now(); S.err = '';
    if (changed) S.onChange();
  } catch { S.err = '맞추지 못했어요(네트워크)'; }
  finally { S.busy = false; draw(); }
}

export async function syncInit(onChange) {
  if (!CONFIG.searchApi) return;
  S.onChange = onChange;
  const k = localStorage.getItem('glb_sync_key');
  if (k) { await setKey(k); syncNow(); }
  setInterval(() => { if (S.key && !same(snap(), read('glb_sync_last') || {})) syncNow(); }, 20000);   // 바뀐 게 있을 때만 올린다(KV 쓰기 절약)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
}
// #/link/<열쇠>: 다른 기기의 QR·링크로 들어왔다. 열쇠를 받고 깊이 파기로 간다
export async function syncLink(k) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(k || '')) { location.hash = '#/set'; return; }
  await setKey(k); try { localStorage.removeItem('glb_sync_last'); } catch {}
  history.replaceState(null, '', location.pathname + '#/set');   // 주소에 열쇠를 남기지 않는다
  dispatchEvent(new HashChangeEvent('hashchange'));
  syncNow();
}
async function start() { await setKey(b64u(crypto.getRandomValues(new Uint8Array(32)))); try { localStorage.removeItem('glb_sync_last'); } catch {} S.qr = true; draw(); syncNow(); }
let qrLib;
const loadQR = () => qrLib ||= new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = ok; s.onerror = no; document.head.append(s); });

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`; };
function draw() {
  const el = S.ui;
  if (!el?.isConnected) return;
  if (S.key) {
    el.innerHTML = `<p>☁ <b>기기 맞추기 켜짐</b> <small>${S.at ? '마지막 맞춤 ' + ago(S.at) : '맞추는 중…'}${S.err ? ' · ' + S.err : ''} · 서버에는 암호문만 있고 운영자도 못 읽어요</small></p>
      <p class="syhow"><b>다른 기기에 연결하려면</b> 아래 링크를 그 기기로 보내 여세요(폰 → PC: 「링크 내보내기」로 카카오톡 「나와의 채팅」·메일에 보내기). PC → 폰은 「QR 보기」를 폰 카메라로 찍으면 됩니다. <b>링크에 열쇠가 들어 있으니 남에게 보내지 마세요.</b></p>
      <div class="sylink"><input readonly value="${linkOf()}" aria-label="연결 링크"><button data-sy="share">링크 내보내기</button><button data-sy="copy">복사</button></div>
      <div class="syb"><button data-sy="qr" aria-pressed="${S.qr}">QR 보기</button><button data-sy="now">지금 맞추기</button><button data-sy="out">이 기기 끊기</button><button data-sy="wipe">서버 기록 지우기</button><a href="privacy.html">무엇을 저장하나요?</a></div>
      ${S.qr ? `<div class="syqr"><div class="syqrbox" id="syQR"></div><p>다른 기기의 카메라로 찍으면 골라보셈이 열리며 연결됩니다.</p></div>` : ''}`;
    if (S.qr) loadQR().then(() => { const box = el.querySelector('#syQR'); if (box && !box.children.length) new QRCode(box, {text: linkOf(), width: 148, height: 148, correctLevel: QRCode.CorrectLevel.M}); }).catch(() => {});
  } else {
    el.innerHTML = `<p>☁ <b>휴대폰·PC 맞추기</b> <small>담은 영상·묶음·관람 위치·목표를 다른 기기에서도 이어 봐요. 로그인 없이, 암호화해서. 켜지 않아도 지금처럼 쓸 수 있어요.</small></p>
      <p class="syhow">① 기록이 있는 기기에서 <b>「이 기기에서 시작」</b> → 연결 링크가 생깁니다. ② 그 링크를 다른 기기로 보내 열거나 아래 칸에 붙여넣으면 끝.</p>
      <div class="syb"><button data-sy="start">이 기기에서 시작</button><span class="syor">또는</span><form class="sylink" data-sy-form><input placeholder="다른 기기에서 받은 연결 링크 붙여넣기" aria-label="연결 링크"><button>연결</button></form><a href="privacy.html">무엇을 저장하나요?</a></div>`;
    el.querySelector('[data-sy-form]').onsubmit = e => { e.preventDefault(); const m = /#\/link\/([A-Za-z0-9_-]{43})/.exec(e.target.querySelector('input').value || ''); if (m) syncLink(m[1]); else e.target.querySelector('input').setCustomValidity('연결 링크가 아니에요'); };
  }
  el.querySelectorAll('[data-sy]').forEach(b => b.onclick = async () => {
    const a = b.dataset.sy;
    if (a === 'start') return start();
    if (a === 'now') return syncNow();
    if (a === 'qr') { S.qr = !S.qr; return draw(); }
    if (a === 'copy') { try { await navigator.clipboard.writeText(linkOf()); b.textContent = '복사됨'; } catch {} return; }
    if (a === 'share') {                                        // 폰: 기기의 공유 창(카카오톡 「나와의 채팅」·메일·메모) · 없으면 복사
      if (navigator.share) { try { await navigator.share({title: '골라보셈 기기 연결', text: '골라보셈 기기 연결 링크 — 내 기기에서만 여세요', url: linkOf()}); return; } catch {} }
      try { await navigator.clipboard.writeText(linkOf()); b.textContent = '복사됨 — 메모·메일에 붙여넣어 보내세요'; } catch { el.querySelector('.sylink input')?.select(); }
      return;
    }
    if (a === 'wipe' && !confirm('서버에 둔 암호문을 지울까요? 이 기기의 기록은 남습니다.')) return;
    if (a === 'wipe') await api('DELETE').catch(() => {});
    if (a === 'out' && !confirm('이 기기를 끊을까요? 서버의 암호문과 다른 기기의 기록은 그대로 남습니다.')) return;
    S.key = ''; S.tok = ''; S.at = 0; S.qr = false;
    try { localStorage.removeItem('glb_sync_key'); localStorage.removeItem('glb_sync_last'); } catch {}
    draw();
  });
}
export function syncUI(el) {
  if (!CONFIG.searchApi || !el) return;
  el.hidden = false; S.ui = el; draw();
}
