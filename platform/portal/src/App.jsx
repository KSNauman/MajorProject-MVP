import { useState, useEffect } from 'react';
import './App.css';
import { apiFetch, logger } from './logger';

const API_URL = 'http://localhost:4000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [view, setView] = useState('LANDING'); // LANDING, TEACHER_LOGIN, STUDENT_CLASS, STUDENT_SELECT

  const login = async (username, password) => {
    logger.newCorrelationId();
    try {
      const res = await apiFetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      alert(`${err.message} ${err.requestId ? `(ReqID: ${err.requestId})` : ''}`);
    }
  };

  const studentLogin = async (studentId, classId) => {
    logger.newCorrelationId();
    try {
      const res = await apiFetch(`${API_URL}/auth/student-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, classId })
      });
      const data = await res.json();
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      alert(`${err.message} ${err.requestId ? `(ReqID: ${err.requestId})` : ''}`);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setView('LANDING');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (token && user) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', backgroundColor: '#f0f9ff', minHeight: '100vh' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, borderBottom: '3px solid #60a5fa', paddingBottom: 10 }}>
          <h1 style={{ margin: 0, color: '#1d4ed8' }}>EduVision ✨</h1>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {user.avatar && <img src={user.avatar} alt="avatar" style={{width: 40, height: 40, borderRadius: '50%', marginRight: 10}} />}
            <span style={{ fontSize: '1.2em' }}>Hi, <strong>{user.displayName || user.username}</strong></span>
            <button onClick={logout} style={{ marginLeft: 15, padding: '8px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' }}>Exit</button>
          </div>
        </header>
        {['TEACHER', 'ADMIN'].includes(user.role) ? <TeacherDashboard token={token} /> : <StudentDashboard token={token} />}
      </div>
    );
  }

  return (
    <div style={{ padding: 50, textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#f0f9ff', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h1 style={{ fontSize: '4em', color: '#1d4ed8', marginBottom: 40 }}>EduVision ✨</h1>
      
      {view === 'LANDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: 300, alignItems: 'center' }}>
          <button onClick={() => setView('STUDENT_CLASS')} style={{ padding: '20px 40px', fontSize: '1.8em', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 16, cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', fontWeight: 'bold', width: '100%' }}>
            I'm a Student! 🎒
          </button>
          <button onClick={() => setView('TEACHER_LOGIN')} style={{ padding: '10px', fontSize: '1em', backgroundColor: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginTop: 20 }}>
            Teacher Login
          </button>
        </div>
      )}

      {view === 'TEACHER_LOGIN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, width: 300 }}>
          <h2 style={{color: '#334155'}}>Teacher Login</h2>
          <Login onLogin={login} />
          <button onClick={() => setView('LANDING')} style={{ padding: '10px', backgroundColor: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Back</button>
        </div>
      )}

      {view === 'STUDENT_CLASS' && <StudentClassSelect onClassSelect={(c) => { setView('STUDENT_SELECT'); localStorage.setItem('selectedClass', JSON.stringify(c)); }} onBack={() => setView('LANDING')} />}
      
      {view === 'STUDENT_SELECT' && <StudentAvatarSelect classInfo={JSON.parse(localStorage.getItem('selectedClass'))} onStudentSelect={studentLogin} onBack={() => setView('STUDENT_CLASS')} />}
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }} />
      <button onClick={() => onLogin(username, password)} style={{ padding: 12, cursor: 'pointer', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 8, fontWeight: 'bold' }}>Log In</button>
    </div>
  );
}

function StudentClassSelect({ onClassSelect, onBack }) {
  const [classes, setClasses] = useState([]);
  
  useEffect(() => {
    apiFetch(`${API_URL}/portal/public/classes`).then(r => r.json()).then(setClasses).catch(e => console.error("Failed to fetch classes", e));
  }, []);

  return (
    <div style={{ width: '100%', maxWidth: 800 }}>
      <button onClick={onBack} style={{ marginBottom: 20, padding: '10px 20px', fontSize: '1.2em', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', textDecoration: 'underline' }}>⬅️ Back</button>
      <h2 style={{ fontSize: '2.5em', color: '#334155' }}>Select Your Class</h2>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginTop: 30 }}>
        {classes.map(c => (
          <button key={c.id} onClick={() => onClassSelect(c)} style={{ padding: '30px', fontSize: '1.8em', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: 20, cursor: 'pointer', minWidth: 250, fontWeight: 'bold', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function StudentAvatarSelect({ classInfo, onStudentSelect, onBack }) {
  const [students, setStudents] = useState([]);
  
  useEffect(() => {
    apiFetch(`${API_URL}/portal/public/classes/${classInfo.id}/students`).then(r => r.json()).then(setStudents).catch(e => console.error("Failed to fetch students", e));
  }, [classInfo.id]);

  return (
    <div style={{ width: '100%', maxWidth: 800 }}>
      <button onClick={onBack} style={{ marginBottom: 20, padding: '10px 20px', fontSize: '1.2em', borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', textDecoration: 'underline' }}>⬅️ Back to Classes</button>
      <h2 style={{ fontSize: '2.5em', color: '#334155' }}>Who are you?</h2>
      <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', justifyContent: 'center', marginTop: 30 }}>
        {students.map(s => (
          <div key={s.id} onClick={() => onStudentSelect(s.id, classInfo.id)} style={{ padding: '20px', backgroundColor: 'white', borderRadius: 20, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.2s', width: 160 }} onMouseOver={e=>e.currentTarget.style.transform='scale(1.1)'} onMouseOut={e=>e.currentTarget.style.transform='scale(1)'}>
            {s.avatar ? <img src={s.avatar} alt="avatar" style={{width: 100, height: 100, marginBottom: 15}} /> : <div style={{width: 100, height: 100, backgroundColor: '#e2e8f0', borderRadius: '50%', marginBottom: 15}}></div>}
            <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#475569' }}>{s.displayName || s.username}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherDashboard({ token }) {
  const [apps, setApps] = useState([]);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newClassName, setNewClassName] = useState('');
  const [newAssignment, setNewAssignment] = useState({ title: '', classId: '', appId: '' });

  const fetchHeaders = { 'Authorization': `Bearer ${token}` };

  const loadData = async () => {
    setLoading(true);
    try {
      const [appsRes, classesRes, assignsRes] = await Promise.all([
        apiFetch(`${API_URL}/apps`, { headers: fetchHeaders }),
        apiFetch(`${API_URL}/portal/classes`, { headers: fetchHeaders }),
        apiFetch(`${API_URL}/portal/teacher/assignments`, { headers: fetchHeaders })
      ]);
      setApps((await appsRes.json()).apps);
      setClasses(await classesRes.json());
      setAssignments(await assignsRes.json());
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const createClass = async () => {
    if (!newClassName) return;
    await apiFetch(`${API_URL}/portal/classes`, { method: 'POST', headers: { ...fetchHeaders, 'Content-Type': 'application/json'}, body: JSON.stringify({ name: newClassName }) }).catch(e => alert(e.message));
    setNewClassName('');
    loadData();
  };
  
  const createAssignment = async () => {
    if (!newAssignment.title || !newAssignment.classId || !newAssignment.appId) return;
    await apiFetch(`${API_URL}/portal/assignments`, { method: 'POST', headers: { ...fetchHeaders, 'Content-Type': 'application/json'}, body: JSON.stringify(newAssignment) }).catch(e => alert(e.message));
    setNewAssignment({ title: '', classId: '', appId: '' });
    loadData();
  };

  if (loading) return <p>Loading dashboard...</p>;

  return (
    <div>
      <h2 style={{ color: '#1e293b' }}>Teacher Dashboard</h2>
      
      <div style={{ display: 'flex', gap: 20 }}>
        <section style={{ border: '1px solid #cbd5e1', padding: 15, flex: 1, borderRadius: 8, backgroundColor: 'white' }}>
          <h3>Create Class</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder="Class Name" value={newClassName} onChange={e => setNewClassName(e.target.value)} style={{flex: 1, padding: 8, borderRadius: 4, border: '1px solid #cbd5e1'}} />
            <button onClick={createClass} style={{padding: '8px 15px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer'}}>Create</button>
          </div>
          <ul style={{ marginTop: 15, paddingLeft: 20 }}>
            {classes.length === 0 ? <li style={{color: '#94a3b8'}}>No classes yet</li> : classes.map(c => <li key={c.id} style={{padding: '5px 0'}}>{c.name}</li>)}
          </ul>
        </section>

        <section style={{ border: '1px solid #cbd5e1', padding: 15, flex: 1, borderRadius: 8, backgroundColor: 'white' }}>
          <h3>Assign Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input placeholder="Assignment Title" value={newAssignment.title} onChange={e => setNewAssignment({...newAssignment, title: e.target.value})} style={{padding: 8, borderRadius: 4, border: '1px solid #cbd5e1'}} />
            <select value={newAssignment.classId} onChange={e => setNewAssignment({...newAssignment, classId: e.target.value})} style={{padding: 8, borderRadius: 4, border: '1px solid #cbd5e1'}}>
              <option value="">-- Select Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={newAssignment.appId} onChange={e => setNewAssignment({...newAssignment, appId: e.target.value})} style={{padding: 8, borderRadius: 4, border: '1px solid #cbd5e1'}}>
              <option value="">-- Select Application --</option>
              {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={createAssignment} style={{padding: '10px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'}}>Create Assignment</button>
          </div>
        </section>
      </div>

      <section style={{ border: '1px solid #cbd5e1', padding: 15, marginTop: 20, borderRadius: 8, backgroundColor: 'white' }}>
        <h3>Results & Active Assignments</h3>
        {assignments.length === 0 ? <p style={{color: '#94a3b8'}}>No assignments created.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {assignments.map(a => (
              <li key={a.id} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: 10, marginBottom: 10 }}>
                <strong>{a.title}</strong> — <span style={{color: '#64748b'}}>{a.application.name}</span> <em>({a.class.name})</em>
                <ul style={{ marginTop: 10, paddingLeft: 20, listStyleType: 'circle' }}>
                  {a.results.length === 0 ? <li style={{color: '#94a3b8'}}>No results yet</li> : a.results.map(r => (
                    <li key={r.id}><strong>{r.user.username}</strong>: {r.status} (Score: {r.score})</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StudentDashboard({ token }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/portal/assignments`, { headers: { 'Authorization': `Bearer ${token}` }});
      setAssignments(await res.json());
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const launchApp = async (appId, assignmentId) => {
    try {
      const res = await apiFetch(`${API_URL}/integrations/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ appId, assignmentId })
      });
      const data = await res.json();
      if (data.launchUrl) {
        logger.info(`Launching app ${appId} for assignment ${assignmentId}`);
        window.location.href = data.launchUrl;
      }
    } catch(e) {
      alert(`${e.message} ${e.requestId ? `(ReqID: ${e.requestId})` : ''}`);
    }
  };

  if (loading) return <p style={{fontSize: '1.5em'}}>Loading your assignments... 🎈</p>;

  return (
    <div>
      <h2 style={{ fontSize: '2em', color: '#1e293b' }}>Let's play and learn! 🚀</h2>
      <section style={{ padding: 20, borderRadius: 16, backgroundColor: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
        <h3 style={{ fontSize: '1.5em', color: '#475569', marginTop: 0 }}>Your Activities</h3>
        {assignments.length === 0 ? <p style={{color: '#94a3b8', fontSize: '1.2em'}}>No activities today! You are all caught up. 🎉</p> : (
          <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {assignments.map(a => {
              const result = a.results[0]; // Assuming one result per user per assignment
              const isCompleted = result && result.status === 'COMPLETED';
              return (
                <li key={a.id} style={{ padding: 20, border: '2px solid #e2e8f0', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', width: 200, backgroundColor: isCompleted ? '#f0fdf4' : 'white' }}>
                  <div style={{ fontSize: '1.4em', fontWeight: 'bold', textAlign: 'center', marginBottom: 10 }}>{a.title}</div>
                  <div style={{ fontSize: '1em', color: '#64748b', marginBottom: 20 }}>{a.application.name}</div>
                  
                  {isCompleted ? (
                    <div style={{ fontSize: '2em' }}>✅ Done!</div>
                  ) : a.application.isReady === false ? (
                    <button style={{ padding: '15px 25px', cursor: 'not-allowed', background: '#94a3b8', color: 'white', border: 'none', borderRadius: 12, fontSize: '1.2em', fontWeight: 'bold' }} disabled>
                      Coming Soon 🚧
                    </button>
                  ) : (
                    <button style={{ padding: '15px 25px', cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 12, fontSize: '1.2em', fontWeight: 'bold' }} 
                            onClick={() => launchApp(a.appId, a.id)}>
                      Start ▶️
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
