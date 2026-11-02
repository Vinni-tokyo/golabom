// 기기 맞추기(11-03): Google 로그인 → Worker /sync 에 이 브라우저의 기록을 두고, 다른 기기와 합친다.
// 서버에는 계정 번호의 해시를 열쇠로 기록만 둔다(이메일·이름 X). 합치기는 여기서 한다:
//   마지막으로 맞춘 상태(glb_sync_last)와 견줘 「여기서 지운 것」·「저쪽에서 지운 것」이 되살아나지 않게 한다(3자 비교).
import {CONFIG} from './config.js?v=20261103c';

const LISTS = {glb_dig_saved: [x => `${x.platform}:${x.id}`, 100], glb_dig_halls: [x => x.id, 60], glb_dig_paths: [x => String(x.key), 20]};
const MAPS = ['glb_gx_pos', 'glb_gx_seen', 'glb_fb'];
const KEYS = [...Object.keys(LISTS), ...MAPS];
const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const snap = () => Object.fromEntries(KEYS.map(k => [k, read(k) ?? (LISTS[k] ? [] : {})]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function merge3(L, R, B) {
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

const S = {token: '', email: '', at: 0, busy: false, err: '', onChange: () => {}, ui: null};
const api = (method, body) => fetch(`${CONFIG.searchApi}/sync`, {method, headers: {Authorization: `Bearer ${S.token}`, 'Content-Type': 'application/json'}, body: body && JSON.stringify(body)});

export async function syncNow() {
  if (!S.token || S.busy) return;
  S.busy = true;
  try {
    const g = await api('GET');
    if (g.status === 401) { S.token = ''; prompt(); return; }
    const R = (await g.json()).data || {}, L = snap(), M = merge3(L, R, read('glb_sync_last') || {});
    let changed = false;
    for (const k of KEYS) if (!same(M[k], L[k])) { write(k, M[k]); changed = true; }
    if (!same(M, R)) await api('PUT', {data: M});
    write('glb_sync_last', M);
    S.at = Date.now(); S.err = '';
    if (changed) S.onChange();
  } catch { S.err = '맞추지 못했어요(네트워크)'; }
  finally { S.busy = false; draw(); }
}

let gsi;
const loadGsi = () => gsi ||= new Promise((ok, no) => {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => {
    google.accounts.id.initialize({client_id: CONFIG.googleClientId, auto_select: true, use_fedcm_for_prompt: true, callback: r => {
      S.token = r.credential;
      try { S.email = JSON.parse(atob(r.credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).email || ''; } catch {}
      localStorage.setItem('glb_sync_on', '1');
      syncNow();
    }});
    ok();
  }; s.onerror = no;
  document.head.append(s);
});
const prompt = () => loadGsi().then(() => google.accounts.id.prompt()).catch(() => {});

export function syncInit(onChange) {
  if (!CONFIG.googleClientId || !CONFIG.searchApi) return;
  S.onChange = onChange;
  if (localStorage.getItem('glb_sync_on')) prompt();       // 전에 로그인했으면 조용히 다시(구글 자동 선택)
  setInterval(() => { if (S.token && !same(snap(), read('glb_sync_last') || {})) syncNow(); }, 20000);   // 바뀐 게 있을 때만 올린다(KV 쓰기 절약)
  document.addEventListener('visibilitychange', () => syncNow());
}

const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? '방금' : m < 60 ? `${m}분 전` : `${Math.round(m / 60)}시간 전`; };
function draw() {
  const el = S.ui;
  if (!el?.isConnected) return;
  if (S.token) {
    el.innerHTML = `<p>☁ <b>기기 맞추기 켜짐</b> <small>${S.email ? S.email + ' · ' : ''}${S.at ? '마지막 맞춤 ' + ago(S.at) : '맞추는 중…'}${S.err ? ' · ' + S.err : ''}</small></p>
      <div class="syb"><button data-sy="now">지금 맞추기</button><button data-sy="out">로그아웃</button><button data-sy="wipe">서버 기록 지우기</button><a href="privacy.html">무엇을 저장하나요?</a></div>`;
  } else {
    el.innerHTML = `<p>☁ <b>휴대폰·PC 맞추기</b> <small>Google 로 로그인하면 담은 영상·관·관람 위치가 다른 기기에도 보여요. 로그인하지 않아도 지금처럼 쓸 수 있어요.</small></p>
      <div class="syb"><span class="sygsi"></span><a href="privacy.html">무엇을 저장하나요?</a></div>`;
    loadGsi().then(() => google.accounts.id.renderButton(el.querySelector('.sygsi'), {theme: 'outline', size: 'medium', text: 'signin_with', locale: 'ko'})).catch(() => {});
  }
  el.querySelectorAll('[data-sy]').forEach(b => b.onclick = async () => {
    const a = b.dataset.sy;
    if (a === 'now') return syncNow();
    if (a === 'wipe' && !confirm('서버에 둔 기록을 지울까요? 이 기기의 기록은 남습니다.')) return;
    if (a === 'wipe') await api('DELETE').catch(() => {});
    google.accounts.id.disableAutoSelect();
    S.token = ''; S.email = ''; S.at = 0;
    localStorage.removeItem('glb_sync_on'); localStorage.removeItem('glb_sync_last');
    draw();
  });
}
export function syncUI(el) {
  if (!CONFIG.googleClientId || !el) return;
  el.hidden = false; S.ui = el; draw();
}
