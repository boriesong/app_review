// Korean sentiment + topic lexicons for App Store review analysis.
// Kept deliberately simple and transparent: substring matching against curated
// word lists. The star rating is the primary sentiment signal; the lexicon
// refines it and detects text/rating mismatches (e.g. a 5★ review that is
// actually a complaint).

export const POSITIVE_WORDS = [
  "좋", "편해", "편하", "편리", "최고", "만족", "유용", "감사", "굿", "짱",
  "훌륭", "대박", "사랑", "추천", "완벽", "개꿀", "쉽게", "쉬워", "간편",
  "잘 쓰", "잘쓰", "잘 사용", "잘사용", "베리 굿", "베리굿", "너무 좋", "매우 좋",
  "유용", "괜찮", "감동", "복받", "나눠", "고마",
];

export const NEGATIVE_WORDS = [
  "오류", "안됩", "안 됩", "안돼", "안 돼", "안됨", "안 됨", "불편", "최악",
  "짜증", "버그", "실망", "별로", "느려", "느림", "먹통", "문제", "튕", "에러",
  "노답", "후지", "복잡", "강제", "삭제", "안열", "안 열", "로그인이", "인증",
  "왜 이", "왜이", "아쉽", "부족", "고쳐", "안깔", "재설치", "튕겨", "멈춤",
  "구려", "쓰레기", "환불", "먹튀",
];

// Topic taxonomy. Each review can match multiple topics.
// `polarity` hints how to read the topic's presence when generating insights.
export const TOPICS = [
  {
    key: "data_share",
    label: "데이터·포인트 공유",
    polarity: "feature",
    keywords: ["데이터", "포인트", "공유", "나눠", "나눔", "담", "꺼내", "가족", "결합", "충전"],
  },
  {
    key: "login_auth",
    label: "로그인·인증 오류",
    polarity: "negative",
    keywords: ["로그인", "인증", "접속", "로그아웃", "보호자인증", "본인인증", "계정", "가입"],
  },
  {
    key: "bug_error",
    label: "앱 오류·버그",
    polarity: "negative",
    keywords: ["오류", "버그", "에러", "안됨", "안 됨", "안돼", "안 돼", "먹통", "튕", "멈춤", "동작", "실행", "먹튀"],
  },
  {
    key: "ui_ux",
    label: "UI·디자인·사용성",
    polarity: "mixed",
    keywords: ["디자인", "ui", "직관", "심플", "복잡", "불편", "편리", "편해", "간편", "예쁘", "화면", "인터페이스"],
  },
  {
    key: "capacity",
    label: "용량·충전 한도",
    polarity: "negative",
    keywords: ["용량", "한도", "부족", "gb", "mb", "기가", "늘려", "증가", "2g", "5g", "제한"],
  },
  {
    key: "event_mission",
    label: "이벤트·미션·혜택",
    polarity: "feature",
    keywords: ["이벤트", "미션", "밋션", "혜택", "리워드", "보상", "적립", "쿠폰", "경품"],
  },
  {
    key: "update_change",
    label: "업데이트·개편 불만",
    polarity: "negative",
    keywords: ["업데이트", "업뎃", "개편", "바뀌", "바꿔", "예전", "이전", "돌려", "롤백", "왜함", "왜 함"],
  },
  {
    key: "ads",
    label: "광고",
    polarity: "negative",
    keywords: ["광고", "팝업", "배너"],
  },
  {
    key: "praise",
    label: "전반적 만족·칭찬",
    polarity: "positive",
    keywords: ["좋아요", "좋네", "좋습니다", "최고", "만족", "유용", "감사", "굿", "짱", "편해요", "완벽", "추천"],
  },
];

// Ultra-short generic praise used to detect incentivized/event-driven reviews.
export const GENERIC_PRAISE = [
  "좋아요", "좋네요", "좋습니다", "굿", "굿굿", "짱", "최고", "편해요", "감사", "베리굿", "대박",
];
