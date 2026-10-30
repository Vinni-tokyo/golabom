// 골라봄 Step 0 설정. 결정이 나면 여기만 고친다.
export const CONFIG = {
  // 리저브 서명. 실제로 고르는 사람(운영자)의 이름이어야 한다 — 결정 대기 중이라 일반 표기.
  curator: '골라봄 운영자',
  // 방문 기록(GoatCounter) 주소. 예: 'https://golabom.goatcounter.com/count'
  // 비어 있으면 아무 데도 보내지 않는다(이 브라우저에만 남음). 결정 대기 중.
  goatcounter: '',
  // 결과 개수 기본값
  maxResults: 10,
  // 길이 칩: 기본 20분 안쪽
  lengths: [
    {id: 'short', label: '5분', max: 6 * 60},
    {id: 'mid', label: '20분', max: 20 * 60},
    {id: 'any', label: '넉넉히', max: Infinity},
  ],
  defaultLength: 'mid',
};
