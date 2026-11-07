import { useState, useEffect } from 'react';
import './App.css';
import { apiFetch, logger } from './logger';

const API_URL = 'http://localhost:4000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [view, setView] = useState('LANDING'); // LANDING, TEACHER_LOGIN, STUDENT_CLASS, STUDENT_SELECT
  const [loginError, setLoginError] = useState('');

  const login = async (username, password) => {
    logger.newCorrelationId();
    setLoginError('');
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
      setLoginError(`${err.message} ${err.requestId ? `(ReqID: ${err.requestId})` : ''}`);
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
    setLoginError('');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  if (token && user) {
    return (
      <div className="dashboard-container">
        <header className="portal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h1>EduVision ✨</h1>
            {user.role === 'STUDENT' && (
              <a
                id="headerPlayForFunBtn"
                href={`http://localhost:5000/index.html?mode=fun&returnUrl=${encodeURIComponent(window.location.href)}`}
                className="btn-fun"
              >
                <span>🎡</span> Play for Fun! 🎈
              </a>
            )}
          </div>
          <div className="user-badge">
            {user.avatar && <img src={user.avatar} alt="avatar" />}
            <span>Hi, <strong>{user.displayName || user.username}</strong></span>
            <button onClick={logout} className="btn btn-danger btn-sm">Exit</button>
          </div>
        </header>
        {user.role === 'ADMIN' ? <AdminDashboard token={token} /> :
         user.role === 'TEACHER' ? <TeacherDashboard token={token} /> : 
         user.role === 'PARENT' ? <ParentDashboard token={token} /> : 
         <StudentDashboard token={token} user={user} />}
      </div>
    );
  }

  return (
    <div className="container text-center" style={{ marginTop: '5vh', marginBottom: '5vh' }}>
      {view === 'LANDING' && (
        <div>
          <h1 className="title-main">EduVision ✨</h1>
          <p className="subtitle-main">Early Learning & Creative Story Studio</p>
          
          <div className="entry-card-grid">
            <div className="entry-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '2.8rem' }}>🎒</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Student Playground</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>Interactive activities and learning games.</p>
              </div>
              <button onClick={() => setView('STUDENT_CLASS')} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                Enter as Student 🚀
              </button>
            </div>

            <div className="entry-card">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '2.8rem' }}>🏫</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Staff & Family Portal</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: 0 }}>Teacher, parent, and admin access.</p>
              </div>
              <button onClick={() => { setView('TEACHER_LOGIN'); setLoginError(''); }} className="btn btn-secondary btn-lg" style={{ width: '100%' }}>
                Staff / Parent Login 🔑
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'TEACHER_LOGIN' && (
        <div style={{ maxWidth: '380px', margin: '0 auto', textAlign: 'left' }}>
          <div className="text-center" style={{ marginBottom: '24px' }}>
            <h1 className="page-title" style={{ fontSize: '1.65rem', marginBottom: '6px' }}>Staff & Family Login</h1>
          </div>

          {loginError && (
            <div className="alert-banner alert-danger">
              <span>⚠️</span>
              <span>{loginError}</span>
            </div>
          )}

          <Login onLogin={login} />
          
          <div className="text-center" style={{ marginTop: '20px' }}>
            <button onClick={() => { setView('LANDING'); setLoginError(''); }} className="btn btn-secondary btn-sm">
              ⬅️ Back to Home
            </button>
          </div>
        </div>
      )}

      {view === 'STUDENT_CLASS' && <StudentClassSelect onClassSelect={(c) => { setView('STUDENT_SELECT'); localStorage.setItem('selectedClass', JSON.stringify(c)); }} onBack={() => setView('LANDING')} />}
      
      {view === 'STUDENT_SELECT' && <StudentAvatarSelect classInfo={JSON.parse(localStorage.getItem('selectedClass') || '{}')} onStudentSelect={studentLogin} onBack={() => setView('STUDENT_CLASS')} />}
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="form-group">
      <div>
        <label className="input-label" style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', marginBottom: '6px', display: 'block' }}>Username or Display Name</label>
        <input 
          type="text" 
          value={username} 
          onChange={e => setUsername(e.target.value)} 
          className="input-field" 
          placeholder="e.g. teacher1, Robert Davis, admin" 
        />
      </div>
      <div>
        <label className="input-label" style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', marginBottom: '6px', display: 'block' }}>Password</label>
        <input 
          type="password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          className="input-field" 
          placeholder="••••••••" 
          onKeyDown={e => { if (e.key === 'Enter') onLogin(username, password); }}
        />
      </div>
      <button onClick={() => onLogin(username, password)} className="btn btn-primary" style={{ width: '100%', marginTop: '8px' }}>Log In</button>
    </div>
  );
}

function StudentClassSelect({ onClassSelect, onBack }) {
  const [classes, setClasses] = useState([]);
  
  useEffect(() => {
    apiFetch(`${API_URL}/portal/public/classes`).then(r => r.json()).then(setClasses).catch(e => console.error("Failed to fetch classes", e));
  }, []);

  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: '16px' }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">⬅️ Back to Home</button>
      </div>
      <h2 className="page-title">Choose Your Class! 🏫</h2>
      <div className="class-grid" style={{ marginTop: '24px' }}>
        {classes.map(c => (
          <button key={c.id} onClick={() => onClassSelect(c)} className="class-button">
            <span style={{ fontSize: '2rem' }}>🏫</span>
            <span>{c.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function StudentAvatarSelect({ classInfo, onStudentSelect, onBack }) {
  const [students, setStudents] = useState([]);
  
  useEffect(() => {
    if (classInfo?.id) {
      apiFetch(`${API_URL}/portal/public/classes/${classInfo.id}/students`).then(r => r.json()).then(setStudents).catch(e => console.error("Failed to fetch students", e));
    }
  }, [classInfo]);

  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: '16px' }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm">⬅️ Back to Classes</button>
      </div>
      <h2 className="page-title">Who is learning today? 🌟</h2>
      {students.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: '24px' }}>No students enrolled in this class yet. Ask your teacher to add your avatar!</p>
      ) : (
        <div className="avatar-grid" style={{ marginTop: '24px' }}>
          {students.map(s => (
            <div key={s.id} onClick={() => onStudentSelect(s.id, classInfo.id)} className="avatar-card">
              {s.avatar ? (
                <img src={s.avatar} alt="avatar" className="avatar-img" />
              ) : (
                <div className="avatar-img" style={{ background: '#e0f2fe' }}></div>
              )}
              <div className="avatar-name">{s.displayName || s.username}</div>
            </div>
          ))}
        </div>
      )}
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
      setApps((await appsRes.json()).apps || []);
      setClasses(await classesRes.json() || []);
      setAssignments(await assignsRes.json() || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const createClass = async () => {
    if (!newClassName.trim()) return;
    await apiFetch(`${API_URL}/portal/classes`, { 
      method: 'POST', 
      headers: { ...fetchHeaders, 'Content-Type': 'application/json'}, 
      body: JSON.stringify({ name: newClassName.trim() }) 
    }).catch(e => alert(e.message));
    setNewClassName('');
    loadData();
  };

  const deleteClass = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete class "${name}"? All assignments inside it will also be deleted.`)) return;
    try {
      await apiFetch(`${API_URL}/portal/classes/${id}`, { method: 'DELETE', headers: fetchHeaders });
      loadData();
    } catch(e) { alert(e.message); }
  };
  
  const createAssignment = async () => {
    if (!newAssignment.title || !newAssignment.classId || !newAssignment.appId) return;
    await apiFetch(`${API_URL}/portal/assignments`, { 
      method: 'POST', 
      headers: { ...fetchHeaders, 'Content-Type': 'application/json'}, 
      body: JSON.stringify(newAssignment) 
    }).catch(e => alert(e.message));
    setNewAssignment({ title: '', classId: '', appId: '' });
    loadData();
  };

  const deleteAssignment = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${title}"?`)) return;
    try {
      await apiFetch(`${API_URL}/portal/assignments/${id}`, { method: 'DELETE', headers: fetchHeaders });
      loadData();
    } catch(e) { alert(e.message); }
  };

  if (loading) return <div className="text-center page-title" style={{marginTop: '40px'}}>Loading dashboard...</div>;

  return (
    <div>
      <h2 className="page-title text-center">Teacher Dashboard 👩‍🏫</h2>
      
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title"><span>🏫</span> My Classes</h3>
          <div className="flex-row">
            <input className="input-field" placeholder="New Class Name (e.g. Grade 1A)" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
            <button onClick={createClass} className="btn btn-primary">Create</button>
          </div>
          <ul className="list-group" style={{ marginTop: '16px' }}>
            {classes.length === 0 ? <li className="list-item" style={{color: 'var(--text-muted)'}}>No classes created yet.</li> : classes.map(c => (
              <li key={c.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>🏫 {c.name}</span>
                <button 
                  onClick={() => deleteClass(c.id, c.name)} 
                  className="btn-ghost-danger" 
                  title="Delete Class"
                >
                  🗑️ Delete
                </button>
              </li>
            ))}
          </ul>
        </section>

        <TeacherRosterPanel classes={classes} token={token} />
      </div>

      <div className="grid-2" style={{ marginTop: '24px' }}>
        <section className="panel">
          <h3 className="section-title"><span>📝</span> Assign Activity</h3>
          <div className="form-group">
            <input className="input-field" placeholder="Assignment Title (e.g. Chapter 1 Story)" value={newAssignment.title} onChange={e => setNewAssignment({...newAssignment, title: e.target.value})} />
            <select className="input-field" value={newAssignment.classId} onChange={e => setNewAssignment({...newAssignment, classId: e.target.value})}>
              <option value="">-- Select Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input-field" value={newAssignment.appId} onChange={e => setNewAssignment({...newAssignment, appId: e.target.value})}>
              <option value="">-- Select Learning Activity --</option>
              {apps.filter(a => a.id !== 'activity-center').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={createAssignment} className="btn btn-success" style={{ marginTop: '6px' }}>Create Assignment ✨</button>
          </div>
        </section>

        <section className="panel">
          <h3 className="section-title"><span>📊</span> Overview</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{classes.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>Active Classes</div>
            </div>
            <div style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 12px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--color-primary)' }}>{assignments.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, marginTop: '2px' }}>Assignments</div>
            </div>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '24px' }}>
        <h3 className="section-title"><span>📊</span> Results & Submissions</h3>
        {assignments.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No assignments created.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {assignments.map(a => {
              // Count students, not attempts: Play Again adds another result
              const completedCount = new Set(a.results.filter(r => r.status === 'COMPLETED').map(r => r.userId)).size;
              return (
                <div key={a.id} style={{ border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', background: 'var(--surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{a.title}</strong>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{a.application.name}</span>
                        <span className="badge badge-blue">🏫 {a.class.name}</span>
                        <span className="badge badge-gray">{completedCount} submission{completedCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => deleteAssignment(a.id, a.title)} 
                      className="btn-ghost-danger" 
                      title="Delete Assignment"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                  
                  {a.results.length === 0 ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-light)', background: 'var(--surface-subtle)', padding: '10px 14px', borderRadius: '8px' }}>
                      ⏳ Awaiting student submissions for this class.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px', marginTop: '8px' }}>
                      {a.results.map(r => (
                        <div key={r.id} style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', fontSize: '0.88rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong>{r.user.displayName || r.user.username}</strong>
                            <span className="badge badge-green" style={{ fontSize: '0.75rem' }}>{r.status}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                            Score: <strong>{r.score}</strong>
                            {r.details && r.details.storyTitle && <span> • "<em>{r.details.storyTitle}</em>"</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function TeacherRosterPanel({ classes, token }) {
  const [selectedClass, setSelectedClass] = useState(() => {
    return sessionStorage.getItem('eduvision_teacher_class_id') || '';
  });
  const [roster, setRoster] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [studentToEnroll, setStudentToEnroll] = useState('');

  const fetchHeaders = { 'Authorization': `Bearer ${token}` };

  const loadAllStudents = async () => {
    try {
      const res = await apiFetch(`${API_URL}/portal/students`, { headers: fetchHeaders });
      setAllStudents(await res.json());
    } catch(e) { console.error(e); }
  };

  const loadRoster = async (classId) => {
    if (!classId) { setRoster([]); return; }
    try {
      const res = await apiFetch(`${API_URL}/portal/classes/${classId}/roster`, { headers: fetchHeaders });
      setRoster(await res.json());
    } catch(e) { console.error(e); }
  };

  useEffect(() => {
    loadAllStudents();
  }, []);

  useEffect(() => { 
    if (selectedClass) {
      loadRoster(selectedClass);
      loadAllStudents();
      sessionStorage.setItem('eduvision_teacher_class_id', selectedClass);
    } else {
      setRoster([]);
      sessionStorage.removeItem('eduvision_teacher_class_id');
    }
  }, [selectedClass]);

  useEffect(() => {
    if (classes.length > 0 && selectedClass) {
      const exists = classes.some(c => c.id === selectedClass);
      if (!exists) {
        setSelectedClass('');
        sessionStorage.removeItem('eduvision_teacher_class_id');
      }
    }
  }, [classes]);

  const enrollStudent = async () => {
    if (!selectedClass || !studentToEnroll) return;
    try {
      await apiFetch(`${API_URL}/portal/classes/${selectedClass}/members`, {
        method: 'POST',
        headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentToEnroll })
      });
      setStudentToEnroll('');
      loadRoster(selectedClass);
      loadAllStudents();
    } catch (e) { alert(e.message); }
  };

  const removeStudent = async (studentId) => {
    try {
      await apiFetch(`${API_URL}/portal/classes/${selectedClass}/members/${studentId}`, {
        method: 'DELETE',
        headers: fetchHeaders
      });
      loadRoster(selectedClass);
      loadAllStudents();
    } catch (e) { alert(e.message); }
  };

  // Only filter out students who are ALREADY in this specific class
  const availableStudents = allStudents.filter(s => !roster.some(r => r.id === s.id));

  return (
    <section className="panel">
      <h3 className="section-title"><span>👥</span> Class Roster</h3>
      <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ marginBottom: '14px' }}>
        <option value="">-- Select Class --</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {selectedClass && (
        <div>
          <div style={{ marginBottom: '14px' }}>
            <div className="flex-row" style={{ gap: '8px' }}>
              <select className="input-field" value={studentToEnroll} onChange={e => setStudentToEnroll(e.target.value)}>
                <option value="">
                  {availableStudents.length === 0 ? '-- All Students Enrolled --' : `-- Add Student (${availableStudents.length} available) --`}
                </option>
                {availableStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.displayName ? `${s.displayName} (${s.username})` : s.username}
                  </option>
                ))}
              </select>
              <button onClick={enrollStudent} className="btn btn-success" disabled={!studentToEnroll}>
                Add ➕
              </button>
            </div>
          </div>

          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '14px 0 8px 0', color: 'var(--text-main)' }}>
            Enrolled Students ({roster.length}):
          </h4>

          <ul className="list-group">
            {roster.length === 0 ? (
              <p style={{color: 'var(--text-muted)'}}>No students enrolled in this class yet.</p>
            ) : roster.map(s => (
              <li key={s.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {s.avatar ? (
                    <img src={s.avatar} alt="avatar" style={{ width: '34px', height: '34px', borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#cbd5e1' }} />
                  )}
                  <div>
                    <div><strong>{s.displayName || s.username}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>({s.username})</span></div>
                    {s.parents && s.parents.length > 0 ? (
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-purple)', marginTop: '2px' }}>
                        👨‍👩‍👧 Parent: <strong>{s.parents[0].displayName || s.parents[0].username}</strong>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '2px' }}>
                        No parent linked
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => removeStudent(s.id)} className="btn-ghost-danger" title="Remove from class">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AdminDashboard({ token }) {
  const [tab, setTab] = useState('BULK'); // 'BULK', 'STUDENTS', 'PARENTS', 'CLASSES'
  const [stats, setStats] = useState({ studentCount: 0, parentCount: 0, teacherCount: 0, classCount: 0 });
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Bulk state
  const [bulkText, setBulkText] = useState('Maya Sharma, Sunita Sharma\nAarav Patel, Rajesh Patel\nLiam Davis, Robert Davis');
  const [bulkClassId, setBulkClassId] = useState('');
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Search filters
  const [studentSearch, setStudentSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');

  const fetchHeaders = { 'Authorization': `Bearer ${token}` };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [overviewRes, studentsRes, parentsRes, classesRes] = await Promise.all([
        apiFetch(`${API_URL}/admin/overview`, { headers: fetchHeaders }),
        apiFetch(`${API_URL}/admin/students`, { headers: fetchHeaders }),
        apiFetch(`${API_URL}/admin/parents`, { headers: fetchHeaders }),
        apiFetch(`${API_URL}/admin/classes`, { headers: fetchHeaders })
      ]);
      setStats(await overviewRes.json());
      setStudents(await studentsRes.json() || []);
      setParents(await parentsRes.json() || []);
      setClasses(await classesRes.json() || []);
    } catch(e) { console.error('Admin load error', e); }
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const handleBulkEnroll = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      alert('Please enter at least one student name');
      return;
    }

    const rows = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      return {
        studentName: parts[0],
        parentName: parts[1] || '',
        classId: bulkClassId || undefined
      };
    });

    setBulkSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/admin/bulk-enroll`, {
        method: 'POST',
        headers: { ...fetchHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      const data = await res.json();
      setBulkResults(data.records);
      loadAll();
      alert(`🎉 Successfully enrolled ${data.enrolledCount} students with parents linked!`);
    } catch(e) {
      alert(e.message);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const deleteStudent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete student "${name}"? This removes their account, stories, and class memberships.`)) return;
    try {
      await apiFetch(`${API_URL}/admin/students/${id}`, { method: 'DELETE', headers: fetchHeaders });
      loadAll();
    } catch(e) { alert(e.message); }
  };

  const deleteParent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete parent "${name}"?`)) return;
    try {
      await apiFetch(`${API_URL}/admin/parents/${id}`, { method: 'DELETE', headers: fetchHeaders });
      loadAll();
    } catch(e) { alert(e.message); }
  };

  const deleteClass = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete class "${name}" across the school?`)) return;
    try {
      await apiFetch(`${API_URL}/admin/classes/${id}`, { method: 'DELETE', headers: fetchHeaders });
      loadAll();
    } catch(e) { alert(e.message); }
  };

  const unlinkParent = async (parentId, childId) => {
    try {
      await apiFetch(`${API_URL}/admin/unlink-parent-child/${parentId}/${childId}`, { method: 'DELETE', headers: fetchHeaders });
      loadAll();
    } catch(e) { alert(e.message); }
  };

  if (loading) return <div className="text-center page-title" style={{marginTop: '40px'}}>Loading School Admin Portal...</div>;

  const filteredStudents = students.filter(s => 
    (s.displayName || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
    (s.username || '').toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredParents = parents.filter(p => 
    (p.displayName || '').toLowerCase().includes(parentSearch.toLowerCase()) ||
    (p.username || '').toLowerCase().includes(parentSearch.toLowerCase())
  );

  return (
    <div>
      <h2 className="page-title text-center">Admin Console 👑</h2>

      {/* Modern Overview Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>🎒</div>
          <div>
            <div className="stat-value">{stats.studentCount}</div>
            <div className="stat-label">Total Students</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}>👨‍👩‍👧</div>
          <div>
            <div className="stat-value">{stats.parentCount}</div>
            <div className="stat-label">Total Parents</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>🏫</div>
          <div>
            <div className="stat-value">{stats.classCount}</div>
            <div className="stat-label">Active Classes</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fffbeb', color: '#d97706' }}>👩‍🏫</div>
          <div>
            <div className="stat-value">{stats.teacherCount}</div>
            <div className="stat-label">Teachers</div>
          </div>
        </div>
      </div>

      {/* Segmented Tab Navigation */}
      <div className="tabs-wrapper">
        <button 
          onClick={() => setTab('BULK')} 
          className={`tab-button ${tab === 'BULK' ? 'active' : ''}`}
        >
          🚀 Bulk Onboard
        </button>
        <button 
          onClick={() => setTab('STUDENTS')} 
          className={`tab-button ${tab === 'STUDENTS' ? 'active' : ''}`}
        >
          🎒 Students ({students.length})
        </button>
        <button 
          onClick={() => setTab('PARENTS')} 
          className={`tab-button ${tab === 'PARENTS' ? 'active' : ''}`}
        >
          👨‍👩‍👧 Parents ({parents.length})
        </button>
        <button 
          onClick={() => setTab('CLASSES')} 
          className={`tab-button ${tab === 'CLASSES' ? 'active' : ''}`}
        >
          🏫 Classes ({classes.length})
        </button>
      </div>

      {/* TAB 1: BULK ONBOARDING */}
      {tab === 'BULK' && (
        <section className="panel">
          <h3 className="section-title"><span>🚀</span> Bulk Onboard</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '14px', fontSize: '0.88rem' }}>
            Enter pairs: <code>Student Name, Parent Name</code> (one per line)
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', display: 'block', marginBottom: '6px' }}>Student & Parent List:</label>
            <textarea
              className="input-field"
              rows={6}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="Maya Sharma, Sunita Sharma&#10;Aarav Patel, Rajesh Patel&#10;Liam Davis, Robert Davis"
              style={{ fontFamily: 'monospace', fontSize: '0.92rem', width: '100%', padding: '12px' }}
            />
          </div>

          <div className="flex-row" style={{ gap: '14px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', display: 'block', marginBottom: '4px' }}>Initial Class (Optional):</label>
              <select className="input-field" value={bulkClassId} onChange={e => setBulkClassId(e.target.value)}>
                <option value="">-- No Class (Assign Later) --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ paddingTop: '20px' }}>
              <button 
                onClick={handleBulkEnroll} 
                className="btn btn-success" 
                disabled={bulkSubmitting}
              >
                {bulkSubmitting ? 'Enrolling...' : 'Enroll Students ✨'}
              </button>
            </div>
          </div>

          {bulkResults && (
            <div style={{ marginTop: '24px', background: 'var(--surface-subtle)', border: '1px solid var(--color-success-border)', borderRadius: '14px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ margin: 0, color: '#047857', fontSize: '1.05rem', fontWeight: 700 }}>
                  🎉 Enrolled {bulkResults.length} Students & Generated Logins:
                </h4>
                <button 
                  onClick={() => {
                    const text = bulkResults.map(r => `Student: ${r.studentName} (User: ${r.studentUsername}) | Parent: ${r.parentName} (User: ${r.parentUsername}, Pass: ${r.parentPassword})`).join('\n');
                    navigator.clipboard.writeText(text);
                    alert('Copied all credentials to clipboard!');
                  }}
                  className="btn btn-secondary btn-sm"
                >
                  📋 Copy All Credentials
                </button>
              </div>

              {/* Scrollable container for onboarding results */}
              <div className="table-wrapper" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th>Student</th>
                      <th>Student Username</th>
                      <th>Parent</th>
                      <th>Parent Username</th>
                      <th>Default Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.studentName}</td>
                        <td><code>{r.studentUsername}</code></td>
                        <td>{r.parentName}</td>
                        <td><code>{r.parentUsername}</code></td>
                        <td><code>{r.parentPassword}</code></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: STUDENTS DIRECTORY */}
      {tab === 'STUDENTS' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 className="section-title" style={{ margin: 0 }}><span>🎒</span> Students</h3>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                className="input-field" 
                placeholder="Search students..." 
                value={studentSearch} 
                onChange={e => setStudentSearch(e.target.value)}
              />
              {studentSearch && (
                <button onClick={() => setStudentSearch('')} className="clear-btn" title="Clear search">✕</button>
              )}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Avatar</th>
                  <th>Student Name</th>
                  <th>Username</th>
                  <th>Linked Parent(s)</th>
                  <th>Enrolled Classes</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</td></tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id}>
                    <td>
                      {s.avatar ? (
                        <img src={s.avatar} alt="avatar" style={{ width: '34px', height: '34px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#cbd5e1' }} />
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.displayName || 'Unnamed'}</td>
                    <td><code>{s.username}</code></td>
                    <td>
                      {s.parents && s.parents.length > 0 ? (
                        s.parents.map(p => (
                          <div key={p.id} style={{ fontSize: '0.85rem', color: 'var(--color-purple)' }}>
                            👨‍👩‍👧 {p.displayName || p.username} <span style={{ opacity: 0.8 }}>(<code>{p.username}</code>)</span>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>No parent linked</span>
                      )}
                    </td>
                    <td>
                      {s.classes && s.classes.length > 0 ? (
                        s.classes.map(c => (
                          <span key={c.id} className="badge badge-blue" style={{ marginRight: '4px' }}>
                            {c.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>Not in any class</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteStudent(s.id, s.displayName || s.username)} 
                        className="btn-ghost-danger" 
                        title="Delete Student"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: PARENTS DIRECTORY */}
      {tab === 'PARENTS' && (
        <section className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 className="section-title" style={{ margin: 0 }}><span>👨‍👩‍👧</span> Parents</h3>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input 
                className="input-field" 
                placeholder="Search parents..." 
                value={parentSearch} 
                onChange={e => setParentSearch(e.target.value)}
              />
              {parentSearch && (
                <button onClick={() => setParentSearch('')} className="clear-btn" title="Clear search">✕</button>
              )}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Parent Name</th>
                  <th>Username</th>
                  <th>Linked Children</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParents.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No parents found.</td></tr>
                ) : filteredParents.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.displayName || 'Unnamed'}</td>
                    <td><code>{p.username}</code></td>
                    <td>
                      {p.children && p.children.length > 0 ? (
                        p.children.map(c => (
                          <div key={c.id} className="badge badge-purple" style={{ marginRight: '6px' }}>
                            <span>🎒 {c.displayName || c.username}</span>
                            <button 
                              onClick={() => unlinkParent(p.id, c.id)} 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0 0 4px', fontWeight: 700 }}
                              title="Unlink child"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>No children linked</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteParent(p.id, p.displayName || p.username)} 
                        className="btn-ghost-danger" 
                        title="Delete Parent"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 4: CLASSES DIRECTORY */}
      {tab === 'CLASSES' && (
        <section className="panel">
          <h3 className="section-title"><span>🏫</span> Classes</h3>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class Name</th>
                  <th>Assigned Teachers</th>
                  <th>Enrolled Students</th>
                  <th>Active Assignments</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No classes in the school yet.</td></tr>
                ) : classes.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>
                      {c.teachers && c.teachers.length > 0 ? (
                        c.teachers.map(t => <span key={t.id} className="badge badge-purple" style={{ marginRight: '4px' }}>👩‍🏫 {t.displayName || t.username}</span>)
                      ) : <span style={{ color: 'var(--text-light)' }}>None</span>}
                    </td>
                    <td><span className="badge badge-blue">{c.studentCount} students</span></td>
                    <td><span className="badge badge-gray">{c.assignmentCount} assignments</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteClass(c.id, c.name)} 
                        className="btn-ghost-danger" 
                        title="Delete Class"
                      >
                        🗑️ Delete Class
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StudentDashboard({ token, user }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/portal/assignments`, { headers: { 'Authorization': `Bearer ${token}` }});
      setAssignments(await res.json() || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const launchApp = async (appId, assignmentId) => {
    try {
      const returnUrl = window.location.href;
      const res = await apiFetch(`${API_URL}/integrations/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ appId, assignmentId, returnUrl })
      });
      const data = await res.json();
      if (data.launchUrl) {
        logger.info(`Launching app ${appId} for assignment ${assignmentId}`);
        if (assignmentId) localStorage.setItem('eduvision_active_assignment', assignmentId);
        window.location.href = data.launchUrl;
      }
    } catch(e) {
      alert(`${e.message} ${e.requestId ? `(ReqID: ${e.requestId})` : ''}`);
    }
  };

  if (loading) return <p className="text-center page-title" style={{marginTop: '40px'}}>Loading your activities... 🎈</p>;

  return (
    <div>
      {/* Warm, Engaging Welcome Section */}
      <div className="welcome-hero">
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" className="welcome-hero-avatar" />
        ) : (
          <div className="welcome-hero-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🤖</div>
        )}
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
            Welcome back, {user?.displayName || user?.username}! 🌟
          </h2>
        </div>
      </div>
      
      <section className="panel">
        <h3 className="section-title text-center" style={{ justifyContent: 'center', marginBottom: '20px' }}>
          <span>📚</span> Assigned Activities
        </h3>
        {assignments.length === 0 ? (
          <p className="text-center" style={{color: 'var(--text-muted)', fontSize: '1rem', padding: '24px'}}>
            No assigned activities today. You're all caught up! 🎉
          </p>
        ) : (
          <div className="activity-grid">
            {assignments.map(a => {
              const isCompleted = a.results && a.results.some(r => r.status === 'COMPLETED');
              return (
                <div key={a.id} className={`activity-card ${isCompleted ? 'completed' : ''}`}>
                  <div style={{ width: '100%', marginBottom: '14px' }}>
                    <div className="activity-card-title">{a.title}</div>
                    <div className="activity-card-subtitle">{a.application.name} · {a.class.name}</div>
                  </div>
                  
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {isCompleted ? (
                      <>
                        <span className="badge badge-green" style={{ fontSize: '0.88rem', padding: '5px 12px', width: '100%', justifyContent: 'center' }}>
                          ✅ Completed
                        </span>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: '2px' }} onClick={() => launchApp(a.appId, a.id)}>
                          Play Again 🔄
                        </button>
                      </>
                    ) : a.application.isReady === false ? (
                      <button className="btn btn-secondary btn-sm" style={{ width: '100%', cursor: 'not-allowed' }} disabled>
                        Coming Soon 🚧
                      </button>
                    ) : (
                      <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => launchApp(a.appId, a.id)}>
                        Start Activity ▶️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ParentDashboard({ token }) {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(() => {
    return sessionStorage.getItem('eduvision_parent_child_id') || null;
  });
  const [childData, setChildData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHeaders = { 'Authorization': `Bearer ${token}` };

  const handleSelectChild = (id) => {
    setSelectedChildId(id);
    if (id) {
      sessionStorage.setItem('eduvision_parent_child_id', id);
    } else {
      sessionStorage.removeItem('eduvision_parent_child_id');
    }
  };

  useEffect(() => {
    apiFetch(`${API_URL}/portal/parent/children`, { headers: fetchHeaders })
      .then(r => r.json())
      .then(data => {
        setChildren(data || []);
        if (data && data.length > 0) {
          const stored = sessionStorage.getItem('eduvision_parent_child_id');
          const match = data.find(c => c.id === stored);
          const chosenId = match ? match.id : data[0].id;
          setSelectedChildId(chosenId);
          sessionStorage.setItem('eduvision_parent_child_id', chosenId);
        }
        setLoading(false);
      })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  useEffect(() => {
    if (selectedChildId) {
      apiFetch(`${API_URL}/portal/parent/children/${selectedChildId}/dashboard`, { headers: fetchHeaders })
        .then(r => r.json())
        .then(setChildData)
        .catch(e => console.error(e));
    }
  }, [selectedChildId]);

  if (loading) return <div className="text-center page-title" style={{marginTop: '40px'}}>Loading your family...</div>;

  const currentChild = children.find(c => c.id === selectedChildId);

  return (
    <div>
      <h2 className="page-title text-center">Family Dashboard 👨‍👩‍👧</h2>

      <div style={{ marginBottom: '24px' }}>
        {children.length === 0 ? (
          <p className="text-center" style={{color: 'var(--text-muted)'}}>No linked children found.</p>
        ) : (
          <div className="avatar-grid">
            {children.map(c => (
              <div 
                key={c.id} 
                className={`avatar-card ${selectedChildId === c.id ? 'selected' : ''}`}
                onClick={() => handleSelectChild(c.id)}
              >
                {c.avatar ? <img src={c.avatar} alt="avatar" className="avatar-img" /> : <div className="avatar-img"></div>}
                <div className="avatar-name">{c.displayName || c.username}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {childData && (
        <div>
          {/* Child Context Banner: Integrating Enrolled Classes seamlessly */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.3rem' }}>🎒</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {currentChild?.displayName || currentChild?.username}'s Progress
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Enrolled Classes:</span>
              {childData.classes && childData.classes.length > 0 ? (
                childData.classes.map(c => (
                  <span key={c.id} className="badge badge-blue">🏫 {c.name}</span>
                ))
              ) : (
                <span className="badge badge-gray">None</span>
              )}
            </div>
          </div>

          <div className="grid-2">
            <section className="panel">
              <h3 className="section-title"><span>📝</span> Activities</h3>
              {childData.assignments.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No activities assigned.</p> : (
                <ul className="list-group">
                  {childData.assignments.map(a => {
                    const isCompleted = a.results.some(r => r.status === 'COMPLETED');
                    return (
                      <li key={a.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{a.title}</strong>
                          <div style={{color: 'var(--text-muted)', fontSize: '0.88em'}}>{a.application.name} · {a.class.name}</div>
                        </div>
                        <span className={`badge ${isCompleted ? 'badge-green' : 'badge-amber'}`}>
                          {isCompleted ? 'Completed' : 'Pending'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="panel">
              <h3 className="section-title"><span>🎬</span> Saved Stories</h3>
              {childData.stories.length === 0 ? (
                <p style={{color: 'var(--text-muted)'}}>No stories saved yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {childData.stories.map(s => (
                    <SavedStoryCard key={s.id} story={s} token={token} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function SavedStoryCard({ story, token }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const getVideoSrc = (url) => {
    if (!url) return '';
    let fullUrl = url.startsWith('http://') || url.startsWith('https://') 
      ? url 
      : `http://localhost:4000${url.startsWith('/') ? '' : '/'}${url}`;
    if (token) {
      const sep = fullUrl.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
    }
    return fullUrl;
  };

  const isMissing = story.fileExists === false;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong style={{ fontSize: '0.98rem', color: 'var(--text-main)' }}>{story.title || "Untitled Story"}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '2px' }}>
            📅 {new Date(story.createdAt).toLocaleDateString()}
          </div>
        </div>
        <span className={`badge ${isMissing ? 'badge-red' : loadError ? 'badge-amber' : isPlaying ? (isLoaded ? 'badge-green' : 'badge-amber') : 'badge-blue'}`}>
          {isMissing ? 'Missing' : loadError ? 'Error' : isPlaying ? (isLoaded ? 'Playing' : 'Buffering...') : 'Ready'}
        </span>
      </div>

      {isMissing ? (
        <div className="alert-banner alert-danger" style={{ margin: 0, padding: '10px 12px', fontSize: '0.82rem' }}>
          ⚠️ Video file is unavailable on server.
        </div>
      ) : loadError ? (
        <div className="alert-banner alert-danger" style={{ margin: 0, padding: '10px 12px', fontSize: '0.82rem', justifyContent: 'space-between' }}>
          <span>⚠️ Failed to stream video.</span>
          <button onClick={() => setLoadError(false)} className="btn btn-secondary btn-sm">Retry</button>
        </div>
      ) : isPlaying ? (
        <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
          <video 
            src={getVideoSrc(story.videoUrl)} 
            controls 
            autoPlay
            playsInline
            onLoadedMetadata={() => setIsLoaded(true)}
            onError={(e) => {
              console.error("Video load error for story:", story.id, e);
              setLoadError(true);
            }}
            style={{ width: '100%', maxHeight: '300px', display: 'block' }}
          ></video>
          <div style={{ padding: '6px', background: '#0f172a', textAlign: 'right' }}>
            <button 
              onClick={() => setIsPlaying(false)} 
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', height: '28px', padding: '0 10px' }}
            >
              ✕ Close Player
            </button>
          </div>
        </div>
      ) : story.videoUrl ? (
        <button 
          onClick={() => setIsPlaying(true)} 
          className="btn btn-secondary btn-sm" 
          style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
        >
          <span>▶️</span> Watch Story Video
        </button>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No video URL recorded.</p>
      )}
    </div>
  );
}

export default App;
