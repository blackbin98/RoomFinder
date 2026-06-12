import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  UserRound,
  XCircle
} from "lucide-react";
import { database, firebaseConfig } from "./firebase";
import { get, ref, remove, set, update } from "firebase/database";

const BUILDING = "C25";
const ALLOWED_COLLEGE = "인문사회과학대학";
const PERIODS = Array.from({ length: 12 }, (_, index) => {
  const start = 9 + index;
  return {
    period: index + 1,
    label: `${index + 1}교시`,
    start: `${String(start).padStart(2, "0")}:00`,
    end: `${String(start + 1).padStart(2, "0")}:00`,
    slot: `${String(start).padStart(2, "0")}:00-${String(start + 1).padStart(2, "0")}:00`
  };
});

const defaultData = {
  users: {
    admin: {
      studentId: "admin",
      password: "1234",
      role: "admin",
      college: "관리자",
      department: "RoomFinder",
      phone: "010-0000-0000"
    }
  },
  rooms: {
    C2501: { id: "C2501", building: BUILDING, name: "C25-101", capacity: 48, memo: "일반 강의실" },
    C2502: { id: "C2502", building: BUILDING, name: "C25-102", capacity: 40, memo: "세미나실" },
    C2503: { id: "C2503", building: BUILDING, name: "C25-201", capacity: 60, memo: "대형 강의실" },
    C2504: { id: "C2504", building: BUILDING, name: "C25-202", capacity: 36, memo: "스터디형 강의실" },
    C2505: { id: "C2505", building: BUILDING, name: "C25-301", capacity: 52, memo: "일반 강의실" }
  },
  schedules: {
    s1: {
      id: "s1",
      subject: "사회조사방법론",
      professor: "김민준",
      department: "행정복지학부",
      roomId: "C2501",
      roomName: "C25-101",
      day: "월",
      period: 2,
      startTime: "10:00",
      endTime: "11:00"
    },
    s2: {
      id: "s2",
      subject: "문화콘텐츠입문",
      professor: "이서연",
      department: "국어국문학과",
      roomId: "C2503",
      roomName: "C25-201",
      day: "화",
      period: 4,
      startTime: "12:00",
      endTime: "13:00"
    }
  },
  reservations: {},
  notices: {
    n1: {
      id: "n1",
      title: "C25 시범 운영 안내",
      body: "RoomFinder는 C25 건물 강의실을 대상으로 우선 운영됩니다.",
      createdAt: new Date().toISOString()
    }
  },
  messages: {}
};

const databaseSchema = `{
  users: {
    "{studentId}": {
      studentId, password, role: "admin" | "user",
      college, department, phone, tempPasswordIssuedAt?
    }
  },
  rooms: {
    "{roomId}": { id, building: "C25", name, capacity, memo }
  },
  schedules: {
    "{scheduleId}": {
      id, subject, professor, department,
      roomId, roomName, day, period, startTime, endTime
    }
  },
  reservations: {
    "{reservationId}": {
      id, userId, userName, roomId, roomName,
      date, day, period, startTime, endTime,
      purpose, status: "active", createdAt
    }
  },
  notices: {
    "{noticeId}": { id, title, body, createdAt }
  },
  messages: {
    "{messageId}": {
      id, from, to: "admin" | "{studentId}", type,
      title, body, replyTo?, createdAt, read
    }
  }
}`;

function isFirebaseConfigured() {
  return (
    !String(firebaseConfig.databaseURL).includes("YOUR_") &&
    !String(firebaseConfig.projectId).includes("YOUR_")
  );
}

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function dayName(date) {
  return ["일", "월", "화", "수", "목", "금", "토"][new Date(`${date}T00:00:00`).getDay()];
}

function getPeriod(period) {
  return PERIODS.find((item) => item.period === Number(period)) || PERIODS[0];
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalData() {
  const stored = localStorage.getItem("roomfinder-data");
  if (!stored) return defaultData;
  return { ...defaultData, ...JSON.parse(stored), users: { ...defaultData.users, ...JSON.parse(stored).users } };
}

async function loadData() {
  if (!isFirebaseConfigured()) return readLocalData();
  const snapshot = await get(ref(database, "/"));
  const value = snapshot.val();
  if (!value || !value.users?.admin) {
    await set(ref(database, "/"), defaultData);
    return defaultData;
  }
  return { ...defaultData, ...value, users: { ...defaultData.users, ...value.users } };
}

async function savePath(path, value) {
  if (isFirebaseConfigured()) return set(ref(database, path), value);
  const data = readLocalData();
  const parts = path.split("/").filter(Boolean);
  let cursor = data;
  parts.slice(0, -1).forEach((part) => {
    cursor[part] ||= {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
  localStorage.setItem("roomfinder-data", JSON.stringify(data));
}

async function updatePath(path, value) {
  if (isFirebaseConfigured()) return update(ref(database, path), value);
  const data = readLocalData();
  const parts = path.split("/").filter(Boolean);
  let cursor = data;
  parts.forEach((part) => {
    cursor[part] ||= {};
    cursor = cursor[part];
  });
  Object.assign(cursor, value);
  localStorage.setItem("roomfinder-data", JSON.stringify(data));
}

async function removePath(path) {
  if (isFirebaseConfigured()) return remove(ref(database, path));
  const data = readLocalData();
  const parts = path.split("/").filter(Boolean);
  let cursor = data;
  parts.slice(0, -1).forEach((part) => {
    cursor = cursor[part] || {};
  });
  delete cursor[parts.at(-1)];
  localStorage.setItem("roomfinder-data", JSON.stringify(data));
}

function objectList(object) {
  return Object.values(object || {});
}

function normalizeHeader(text) {
  return String(text || "").replace(/\s/g, "").toLowerCase();
}

function pick(row, names) {
  const entries = Object.entries(row);
  for (const name of names) {
    const found = entries.find(([key]) => normalizeHeader(key).includes(normalizeHeader(name)));
    if (found) return found[1];
  }
  return "";
}

function parsePeriods(value) {
  const matches = String(value || "").match(/\d+/g) || [];
  return [...new Set(matches.map(Number).filter((number) => number >= 1 && number <= 12))];
}

function parseExcelRows(rows, rooms) {
  const roomValues = objectList(rooms);
  return rows.map((row, index) => {
    const roomName = String(pick(row, ["강의실", "강의실명", "장소", "호실"])).trim();
    const room = roomValues.find((item) => item.name === roomName || item.id === roomName || roomName.includes(item.name));
    const day = String(pick(row, ["요일", "강의요일"])).trim().slice(0, 1);
    const periods = parsePeriods(pick(row, ["교시", "강의교시", "시간"]));
    const base = {
      rowNumber: index + 2,
      subject: String(pick(row, ["과목명", "교과목명", "강좌명"])).trim(),
      professor: String(pick(row, ["담당교수", "교수", "교원명"])).trim(),
      department: String(pick(row, ["학과", "개설학과", "개설부서"])).trim(),
      roomId: room?.id || "",
      roomName,
      day
    };
    const errors = [];
    if (!base.subject) errors.push("과목명 없음");
    if (!base.professor) errors.push("담당교수 없음");
    if (!base.department) errors.push("학과 없음");
    if (!room) errors.push("C25 등록 강의실과 불일치");
    if (!["월", "화", "수", "목", "금", "토", "일"].includes(day)) errors.push("요일 오류");
    if (!periods.length) errors.push("교시 오류");
    return {
      ...base,
      periods,
      valid: errors.length === 0,
      errors
    };
  });
}

function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [loginForm, setLoginForm] = useState({ studentId: "admin", password: "1234" });
  const [signupForm, setSignupForm] = useState({
    studentId: "",
    password: "",
    college: ALLOWED_COLLEGE,
    department: "",
    phone: ""
  });
  const [toast, setToast] = useState("");

  async function refresh() {
    const next = await loadData();
    setData(next);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function notify(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function persist(path, value, message) {
    await savePath(path, value);
    await refresh();
    if (message) notify(message);
  }

  async function patch(path, value, message) {
    await updatePath(path, value);
    await refresh();
    if (message) notify(message);
  }

  async function drop(path, message) {
    await removePath(path);
    await refresh();
    if (message) notify(message);
  }

  function login(event) {
    event.preventDefault();
    const user = data.users?.[loginForm.studentId];
    if (!user || user.password !== loginForm.password) {
      notify("학번 또는 비밀번호를 확인해주세요.");
      return;
    }
    setCurrentUser(user);
    setScreen(user.role === "admin" ? "admin" : "user");
  }

  async function signup(event) {
    event.preventDefault();
    if (signupForm.college !== ALLOWED_COLLEGE) {
      notify("인문사회과학대학 소속 학생만 가입할 수 있습니다.");
      return;
    }
    if (data.users?.[signupForm.studentId]) {
      notify("이미 등록된 학번입니다.");
      return;
    }
    const user = { ...signupForm, role: "user" };
    await persist(`/users/${signupForm.studentId}`, user, "회원가입이 완료되었습니다.");
    setCurrentUser(user);
    setScreen("user");
  }

  function logout() {
    setCurrentUser(null);
    setScreen("login");
    setLoginForm({ studentId: "admin", password: "1234" });
  }

  if (loading) return <div className="loading">RoomFinder를 준비하고 있습니다.</div>;

  return (
    <main>
      <header className="app-header">
        <div>
          <div className="brand-row">
            <Building2 size={30} />
            <h1>RoomFinder</h1>
          </div>
          <p>빈 강의실을 가장 빠르게 찾는 방법</p>
        </div>
        {currentUser && (
          <button className="ghost-button" onClick={logout}>
            <LogOut size={18} /> 로그아웃
          </button>
        )}
      </header>

      {toast && <div className="toast">{toast}</div>}

      {screen === "login" && (
        <AuthScreen
          authMode={authMode}
          setAuthMode={setAuthMode}
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          signupForm={signupForm}
          setSignupForm={setSignupForm}
          login={login}
          signup={signup}
        />
      )}

      {screen === "admin" && currentUser && (
        <AdminDashboard data={data} persist={persist} patch={patch} drop={drop} refresh={refresh} notify={notify} />
      )}

      {screen === "user" && currentUser && (
        <UserDashboard data={data} user={currentUser} persist={persist} drop={drop} notify={notify} />
      )}
    </main>
  );
}

function AuthScreen({ authMode, setAuthMode, loginForm, setLoginForm, signupForm, setSignupForm, login, signup }) {
  return (
    <section className="auth-layout">
      <div className="hero-copy">
        <span className="pill">부경대학교 C25 시범 운영</span>
        <h2>C25 빈 강의실 확인부터 예약까지 한 화면에서 처리합니다.</h2>
        <div className="status-legend">
          <span><i className="dot available" /> 사용 가능</span>
          <span><i className="dot busy" /> 수업 중</span>
          <span><i className="dot reserved" /> 예약됨</span>
        </div>
      </div>
      <div className="auth-panel">
        <div className="segmented">
          <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>로그인</button>
          <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>회원가입</button>
        </div>
        {authMode === "login" ? (
          <form onSubmit={login} className="form-grid">
            <label>학번<input value={loginForm.studentId} onChange={(event) => setLoginForm({ ...loginForm, studentId: event.target.value })} required /></label>
            <label>비밀번호<input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required /></label>
            <button className="primary-button"><Shield size={18} /> 로그인</button>
            <p className="hint">기본 관리자 계정: admin / 1234</p>
          </form>
        ) : (
          <form onSubmit={signup} className="form-grid">
            <label>학번<input value={signupForm.studentId} onChange={(event) => setSignupForm({ ...signupForm, studentId: event.target.value })} required /></label>
            <label>비밀번호<input type="password" value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} required /></label>
            <label>소속대학<input value={signupForm.college} onChange={(event) => setSignupForm({ ...signupForm, college: event.target.value })} required /></label>
            <label>소속학과<input value={signupForm.department} onChange={(event) => setSignupForm({ ...signupForm, department: event.target.value })} required /></label>
            <label>전화번호<input value={signupForm.phone} onChange={(event) => setSignupForm({ ...signupForm, phone: event.target.value })} required /></label>
            <button className="primary-button"><UserRound size={18} /> 가입 후 시작</button>
          </form>
        )}
      </div>
    </section>
  );
}

function AdminDashboard({ data, persist, patch, drop, refresh, notify }) {
  const [tab, setTab] = useState("rooms");
  const tabs = [
    ["rooms", "강의실", Building2],
    ["schedules", "시간표", CalendarDays],
    ["upload", "엑셀 업로드", Upload],
    ["reservations", "예약", Clock],
    ["notices", "공지", Bell],
    ["messages", "쪽지", Mail],
    ["schema", "DB 구조", BookOpen]
  ];

  return (
    <section className="dashboard">
      <nav className="side-nav">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </nav>
      <div className="workspace">
        {tab === "rooms" && <RoomsAdmin data={data} persist={persist} drop={drop} />}
        {tab === "schedules" && <SchedulesAdmin data={data} persist={persist} drop={drop} />}
        {tab === "upload" && <ExcelUpload data={data} persist={persist} refresh={refresh} notify={notify} />}
        {tab === "reservations" && <ReservationsAdmin data={data} drop={drop} />}
        {tab === "notices" && <NoticesAdmin data={data} persist={persist} drop={drop} />}
        {tab === "messages" && <MessagesAdmin data={data} persist={persist} patch={patch} />}
        {tab === "schema" && <SchemaPanel />}
      </div>
    </section>
  );
}

function RoomsAdmin({ data, persist, drop }) {
  const [form, setForm] = useState({ name: "", capacity: 40, memo: "" });
  async function submit(event) {
    event.preventDefault();
    const id = form.name.replace(/[^A-Za-z0-9가-힣]/g, "") || makeId("room");
    await persist(`/rooms/${id}`, { id, building: BUILDING, ...form, capacity: Number(form.capacity) }, "강의실이 저장되었습니다.");
    setForm({ name: "", capacity: 40, memo: "" });
  }
  return (
    <Panel title="강의실 목록 등록, 수정, 삭제" icon={Building2}>
      <form className="inline-form" onSubmit={submit}>
        <input placeholder="강의실명 예: C25-401" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        <input type="number" min="1" placeholder="정원" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} required />
        <input placeholder="메모" value={form.memo} onChange={(event) => setForm({ ...form, memo: event.target.value })} />
        <button className="primary-button"><Plus size={16} /> 저장</button>
      </form>
      <DataTable headers={["강의실", "건물", "정원", "메모", "관리"]}>
        {objectList(data.rooms).map((room) => (
          <tr key={room.id}>
            <td>{room.name}</td><td>{room.building}</td><td>{room.capacity}</td><td>{room.memo}</td>
            <td><button className="icon-button danger" onClick={() => drop(`/rooms/${room.id}`, "강의실이 삭제되었습니다.")}><Trash2 size={16} /></button></td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}

function SchedulesAdmin({ data, persist, drop }) {
  const rooms = objectList(data.rooms);
  const [form, setForm] = useState({ subject: "", professor: "", department: "", roomId: rooms[0]?.id || "", day: "월", period: 1 });
  async function submit(event) {
    event.preventDefault();
    const period = getPeriod(form.period);
    const room = data.rooms[form.roomId];
    const id = makeId("sch");
    await persist(`/schedules/${id}`, { id, ...form, period: Number(form.period), roomName: room?.name, startTime: period.start, endTime: period.end }, "수업 시간이 저장되었습니다.");
    setForm({ ...form, subject: "", professor: "" });
  }
  return (
    <Panel title="수업 시간표 입력 및 수정" icon={CalendarDays}>
      <form className="inline-form" onSubmit={submit}>
        <input placeholder="과목명" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} required />
        <input placeholder="담당교수" value={form.professor} onChange={(event) => setForm({ ...form, professor: event.target.value })} required />
        <input placeholder="학과" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} required />
        <select value={form.roomId} onChange={(event) => setForm({ ...form, roomId: event.target.value })}>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select>
        <select value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value })}>{["월", "화", "수", "목", "금", "토", "일"].map((day) => <option key={day}>{day}</option>)}</select>
        <select value={form.period} onChange={(event) => setForm({ ...form, period: event.target.value })}>{PERIODS.map((period) => <option key={period.period} value={period.period}>{period.label} {period.slot}</option>)}</select>
        <button className="primary-button"><Save size={16} /> 저장</button>
      </form>
      <ScheduleTable schedules={objectList(data.schedules)} onDelete={(schedule) => drop(`/schedules/${schedule.id}`, "시간표가 삭제되었습니다.")} />
    </Panel>
  );
}

function ExcelUpload({ data, persist, refresh, notify }) {
  const [preview, setPreview] = useState([]);
  async function onFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
    const parsed = parseExcelRows(rows, data.rooms).filter((row) => String(row.roomName).includes(BUILDING) || row.roomId);
    setPreview(parsed);
  }
  async function applyPreview() {
    const validRows = preview.filter((row) => row.valid);
    for (const row of validRows) {
      for (const periodNumber of row.periods) {
        const period = getPeriod(periodNumber);
        const id = makeId("sch");
        await persist(`/schedules/${id}`, {
          id,
          subject: row.subject,
          professor: row.professor,
          department: row.department,
          roomId: row.roomId,
          roomName: row.roomName,
          day: row.day,
          period: periodNumber,
          startTime: period.start,
          endTime: period.end
        });
      }
    }
    await refresh();
    notify(`${validRows.length}개 행을 시간표에 반영했습니다.`);
    setPreview([]);
  }
  return (
    <Panel title="강의편람 엑셀 업로드" icon={Upload}>
      <div className="upload-zone">
        <Upload size={28} />
        <label>.xlsx 파일 선택<input type="file" accept=".xlsx" onChange={onFile} /></label>
      </div>
      {preview.length > 0 && (
        <>
          <div className="table-toolbar">
            <strong>미리보기 {preview.length}행</strong>
            <button className="primary-button" onClick={applyPreview}><CheckCircle2 size={16} /> 반영하기</button>
          </div>
          <DataTable headers={["행", "상태", "과목명", "교수", "학과", "강의실", "요일", "교시", "오류"]}>
            {preview.map((row) => (
              <tr key={row.rowNumber} className={row.valid ? "" : "invalid-row"}>
                <td>{row.rowNumber}</td><td>{row.valid ? "저장 가능" : "제외"}</td><td>{row.subject}</td><td>{row.professor}</td><td>{row.department}</td><td>{row.roomName}</td><td>{row.day}</td><td>{row.periods.join(", ")}</td><td>{row.errors.join(", ")}</td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </Panel>
  );
}

function ReservationsAdmin({ data, drop }) {
  return (
    <Panel title="예약 현황 확인 및 부적절한 예약 삭제" icon={Clock}>
      <ReservationTable reservations={objectList(data.reservations)} onDelete={(reservation) => drop(`/reservations/${reservation.id}`, "예약이 삭제되었습니다.")} />
    </Panel>
  );
}

function NoticesAdmin({ data, persist, drop }) {
  const [form, setForm] = useState({ title: "", body: "" });
  async function submit(event) {
    event.preventDefault();
    const id = makeId("notice");
    await persist(`/notices/${id}`, { id, ...form, createdAt: new Date().toISOString() }, "공지가 등록되었습니다.");
    setForm({ title: "", body: "" });
  }
  return (
    <Panel title="공지사항 등록, 수정, 삭제" icon={Bell}>
      <form className="notice-form" onSubmit={submit}>
        <input placeholder="제목" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
        <textarea placeholder="내용" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required />
        <button className="primary-button"><Plus size={16} /> 등록</button>
      </form>
      <div className="notice-list">
        {objectList(data.notices).map((notice) => (
          <article className="notice-item" key={notice.id}>
            <div><strong>{notice.title}</strong><p>{notice.body}</p></div>
            <button className="icon-button danger" onClick={() => drop(`/notices/${notice.id}`, "공지가 삭제되었습니다.")}><Trash2 size={16} /></button>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function MessagesAdmin({ data, persist, patch }) {
  const [reply, setReply] = useState({});
  async function sendReply(message) {
    const id = makeId("msg");
    await persist(`/messages/${id}`, {
      id,
      from: "admin",
      to: message.from,
      type: "reply",
      title: `Re: ${message.title}`,
      body: reply[message.id] || "확인했습니다.",
      replyTo: message.id,
      createdAt: new Date().toISOString(),
      read: false
    }, "답장을 보냈습니다.");
    setReply({ ...reply, [message.id]: "" });
  }
  async function issueTempPassword(message) {
    const temp = Math.random().toString(36).slice(2, 8);
    await patch(`/users/${message.from}`, { password: temp, tempPasswordIssuedAt: new Date().toISOString() });
    setReply({ ...reply, [message.id]: `임시 비밀번호는 ${temp} 입니다. 로그인 후 비밀번호를 변경해주세요.` });
  }
  return (
    <Panel title="사용자-관리자 쪽지 및 비밀번호 분실 요청" icon={Mail}>
      <div className="message-list">
        {objectList(data.messages).filter((message) => message.to === "admin").map((message) => (
          <article className="message-item" key={message.id}>
            <div className="message-head"><strong>{message.title}</strong><span>{message.from} · {message.type}</span></div>
            <p>{message.body}</p>
            <textarea placeholder="답장 내용" value={reply[message.id] || ""} onChange={(event) => setReply({ ...reply, [message.id]: event.target.value })} />
            <div className="button-row">
              {message.type === "password" && <button className="secondary-button" onClick={() => issueTempPassword(message)}><RefreshCcw size={16} /> 임시 비밀번호 발급</button>}
              <button className="primary-button" onClick={() => sendReply(message)}><Mail size={16} /> 답장</button>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function SchemaPanel() {
  return (
    <Panel title="Firebase Realtime Database 구조" icon={BookOpen}>
      <pre className="schema-box">{databaseSchema}</pre>
    </Panel>
  );
}

function UserDashboard({ data, user, persist, drop, notify }) {
  const [date, setDate] = useState(todayInput());
  const [period, setPeriod] = useState(1);
  const [roomId, setRoomId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState({ type: "inquiry", title: "", body: "" });
  const selectedDay = dayName(date);
  const rooms = objectList(data.rooms);
  const occupancy = useMemo(() => getOccupancy(data, date, period), [data, date, period]);
  const availableRooms = rooms.filter((room) => !occupancy[room.id]);
  const myReservations = objectList(data.reservations).filter((reservation) => reservation.userId === user.studentId);
  const dailyHours = myReservations.filter((reservation) => reservation.date === date).length;

  async function reserve(event) {
    event.preventDefault();
    if (!roomId || !purpose.trim()) {
      notify("강의실과 예약 목적을 입력해주세요.");
      return;
    }
    if (dailyHours >= 2) {
      notify("1인 1일 최대 2시간까지 예약할 수 있습니다.");
      return;
    }
    if (occupancy[roomId]) {
      notify("이미 사용 중인 시간입니다.");
      return;
    }
    const slot = getPeriod(period);
    const room = data.rooms[roomId];
    const id = makeId("res");
    await persist(`/reservations/${id}`, {
      id,
      userId: user.studentId,
      userName: user.department,
      roomId,
      roomName: room.name,
      date,
      day: selectedDay,
      period: Number(period),
      startTime: slot.start,
      endTime: slot.end,
      purpose,
      status: "active",
      createdAt: new Date().toISOString()
    }, "예약이 완료되었습니다.");
    setPurpose("");
  }

  async function sendMessage(event) {
    event.preventDefault();
    const id = makeId("msg");
    await persist(`/messages/${id}`, {
      id,
      from: user.studentId,
      to: "admin",
      ...message,
      createdAt: new Date().toISOString(),
      read: false
    }, "관리자에게 쪽지를 보냈습니다.");
    setMessage({ type: "inquiry", title: "", body: "" });
  }

  return (
    <section className="user-grid">
      <Panel title="C25 전체 강의실 조회" icon={Search}>
        <div className="filters">
          <label>날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>시간<select value={period} onChange={(event) => setPeriod(event.target.value)}>{PERIODS.map((item) => <option key={item.period} value={item.period}>{item.label} {item.slot}</option>)}</select></label>
        </div>
        <div className="room-grid">
          {rooms.map((room) => {
            const use = occupancy[room.id];
            const state = use?.type === "schedule" ? "busy" : use?.type === "reservation" ? "reserved" : "available";
            return (
              <article className={`room-card ${state}`} key={room.id}>
                <div><strong>{room.name}</strong><span>{room.capacity}석</span></div>
                <p>{state === "available" ? "사용 가능" : use.type === "schedule" ? `${use.subject} · ${use.professor} · ${use.department}` : `예약됨 · ${use.purpose}`}</p>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="원하는 날짜와 시간대 예약" icon={CalendarDays}>
        <form className="form-grid" onSubmit={reserve}>
          <label>예약 가능 강의실<select value={roomId} onChange={(event) => setRoomId(event.target.value)} required><option value="">선택</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
          <label>예약 목적<input placeholder="팀플, 스터디, 발표 연습" value={purpose} onChange={(event) => setPurpose(event.target.value)} required /></label>
          <button className="primary-button"><CheckCircle2 size={18} /> 1시간 예약</button>
          <p className="hint">오늘 선택한 날짜의 예약 시간: {dailyHours}/2시간</p>
        </form>
      </Panel>

      <Panel title="내 예약 확인 및 취소" icon={Clock}>
        <ReservationTable reservations={myReservations} onDelete={(reservation) => drop(`/reservations/${reservation.id}`, "예약을 취소했습니다.")} />
      </Panel>

      <Panel title="공지사항 확인" icon={Bell}>
        <div className="notice-list">
          {objectList(data.notices).map((notice) => <article className="notice-item" key={notice.id}><strong>{notice.title}</strong><p>{notice.body}</p></article>)}
        </div>
      </Panel>

      <Panel title="관리자에게 쪽지 보내기" icon={Mail}>
        <form className="notice-form" onSubmit={sendMessage}>
          <select value={message.type} onChange={(event) => setMessage({ ...message, type: event.target.value })}>
            <option value="inquiry">문의</option>
            <option value="password">비밀번호 분실 요청</option>
          </select>
          <input placeholder="제목" value={message.title} onChange={(event) => setMessage({ ...message, title: event.target.value })} required />
          <textarea placeholder="내용" value={message.body} onChange={(event) => setMessage({ ...message, body: event.target.value })} required />
          <button className="primary-button"><Mail size={16} /> 보내기</button>
        </form>
        <div className="message-list compact">
          {objectList(data.messages).filter((item) => item.to === user.studentId).map((item) => <article className="message-item" key={item.id}><strong>{item.title}</strong><p>{item.body}</p></article>)}
        </div>
      </Panel>

      <Panel title="내 정보 확인" icon={UserRound}>
        <div className="profile-box">
          <span>학번</span><strong>{user.studentId}</strong>
          <span>소속대학</span><strong>{user.college}</strong>
          <span>소속학과</span><strong>{user.department}</strong>
          <span>전화번호</span><strong>{user.phone}</strong>
        </div>
      </Panel>
    </section>
  );
}

function getOccupancy(data, date, period) {
  const day = dayName(date);
  const result = {};
  objectList(data.schedules).forEach((schedule) => {
    if (schedule.day === day && Number(schedule.period) === Number(period)) {
      result[schedule.roomId] = { type: "schedule", ...schedule };
    }
  });
  objectList(data.reservations).forEach((reservation) => {
    if (reservation.date === date && Number(reservation.period) === Number(period)) {
      result[reservation.roomId] = { type: "reservation", ...reservation };
    }
  });
  return result;
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="panel">
      <div className="panel-title"><Icon size={20} /><h2>{title}</h2></div>
      {children}
    </section>
  );
}

function DataTable({ headers, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function ScheduleTable({ schedules, onDelete }) {
  return (
    <DataTable headers={["과목", "교수", "학과", "강의실", "요일", "시간", "관리"]}>
      {schedules.map((schedule) => (
        <tr key={schedule.id}>
          <td>{schedule.subject}</td><td>{schedule.professor}</td><td>{schedule.department}</td><td>{schedule.roomName}</td><td>{schedule.day}</td><td>{schedule.period}교시 {schedule.startTime}-{schedule.endTime}</td>
          <td>{onDelete && <button className="icon-button danger" onClick={() => onDelete(schedule)}><Trash2 size={16} /></button>}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function ReservationTable({ reservations, onDelete }) {
  return (
    <DataTable headers={["날짜", "강의실", "시간", "예약자", "목적", "관리"]}>
      {reservations.map((reservation) => (
        <tr key={reservation.id}>
          <td>{reservation.date}</td><td>{reservation.roomName}</td><td>{reservation.period}교시 {reservation.startTime}-{reservation.endTime}</td><td>{reservation.userId}</td><td>{reservation.purpose}</td>
          <td>{onDelete && <button className="icon-button danger" onClick={() => onDelete(reservation)}><XCircle size={16} /></button>}</td>
        </tr>
      ))}
    </DataTable>
  );
}

export default App;
