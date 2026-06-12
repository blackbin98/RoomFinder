import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Bell,
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
      status: "approved",
      name: "관리자",
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
  const text = String(value || "");
  const periods = [];
  const rangePattern = /(\d+)\s*-\s*(\d+)/g;
  let rangeMatch;
  while ((rangeMatch = rangePattern.exec(text))) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);
    for (let period = Math.min(start, end); period <= Math.max(start, end); period += 1) {
      periods.push(period);
    }
  }
  const withoutRanges = text.replace(rangePattern, "");
  const singles = withoutRanges.match(/\d+/g) || [];
  periods.push(...singles.map(Number));
  return [...new Set(periods.filter((number) => number >= 1 && number <= 12))];
}

function parseScheduleSlot(value) {
  const text = String(value || "").trim();
  const day = text.match(/[월화수목금토일]/)?.[0] || "";
  const periods = parsePeriods(text);
  return { day, periods };
}

function parseWorkbookRows(workbook) {
  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (matrix.length < 3) return [];
    const headerRow1 = matrix[0] || [];
    const headerRow2 = matrix[1] || [];
    const headers = headerRow1.map((header, index) => {
      const first = String(header || "").trim();
      const second = String(headerRow2[index] || "").trim();
      return [first, second].filter(Boolean).join(" ");
    });
    return matrix.slice(2).map((values, index) => {
      const row = { __rowNumber: index + 3, __sheetName: sheetName };
      headers.forEach((header, headerIndex) => {
        row[header || `column_${headerIndex + 1}`] = values[headerIndex];
      });
      return row;
    });
  });
}

function parseExcelRows(rows, rooms) {
  const roomValues = objectList(rooms);
  return rows.flatMap((row, index) => {
    const base = {
      rowNumber: row.__rowNumber || index + 2,
      sheetName: row.__sheetName || "",
      subject: String(pick(row, ["교과목명", "과목명", "강좌명"])).trim(),
      professor: String(pick(row, ["담당교수 성명", "성명", "담당교수", "교수", "교원명"])).trim(),
      department: String(pick(row, ["개설 학부(과)/전공", "학부(과)/전공", "개설학과", "소속학과", "학과"])).trim()
    };
    const directRoomName = String(pick(row, ["강의실", "강의실명", "장소", "호실"])).trim();
    const directSlot = parseScheduleSlot(pick(row, ["강의교시", "교시", "시간"]));
    const roomKeys = Object.keys(row).filter((key) => normalizeHeader(key).includes("강의실"));
    const slotKeys = Object.keys(row).filter((key) => normalizeHeader(key).includes("강의교시"));
    const pairs = roomKeys.length || slotKeys.length
      ? Array.from({ length: Math.max(roomKeys.length, slotKeys.length) }, (_, pairIndex) => ({
          roomName: String(row[roomKeys[pairIndex]] || "").trim(),
          slot: parseScheduleSlot(row[slotKeys[pairIndex]])
        }))
      : [{ roomName: directRoomName, slot: directSlot }];

    return pairs
      .filter((pair) => pair.roomName || pair.slot.day || pair.slot.periods.length)
      .map((pair, pairIndex) => {
        const roomName = pair.roomName;
        const room = roomValues.find((item) => item.name === roomName || item.id === roomName || roomName.includes(item.name));
        const generatedRoomId = room?.id || roomName.replace(/[^A-Za-z0-9가-힣]/g, "");
        const errors = [];
        if (!base.subject) errors.push("과목명 없음");
        if (!base.professor) errors.push("담당교수 없음");
        if (!base.department) errors.push("학과 없음");
        if (!roomName.includes(BUILDING)) errors.push("C25 강의실 아님");
        if (!["월", "화", "수", "목", "금", "토", "일"].includes(pair.slot.day)) errors.push("요일 오류");
        if (!pair.slot.periods.length) errors.push("교시 오류");
        return {
          ...base,
          rowKey: `${base.sheetName}-${base.rowNumber}-${pairIndex}`,
          roomId: generatedRoomId,
          roomName,
          roomAutoCreated: !room && roomName.includes(BUILDING),
          day: pair.slot.day,
          periods: pair.slot.periods,
          valid: errors.length === 0,
          errors
        };
      });
  });
}

function App() {
  const [data, setData] = useState(defaultData);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("login");
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [loginForm, setLoginForm] = useState({ studentId: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    role: "user",
    studentId: "",
    password: "",
    name: "",
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
    if (user.status && user.status !== "approved") {
      notify("관리자 승인 후 이용할 수 있습니다.");
      return;
    }
    setCurrentUser(user);
    setScreen(user.role === "admin" ? "admin" : "user");
  }

  async function signup(event) {
    event.preventDefault();
    if (signupForm.role === "user" && signupForm.college !== ALLOWED_COLLEGE) {
      notify("인문사회과학대학 소속 학생만 가입할 수 있습니다.");
      return;
    }
    if (data.users?.[signupForm.studentId]) {
      notify("이미 등록된 학번입니다.");
      return;
    }
    const user = { ...signupForm, status: "pending", requestedAt: new Date().toISOString() };
    await persist(`/users/${signupForm.studentId}`, user, "회원가입 요청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
    setSignupForm({ role: "user", studentId: "", password: "", name: "", college: ALLOWED_COLLEGE, department: "", phone: "" });
    setAuthMode("login");
  }

  function logout() {
    setCurrentUser(null);
    setScreen("login");
    setLoginForm({ studentId: "", password: "" });
    setAuthMode(null);
  }

  if (loading) return <div className="loading">RoomFinder를 준비하고 있습니다.</div>;

  return (
    <main>
      <header className="app-header">
        <div>
          <button className="brand-row brand-button" type="button" onClick={() => {
            setScreen("login");
            setCurrentUser(null);
            setAuthMode(null);
          }}>
            <Building2 size={30} />
            <h1>RoomFinder</h1>
          </button>
          <p>부경대학교 강의실 조회 · 예약 서비스</p>
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
        <UserDashboard
          data={data}
          user={currentUser}
          persist={persist}
          patch={patch}
          drop={drop}
          notify={notify}
          onUserUpdate={setCurrentUser}
        />
      )}
    </main>
  );
}

function AuthScreen({ authMode, setAuthMode, loginForm, setLoginForm, signupForm, setSignupForm, login, signup }) {
  return (
    <section className="auth-layout">
      <div className="hero-copy">
        <span className="pill">부경대학교 C25 시범 운영</span>
        <h2>RoomFinder</h2>
        <div className="hero-message-box">
          <strong>팀플이 있는데 공간이 없다면?</strong>
          <p>RoomFinder와 함께 빈 강의실을 찾고, 학습 공간을 더욱 효율적으로 활용해 보세요.</p>
        </div>
        <div className="status-legend">
          <span><i className="dot available" /> 사용 가능</span>
          <span><i className="dot busy" /> 수업 중</span>
          <span><i className="dot reserved" /> 예약됨</span>
        </div>
      </div>
      <div className="home-actions panel">
        <h2>부경대학교 강의실 조회 · 예약 서비스</h2>
        <p>C25 강의실 현황을 빠르게 확인하고 필요한 시간에 예약하세요.</p>
        <div className="button-row">
          <button className="primary-button" onClick={() => setAuthMode("login")}><Shield size={18} /> 로그인</button>
          <button className="secondary-button" onClick={() => setAuthMode("signup")}><UserRound size={18} /> 회원가입</button>
        </div>
      </div>
      {authMode && (
        <Modal title={authMode === "login" ? "로그인" : "회원가입"} onClose={() => setAuthMode(null)}>
          <div className="auth-card">
            <div className="auth-card-hero">
              <span>{authMode === "login" ? "Welcome back" : "Join RoomFinder"}</span>
              <h3>{authMode === "login" ? "강의실 예약을 시작하세요." : "승인 후 RoomFinder를 이용할 수 있습니다."}</h3>
            </div>
            <div className="segmented auth-tabs">
              <button className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>로그인</button>
              <button className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>회원가입</button>
            </div>
            {authMode === "login" ? (
              <form onSubmit={login} className="form-grid auth-form">
                <label>학번<input placeholder="20260001" value={loginForm.studentId} onChange={(event) => setLoginForm({ ...loginForm, studentId: event.target.value })} required /></label>
                <label>비밀번호<input placeholder="1234" type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} required /></label>
                <button className="primary-button"><Shield size={18} /> 로그인</button>
              </form>
            ) : (
              <form onSubmit={signup} className="form-grid auth-form">
                <label>가입 유형<select value={signupForm.role} onChange={(event) => setSignupForm({ ...signupForm, role: event.target.value })}>
                  <option value="user">사용자</option>
                  <option value="admin">관리자</option>
                </select></label>
                <label>학번<input placeholder="20260001" value={signupForm.studentId} onChange={(event) => setSignupForm({ ...signupForm, studentId: event.target.value })} required /></label>
                <label>비밀번호<input placeholder="1234" type="password" value={signupForm.password} onChange={(event) => setSignupForm({ ...signupForm, password: event.target.value })} required /></label>
                <label>이름<input placeholder="홍길동" value={signupForm.name} onChange={(event) => setSignupForm({ ...signupForm, name: event.target.value })} required /></label>
                <label>소속대학<input value={signupForm.college} onChange={(event) => setSignupForm({ ...signupForm, college: event.target.value })} required /></label>
                <label>소속학과<input value={signupForm.department} onChange={(event) => setSignupForm({ ...signupForm, department: event.target.value })} required /></label>
                <label>전화번호<input value={signupForm.phone} onChange={(event) => setSignupForm({ ...signupForm, phone: event.target.value })} required /></label>
                <button className="primary-button"><UserRound size={18} /> 가입 승인 요청</button>
                <p className="hint">관리자 승인 후 로그인할 수 있습니다.</p>
              </form>
            )}
          </div>
        </Modal>
      )}
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
    ["approvals", "가입 승인", UserRound],
    ["members", "회원 목록", UserRound],
    ["notices", "공지", Bell],
    ["messages", "쪽지", Mail]
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
        {tab === "approvals" && <ApprovalsAdmin data={data} patch={patch} />}
        {tab === "members" && <MembersAdmin data={data} patch={patch} />}
        {tab === "notices" && <NoticesAdmin data={data} persist={persist} drop={drop} />}
        {tab === "messages" && <MessagesAdmin data={data} persist={persist} patch={patch} />}
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
  const [selectedRows, setSelectedRows] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  function selectFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".xlsx")) {
      notify(".xlsx 파일만 업로드할 수 있습니다.");
      return;
    }
    setSelectedFile(file);
    setPreview([]);
    setSelectedRows({});
  }

  async function confirmFile() {
    if (!selectedFile) {
      notify("먼저 엑셀 파일을 선택해주세요.");
      return;
    }
    const buffer = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const rows = parseWorkbookRows(workbook);
    const parsed = parseExcelRows(rows, data.rooms).filter((row) => String(row.roomName).includes(BUILDING) || row.roomId);
    setPreview(parsed);
    setSelectedRows(Object.fromEntries(parsed.map((row) => [row.rowKey || row.rowNumber, row.valid])));
    notify(`${parsed.length}개 C25 시간표 후보를 확인했습니다.`);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function applyPreview() {
    const validRows = preview.filter((row) => row.valid && selectedRows[row.rowKey || row.rowNumber]);
    if (!validRows.length) {
      notify("반영할 시간표를 선택해주세요.");
      return;
    }
    for (const row of validRows) {
      if (!data.rooms[row.roomId]) {
        await savePath(`/rooms/${row.roomId}`, {
          id: row.roomId,
          building: BUILDING,
          name: row.roomName,
          capacity: 40,
          memo: "강의편람 업로드 자동 등록"
        });
      }
      for (const periodNumber of row.periods) {
        const period = getPeriod(periodNumber);
        const id = makeId("sch");
        await savePath(`/schedules/${id}`, {
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
    notify(`${validRows.length}개 시간표를 저장했습니다.`);
    setPreview([]);
    setSelectedFile(null);
    setSelectedRows({});
  }

  function toggleAll(checked) {
    setSelectedRows(Object.fromEntries(preview.map((row) => [row.rowKey || row.rowNumber, checked && row.valid])));
  }

  function toggleRow(row, checked) {
    setSelectedRows({ ...selectedRows, [row.rowKey || row.rowNumber]: checked });
  }

  return (
    <Panel title="강의편람 엑셀 업로드" icon={Upload}>
      <div
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={28} />
        <strong>2026-1학기 강의편람 .xlsx 파일을 드래그하거나 선택하세요.</strong>
        <label className="file-picker">파일 선택<input type="file" accept=".xlsx" onChange={(event) => selectFile(event.target.files?.[0])} /></label>
        {selectedFile && <p className="hint">선택된 파일: {selectedFile.name}</p>}
        <button className="secondary-button" type="button" onClick={confirmFile}><Search size={16} /> 시간표 조회</button>
      </div>
      {preview.length > 0 && (
        <>
          <div className="table-toolbar">
            <strong>과목별 시간표 {preview.length}개 · 선택 {preview.filter((row) => selectedRows[row.rowKey || row.rowNumber]).length}개</strong>
            <div className="button-row">
              <button className="secondary-button" type="button" onClick={() => toggleAll(true)}>전체 선택</button>
              <button className="secondary-button" type="button" onClick={() => toggleAll(false)}>전체 해제</button>
            </div>
            <button className="primary-button" onClick={applyPreview}><CheckCircle2 size={16} /> 반영하기</button>
          </div>
          <DataTable headers={["선택", "시트", "행", "상태", "과목명", "교수", "학과", "강의실", "요일", "교시", "오류"]}>
            {preview.map((row) => (
              <tr key={row.rowKey || row.rowNumber} className={row.valid ? "" : "invalid-row"}>
                <td><input className="row-check" type="checkbox" checked={Boolean(selectedRows[row.rowKey || row.rowNumber])} disabled={!row.valid} onChange={(event) => toggleRow(row, event.target.checked)} /></td>
                <td>{row.sheetName}</td><td>{row.rowNumber}</td><td>{row.valid ? "저장 가능" : "제외"}</td><td>{row.subject}</td><td>{row.professor}</td><td>{row.department}</td><td>{row.roomName}</td><td>{row.day}</td><td>{row.periods.join(", ")}</td><td>{row.errors.join(", ")}</td>
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

function ApprovalsAdmin({ data, patch }) {
  const users = objectList(data.users).filter((user) => user.studentId !== "admin");
  const pendingUsers = users.filter((user) => user.status === "pending" || user.status === "rejected");

  return (
    <Panel title="회원가입 승인 관리" icon={UserRound}>
      <div className="table-toolbar">
        <strong>승인 대기 {pendingUsers.length}명</strong>
      </div>
      <DataTable headers={["상태", "유형", "학번", "이름", "소속대학", "소속학과", "전화번호", "관리"]}>
        {users.map((user) => (
          <tr key={user.studentId}>
            <td><span className={`status-badge ${user.status === "approved" ? "ok" : "wait"}`}>{user.status === "approved" ? "승인" : user.status === "rejected" ? "보류" : "대기"}</span></td>
            <td>{user.role === "admin" ? "관리자" : "사용자"}</td>
            <td>{user.studentId}</td>
            <td>{user.name || "-"}</td>
            <td>{user.college}</td>
            <td>{user.department}</td>
            <td>{user.phone}</td>
            <td>
              <div className="button-row compact-buttons">
                <button className="secondary-button" type="button" onClick={() => patch(`/users/${user.studentId}`, { status: "approved", approvedAt: new Date().toISOString() }, "가입을 승인했습니다.")}>
                  <CheckCircle2 size={16} /> 승인
                </button>
                <button className="secondary-button danger" type="button" onClick={() => patch(`/users/${user.studentId}`, { status: "rejected", rejectedAt: new Date().toISOString() }, "가입 요청을 보류했습니다.")}>
                  <XCircle size={16} /> 보류
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  );
}

function MembersAdmin({ data, patch }) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState({});
  const users = objectList(data.users);

  function startEdit(user) {
    setEditingId(user.studentId);
    setForm({
      name: user.name || "",
      role: user.role || "user",
      status: user.status || "approved",
      college: user.college || "",
      department: user.department || "",
      phone: user.phone || "",
      password: user.password || ""
    });
  }

  async function saveMember(event) {
    event.preventDefault();
    await patch(`/users/${editingId}`, form, "회원 정보를 수정했습니다.");
    setEditingId("");
    setForm({});
  }

  return (
    <Panel title="회원 목록 조회 및 개인정보 수정" icon={UserRound}>
      <DataTable headers={["학번", "이름", "유형", "상태", "소속대학", "소속학과", "전화번호", "관리"]}>
        {users.map((member) => (
          <tr key={member.studentId}>
            <td>{member.studentId}</td>
            <td>{member.name || "-"}</td>
            <td>{member.role === "admin" ? "관리자" : "사용자"}</td>
            <td><span className={`status-badge ${member.status === "approved" ? "ok" : "wait"}`}>{member.status === "approved" ? "승인" : member.status === "rejected" ? "보류" : "대기"}</span></td>
            <td>{member.college}</td>
            <td>{member.department}</td>
            <td>{member.phone}</td>
            <td><button className="secondary-button" type="button" onClick={() => startEdit(member)}><Save size={16} /> 수정</button></td>
          </tr>
        ))}
      </DataTable>

      {editingId && (
        <Modal title="회원 정보 수정" onClose={() => setEditingId("")}>
          <form className="form-grid" onSubmit={saveMember}>
            <label>학번<input value={editingId} disabled /></label>
            <label>이름<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
            <label>유형<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              <option value="user">사용자</option>
              <option value="admin">관리자</option>
            </select></label>
            <label>상태<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="approved">승인</option>
              <option value="pending">대기</option>
              <option value="rejected">보류</option>
            </select></label>
            <label>소속대학<input value={form.college} onChange={(event) => setForm({ ...form, college: event.target.value })} required /></label>
            <label>소속학과<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} required /></label>
            <label>전화번호<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></label>
            <label>비밀번호<input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /></label>
            <button className="primary-button"><Save size={16} /> 저장</button>
          </form>
        </Modal>
      )}
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

function UserDashboard({ data, user, persist, patch, drop, notify, onUserUpdate }) {
  const [date, setDate] = useState(todayInput());
  const [period, setPeriod] = useState(1);
  const [roomId, setRoomId] = useState("");
  const [purpose, setPurpose] = useState("");
  const [message, setMessage] = useState({ type: "inquiry", title: "", body: "" });
  const [activeModal, setActiveModal] = useState(null);
  const [profileForm, setProfileForm] = useState({
    password: user.password || "",
    phone: user.phone || ""
  });
  const selectedDay = dayName(date);
  const rooms = objectList(data.rooms);
  const occupancy = useMemo(() => getOccupancy(data, date, period), [data, date, period]);
  const availableRooms = rooms.filter((room) => !occupancy[room.id]);
  const busyRooms = rooms.filter((room) => occupancy[room.id]?.type === "schedule");
  const reservedRooms = rooms.filter((room) => occupancy[room.id]?.type === "reservation");
  const myReservations = objectList(data.reservations).filter((reservation) => reservation.userId === user.studentId);
  const dailyHours = myReservations.filter((reservation) => reservation.date === date).length;
  const today = todayInput();

  useEffect(() => {
    setProfileForm({
      password: user.password || "",
      phone: user.phone || ""
    });
  }, [user]);

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
      userName: user.name || user.department,
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

  async function saveProfile(event) {
    event.preventDefault();
    await patch(`/users/${user.studentId}`, profileForm, "개인정보를 수정했습니다.");
    onUserUpdate({ ...user, ...profileForm });
  }

  function openReserveFor(room) {
    setRoomId(room.id);
    setActiveModal("reserve");
  }

  return (
    <section className="user-grid">
      <div className="user-action-bar">
        <button className="primary-button" onClick={() => setActiveModal("reserve")}><CalendarDays size={18} /> 예약하기</button>
        <button className="secondary-button" onClick={() => setActiveModal("myReservations")}><Clock size={18} /> 내 예약</button>
        <button className="secondary-button" onClick={() => setActiveModal("message")}><Mail size={18} /> 쪽지</button>
        <button className="secondary-button" onClick={() => setActiveModal("profile")}><UserRound size={18} /> 개인정보</button>
      </div>

      <Panel title="C25 전체 강의실 조회" icon={Search}>
        <div className="filters">
          <label>날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label>시간<select value={period} onChange={(event) => setPeriod(event.target.value)}>{PERIODS.map((item) => <option key={item.period} value={item.period}>{item.label} {item.slot}</option>)}</select></label>
          <span className="today-chip">오늘 {today}</span>
        </div>
        <div className="room-summary">
          <article className="summary-card available"><span>예약 가능</span><strong>{availableRooms.length}</strong></article>
          <article className="summary-card busy"><span>수업 중</span><strong>{busyRooms.length}</strong></article>
          <article className="summary-card reserved"><span>예약됨</span><strong>{reservedRooms.length}</strong></article>
        </div>
        <div className="room-grid">
          {rooms.map((room) => {
            const use = occupancy[room.id];
            const state = use?.type === "schedule" ? "busy" : use?.type === "reservation" ? "reserved" : "available";
            const stateLabel = state === "available" ? "예약 가능" : state === "busy" ? "수업 중" : "예약됨";
            return (
              <article className={`room-card ${state}`} key={room.id}>
                <div className="room-card-head">
                  <strong>{room.name}</strong>
                  <span className={`room-state ${state}`}>{stateLabel}</span>
                </div>
                <p>{state === "available" ? `${room.capacity}석 · 바로 예약할 수 있습니다.` : use.type === "schedule" ? `${use.subject} · ${use.professor} · ${use.department}` : `${use.purpose} · ${use.userId}`}</p>
                {state === "available" ? (
                  <button className="room-reserve-button" type="button" onClick={() => openReserveFor(room)}>예약</button>
                ) : (
                  <span className="room-meta">{state === "busy" ? "정규 수업 시간" : "학생 예약 시간"}</span>
                )}
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="공지사항 확인" icon={Bell}>
        <div className="notice-list">
          {objectList(data.notices).map((notice) => <article className="notice-item" key={notice.id}><strong>{notice.title}</strong><p>{notice.body}</p></article>)}
        </div>
      </Panel>

      {activeModal === "reserve" && (
        <Modal title="강의실 예약" onClose={() => setActiveModal(null)}>
          <div className="calendar-summary">
            <CalendarDays size={24} />
            <div><span>오늘</span><strong>{today}</strong></div>
          </div>
          <form className="form-grid" onSubmit={reserve}>
            <label>예약 날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>예약 시간<select value={period} onChange={(event) => setPeriod(event.target.value)}>{PERIODS.map((item) => <option key={item.period} value={item.period}>{item.label} {item.slot}</option>)}</select></label>
            <label>예약 가능 강의실<select value={roomId} onChange={(event) => setRoomId(event.target.value)} required><option value="">선택</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
            <label>예약 목적<input placeholder="팀플, 스터디, 발표 연습" value={purpose} onChange={(event) => setPurpose(event.target.value)} required /></label>
            <button className="primary-button"><CheckCircle2 size={18} /> 1시간 예약</button>
            <p className="hint">선택한 날짜의 예약 시간: {dailyHours}/2시간</p>
          </form>
        </Modal>
      )}

      {activeModal === "myReservations" && (
        <Modal title="내 예약 확인 및 취소" onClose={() => setActiveModal(null)}>
          <ReservationTable reservations={myReservations} onDelete={(reservation) => drop(`/reservations/${reservation.id}`, "예약을 취소했습니다.")} />
        </Modal>
      )}

      {activeModal === "message" && (
        <Modal title="관리자에게 쪽지 보내기" onClose={() => setActiveModal(null)}>
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
        </Modal>
      )}

      {activeModal === "profile" && (
        <Modal title="내 정보 확인 및 수정" onClose={() => setActiveModal(null)}>
          <form className="form-grid" onSubmit={saveProfile}>
            <label>학번<input value={user.studentId} disabled /></label>
            <label>이름<input value={user.name || ""} disabled /></label>
            <label>가입 유형<input value={user.role === "admin" ? "관리자" : "사용자"} disabled /></label>
            <label>소속대학<input value={user.college || ""} disabled /></label>
            <label>소속학과<input value={user.department || ""} disabled /></label>
            <label>비밀번호<input type="password" value={profileForm.password} onChange={(event) => setProfileForm({ ...profileForm, password: event.target.value })} required /></label>
            <label>전화번호<input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} required /></label>
            <button className="primary-button"><Save size={16} /> 수정 저장</button>
            <p className="hint">이름, 학번, 소속 정보는 관리자 승인 정보로 고정됩니다.</p>
          </form>
        </Modal>
      )}
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

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-sheet" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기"><XCircle size={18} /></button>
        </div>
        {children}
      </section>
    </div>
  );
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
