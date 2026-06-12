# RoomFinder

부경대학교 인문사회과학대학 학생들이 C25 건물의 빈 강의실을 확인하고 1시간 단위로 예약할 수 있는 React 기반 MVP입니다.

## 전체 파일 구조

```text
.
├─ index.html
├─ package.json
├─ README.md
├─ .env.example
├─ firebase.database.rules.json
├─ vercel.json
└─ src
   ├─ App.jsx
   ├─ firebase.js
   ├─ main.jsx
   └─ styles.css
```

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 주소로 접속합니다. 기본 관리자 계정은 `admin / 1234`입니다.

Firebase 설정 전에는 같은 데이터 구조를 `localStorage`에 저장해 MVP 흐름을 확인할 수 있습니다. Firebase 값을 채우면 Realtime Database를 사용합니다.

`firebase.database.rules.json`은 MVP 확인용으로 열려 있습니다. 실제 운영 전에는 반드시 학번 기반 권한, 관리자 쓰기 권한, 본인 예약/쪽지 접근 권한 중심으로 보안 규칙을 강화해야 합니다.

## Firebase 설정 위치

Firebase 설정은 `src/firebase.js`에 있습니다. 로컬 개발에서는 프로젝트 루트에 `.env` 파일을 만들고 아래 값을 입력하는 방식을 권장합니다.

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Firebase Realtime Database 구조

```js
users: {
  "{studentId}": {
    studentId,
    password,
    role: "admin" | "user",
    college,
    department,
    phone,
    tempPasswordIssuedAt
  }
}

rooms: {
  "{roomId}": {
    id,
    building: "C25",
    name,
    capacity,
    memo
  }
}

schedules: {
  "{scheduleId}": {
    id,
    subject,
    professor,
    department,
    roomId,
    roomName,
    day,
    period,
    startTime,
    endTime
  }
}

reservations: {
  "{reservationId}": {
    id,
    userId,
    userName,
    roomId,
    roomName,
    date,
    day,
    period,
    startTime,
    endTime,
    purpose,
    status,
    createdAt
  }
}

notices: {
  "{noticeId}": {
    id,
    title,
    body,
    createdAt
  }
}

messages: {
  "{messageId}": {
    id,
    from,
    to,
    type,
    title,
    body,
    replyTo,
    createdAt,
    read
  }
}
```

## Vercel 배포 방법

1. GitHub에 프로젝트를 업로드합니다.
2. Vercel에서 `Add New Project`로 해당 저장소를 선택합니다.
3. Framework Preset은 `Vite`를 선택합니다.
4. Build Command는 `npm run build`, Output Directory는 `dist`로 둡니다.
5. Environment Variables에 `VITE_FIREBASE_*` 값을 등록합니다.
6. Deploy를 실행합니다.

## MVP 포함 기능

- 관리자와 사용자 로그인 및 회원가입
- 인문사회과학대학 소속 학생 가입 제한
- 기본 관리자 계정 생성
- C25 강의실 CRUD
- 정규 수업 시간표 입력 및 삭제
- 강의편람 `.xlsx` 업로드, C25 자료 추출, 오류 행 표시, 미리보기 후 반영
- 현재 및 선택 시간대별 강의실 사용 현황 조회
- 수업 중 과목명, 교수, 학과 표시
- 예약 중복 방지, 정규 수업 시간 예약 방지, 1일 2시간 제한
- 사용자 예약 확인 및 취소
- 관리자 예약 삭제
- 공지사항 등록 및 확인
- 사용자-관리자 쪽지, 비밀번호 분실 요청, 임시 비밀번호 발급

## 추후 확장 가능한 기능

- Firebase Authentication 또는 학교 SSO 연동
- 관리자 역할 세분화와 감사 로그
- 실제 C25 전체 호실 마스터 데이터 일괄 업로드
- 예약 승인제, 반복 예약, 예약 체크인 QR
- 학사시스템 강의편람 자동 동기화
- 모바일 푸시 알림과 예약 시작 전 리마인더
- 통계 대시보드와 강의실 이용률 분석
- Firebase Security Rules 강화와 비밀번호 해시 처리
