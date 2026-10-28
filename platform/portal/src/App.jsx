import { useState, useEffect } from 'react';
import './App.css';
import { apiFetch, logger } from './logger';

const API_URL = 'http://localhost:4000/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
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
      <div className="dashboard-container">
<header className="portal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <h1>EduVision ✨</h1>
            {user.role === 'STUDENT' && (
              <a
                id="headerPlayForFunBtn"
                href={`http://localhost:5000/index.html?mode=fun&returnUrl=${encodeURIComponent(window.location.href)}`}
                className="btn"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #8b5cf6 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  padding: '8px 20px',
                  borderRadius: '30px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)',
                  cursor: 'pointer',
                  border: '2px solid #ffffff'
                }}
              >
                <span>🎡</span> Play for Fun! 🎈
              </a>
            )}
          </div>
          <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user.avatar && <img src={user.avatar} alt="avatar" />}
            <span>Hi, <strong>{user.displayName || user.username}</strong></span>
            <button onClick={logout} className="btn btn-danger">Exit</button>
          </div>
        </header>
        {user.role === 'ADMIN' ? <AdminDashboard token={token} /> :
         user.role === 'TEACHER' ? <TeacherDashboard token={token} /> : 
         user.role === 'PARENT' ? <ParentDashboard token={token} /> : 
         <StudentDashboard token={token} />}
      </div>
    );
  }

  return (
    <div className="container text-center" style={{ marginTop: '8vh', marginBottom: '8vh' }}>
      <h1 className="title-main" style={{ marginBottom: '40px' }}>EduVision ✨</h1>
      
      {view === 'LANDING' && (
        <div className="flex-row justify-center flex-wrap" style={{ flexDirection: 'column', gap: '20px' }}>
          <button onClick={() => setView('STUDENT_CLASS')} className="btn-massive">
            I'm a Student! 🎒
          </button>
          <button onClick={() => setView('TEACHER_LOGIN')} className="text-link">
            Teacher / Parent Login
          </button>
        </div>
      )}

      {view === 'TEACHER_LOGIN' && (
        <div style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'left' }}>
          <h2 className="section-title text-center">Login</h2>
          <Login onLogin={login} />
          <div className="text-center" style={{ marginTop: '20px' }}>
            <button onClick={() => setView('LANDING')} className="text-link">Back</button>
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
      <input className="input-field" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
      <input className="input-field" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button onClick={() => onLogin(username, password)} className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Log In</button>
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
      <div style={{ textAlign: 'left', marginBottom: '20px' }}>
        <button onClick={onBack} className="text-link">⬅️ Back</button>
      </div>
      <h2 className="page-title">Select Your Class</h2>
      <div className="flex-row justify-center flex-wrap" style={{ marginTop: '30px', gap: '20px' }}>
        {classes.map(c => (
          <button key={c.id} onClick={() => onClassSelect(c)} className="class-button">
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
    if (classInfo?.id) {
      apiFetch(`${API_URL}/portal/public/classes/${classInfo.id}/students`).then(r => r.json()).then(setStudents).catch(e => console.error("Failed to fetch students", e));
    }
  }, [classInfo]);

  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: '20px' }}>
        <button onClick={onBack} className="text-link">⬅️ Back to Classes</button>
      </div>
      <h2 className="page-title">Who are you?</h2>
      <div className="flex-row justify-center flex-wrap" style={{ marginTop: '30px', gap: '24px' }}>
        {students.map(s => (
          <div key={s.id} onClick={() => onStudentSelect(s.id, classInfo.id)} className="avatar-card">
            {s.avatar ? (
              <img src={s.avatar} alt="avatar" className="avatar-img" />
            ) : (
              <div className="avatar-img"></div>
            )}
            <div className="avatar-name">{s.displayName || s.username}</div>
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
          <h3 className="section-title">My Classes</h3>
          <div className="flex-row">
            <input className="input-field" placeholder="New Class Name (e.g. Grade 1A)" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
            <button onClick={createClass} className="btn btn-primary">Create</button>
          </div>
          <ul className="list-group" style={{ marginTop: '20px' }}>
            {classes.length === 0 ? <li className="list-item" style={{color: 'var(--text-muted)'}}>No classes created yet.</li> : classes.map(c => (
              <li key={c.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>🏫 {c.name}</span>
                <button 
                  onClick={() => deleteClass(c.id, c.name)} 
                  className="btn btn-danger" 
                  style={{ padding: '3px 8px', fontSize: '0.8rem' }}
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
          <h3 className="section-title">Assign Activity</h3>
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
            <button onClick={createAssignment} className="btn btn-success" style={{ marginTop: '10px' }}>Create Assignment ✨</button>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '24px' }}>
        <h3 className="section-title">Results & Active Assignments</h3>
        {assignments.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No assignments created.</p> : (
          <ul className="list-group">
            {assignments.map(a => (
              <li key={a.id} className="list-item" style={{ paddingBottom: '16px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '1.15rem' }}>
                    <strong>{a.title}</strong> — <span style={{color: 'var(--text-muted)'}}>{a.application.name}</span> <em>({a.class.name})</em>
                  </div>
                  <button 
                    onClick={() => deleteAssignment(a.id, a.title)} 
                    className="btn btn-danger" 
                    style={{ padding: '3px 8px', fontSize: '0.8rem' }}
                    title="Delete Assignment"
                  >
                    🗑️ Delete Assignment
                  </button>
                </div>
                <ul style={{ paddingLeft: '20px', listStyleType: 'circle', color: 'var(--text-muted)' }}>
                  {a.results.length === 0 ? <li>No results yet</li> : a.results.map(r => (
                    <li key={r.id}>
                      <strong>{r.user.displayName || r.user.username}</strong>: {r.status} (Score: {r.score})
                      {r.details && r.details.storyTitle && <span> — Story: "<em>{r.details.storyTitle}</em>"</span>}
                    </li>
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
      <h3 className="section-title">Class Roster & Student Assignment</h3>
      <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ marginBottom: '14px' }}>
        <option value="">-- Select Class to Manage --</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {selectedClass && (
        <div>
          <div style={{ marginBottom: '14px' }}>
            <div className="flex-row" style={{ gap: '8px' }}>
              <select className="input-field" value={studentToEnroll} onChange={e => setStudentToEnroll(e.target.value)}>
                <option value="">
                  {availableStudents.length === 0 ? '-- All School Students Are in This Class --' : `-- Select Student to Add (${availableStudents.length} available) --`}
                </option>
                {availableStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.displayName ? `${s.displayName} (${s.username})` : s.username}
                  </option>
                ))}
              </select>
              <button onClick={enrollStudent} className="btn btn-success" disabled={!studentToEnroll}>
                Add to Class ➕
              </button>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
              💡 All students and parents are registered centrally by the Admin. Select registered students above to add to your class.
            </div>
          </div>

          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '12px 0 8px 0', color: '#334155' }}>
            Enrolled Students in this Class ({roster.length}):
          </h4>

          <ul className="list-group">
            {roster.length === 0 ? (
              <p style={{color: 'var(--text-muted)'}}>No students enrolled in this class yet. Select a student above to add them.</p>
            ) : roster.map(s => (
              <li key={s.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {s.avatar ? (
                    <img src={s.avatar} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#cbd5e1' }} />
                  )}
                  <div>
                    <div><strong>{s.displayName || s.username}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>({s.username})</span></div>
                    {s.parents && s.parents.length > 0 ? (
                      <div style={{ fontSize: '0.82rem', color: '#4f46e5', marginTop: '2px' }}>
                        👨‍👩‍👧 Parent: <strong>{s.parents[0].displayName || s.parents[0].username}</strong> <span style={{ opacity: 0.8 }}>({s.parents[0].username})</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        ⚠️ No parent linked yet
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={() => removeStudent(s.id)} className="btn btn-danger" style={{ padding: '4px 8px', minHeight: '30px', fontSize: '0.85rem' }} title="Remove from class">
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
      <h2 className="page-title text-center">School Administration Console 👑</h2>

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="panel" style={{ textAlign: 'center', background: '#eef2ff', borderColor: '#c7d2fe' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#4f46e5' }}>{stats.studentCount}</div>
          <div style={{ fontWeight: 600, color: '#4338ca' }}>🎒 Total Students</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', background: '#fdf4ff', borderColor: '#f5d0fe' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#c026d3' }}>{stats.parentCount}</div>
          <div style={{ fontWeight: 600, color: '#a21caf' }}>👨‍👩‍👧 Total Parents</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', background: '#f0fdf4', borderColor: '#bbf7d0' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#16a34a' }}>{stats.classCount}</div>
          <div style={{ fontWeight: 600, color: '#15803d' }}>🏫 Active Classes</div>
        </div>
        <div className="panel" style={{ textAlign: 'center', background: '#fffbeb', borderColor: '#fde68a' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706' }}>{stats.teacherCount}</div>
          <div style={{ fontWeight: 600, color: '#b45309' }}>👩‍🏫 Teachers</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setTab('BULK')} 
          className={`btn ${tab === 'BULK' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 700 }}
        >
          🚀 Fast Bulk Onboarding
        </button>
        <button 
          onClick={() => setTab('STUDENTS')} 
          className={`btn ${tab === 'STUDENTS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 700 }}
        >
          🎒 Students Directory ({students.length})
        </button>
        <button 
          onClick={() => setTab('PARENTS')} 
          className={`btn ${tab === 'PARENTS' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 700 }}
        >
          👨‍👩‍👧 Parents Directory ({parents.length})
        </button>
        <button 
          onClick={() => setTab('CLASSES')} 
          className={`btn ${tab === 'CLASSES' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontWeight: 700 }}
        >
          🏫 All Classes ({classes.length})
        </button>
      </div>

      {/* TAB 1: BULK ONBOARDING */}
      {tab === 'BULK' && (
        <section className="panel">
          <h3 className="section-title">🚀 Fast Zero-Burden Student & Parent Admission</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '14px' }}>
            Paste as many students and parents as you want below (one per line, format: <code>Student Name, Parent Name</code>). 
            The system automatically creates student logins with avatars, creates parent accounts with <code>password123</code>, and links them instantly!
          </p>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontWeight: 700, display: 'block', marginBottom: '6px' }}>Student & Parent List (Paste below):</label>
            <textarea
              className="input-field"
              rows={6}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="Maya Sharma, Sunita Sharma&#10;Aarav Patel, Rajesh Patel&#10;Liam Davis, Robert Davis"
              style={{ fontFamily: 'monospace', fontSize: '0.95rem', width: '100%', padding: '12px' }}
            />
          </div>

          <div className="flex-row" style={{ gap: '14px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '220px' }}>
              <label style={{ fontWeight: 700, fontSize: '0.9rem', display: 'block', marginBottom: '4px' }}>Initial Class (Optional):</label>
              <select className="input-field" value={bulkClassId} onChange={e => setBulkClassId(e.target.value)}>
                <option value="">-- No Class (Teachers Will Add Later) --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ paddingTop: '22px' }}>
              <button 
                onClick={handleBulkEnroll} 
                className="btn btn-success" 
                style={{ fontSize: '1.05rem', padding: '10px 24px' }}
                disabled={bulkSubmitting}
              >
                {bulkSubmitting ? 'Enrolling...' : '✨ Run Bulk Admission'}
              </button>
            </div>
          </div>

          {bulkResults && (
            <div style={{ marginTop: '24px', background: '#f8fafc', border: '2px solid #10b981', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, color: '#065f46', fontSize: '1.1rem' }}>
                  🎉 Enrolled {bulkResults.length} Students & Generated Logins:
                </h4>
                <button 
                  onClick={() => {
                    const text = bulkResults.map(r => `Student: ${r.studentName} (User: ${r.studentUsername}) | Parent: ${r.parentName} (User: ${r.parentUsername}, Pass: ${r.parentPassword})`).join('\n');
                    navigator.clipboard.writeText(text);
                    alert('Copied all credentials to clipboard!');
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.85rem' }}
                >
                  📋 Copy All Credentials
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ background: '#e2e8f0', borderBottom: '2px solid #cbd5e1' }}>
                      <th style={{ padding: '8px 12px' }}>Student</th>
                      <th style={{ padding: '8px 12px' }}>Student Username</th>
                      <th style={{ padding: '8px 12px' }}>Parent</th>
                      <th style={{ padding: '8px 12px' }}>Parent Username</th>
                      <th style={{ padding: '8px 12px' }}>Default Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResults.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? 'white' : '#f8fafc' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.studentName}</td>
                        <td style={{ padding: '8px 12px' }}><code>{r.studentUsername}</code></td>
                        <td style={{ padding: '8px 12px' }}>{r.parentName}</td>
                        <td style={{ padding: '8px 12px' }}><code>{r.parentUsername}</code></td>
                        <td style={{ padding: '8px 12px' }}><code>{r.parentPassword}</code></td>
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
            <h3 className="section-title" style={{ margin: 0 }}>🎒 School Students Directory</h3>
            <input 
              className="input-field" 
              placeholder="🔍 Search students..." 
              value={studentSearch} 
              onChange={e => setStudentSearch(e.target.value)}
              style={{ maxWidth: '280px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 12px' }}>Avatar</th>
                  <th style={{ padding: '10px 12px' }}>Student Name</th>
                  <th style={{ padding: '10px 12px' }}>Username</th>
                  <th style={{ padding: '10px 12px' }}>Linked Parent(s)</th>
                  <th style={{ padding: '10px 12px' }}>Enrolled Classes</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No students found.</td></tr>
                ) : filteredStudents.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px' }}>
                      {s.avatar ? (
                        <img src={s.avatar} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#cbd5e1' }} />
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{s.displayName || 'Unnamed'}</td>
                    <td style={{ padding: '10px 12px' }}><code>{s.username}</code></td>
                    <td style={{ padding: '10px 12px' }}>
                      {s.parents && s.parents.length > 0 ? (
                        s.parents.map(p => (
                          <div key={p.id} style={{ fontSize: '0.85rem', color: '#4f46e5' }}>
                            👨‍👩‍👧 {p.displayName || p.username} (<code>{p.username}</code>)
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No parent linked</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {s.classes && s.classes.length > 0 ? (
                        s.classes.map(c => (
                          <span key={c.id} style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem', marginRight: '4px' }}>
                            {c.name}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Not in any class</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteStudent(s.id, s.displayName || s.username)} 
                        className="btn btn-danger" 
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
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
            <h3 className="section-title" style={{ margin: 0 }}>👨‍👩‍👧 Parents Directory</h3>
            <input 
              className="input-field" 
              placeholder="🔍 Search parents..." 
              value={parentSearch} 
              onChange={e => setParentSearch(e.target.value)}
              style={{ maxWidth: '280px' }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 12px' }}>Parent Name</th>
                  <th style={{ padding: '10px 12px' }}>Username</th>
                  <th style={{ padding: '10px 12px' }}>Linked Children</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredParents.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No parents found.</td></tr>
                ) : filteredParents.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{p.displayName || 'Unnamed'}</td>
                    <td style={{ padding: '10px 12px' }}><code>{p.username}</code></td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.children && p.children.length > 0 ? (
                        p.children.map(c => (
                          <div key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fdf4ff', border: '1px solid #f0abfc', borderRadius: '14px', padding: '2px 8px', margin: '2px 4px', fontSize: '0.85rem' }}>
                            <span>🎒 {c.displayName || c.username}</span>
                            <button 
                              onClick={() => unlinkParent(p.id, c.id)} 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, fontWeight: 700 }}
                              title="Unlink child"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No children linked</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteParent(p.id, p.displayName || p.username)} 
                        className="btn btn-danger" 
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
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
          <h3 className="section-title">🏫 All School Classes</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ padding: '10px 12px' }}>Class Name</th>
                  <th style={{ padding: '10px 12px' }}>Assigned Teachers</th>
                  <th style={{ padding: '10px 12px' }}>Enrolled Students</th>
                  <th style={{ padding: '10px 12px' }}>Active Assignments</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No classes in the school yet.</td></tr>
                ) : classes.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {c.teachers && c.teachers.length > 0 ? (
                        c.teachers.map(t => <span key={t.id} style={{ marginRight: '6px' }}>👩‍🏫 {t.displayName || t.username}</span>)
                      ) : <span style={{ color: '#94a3b8' }}>None</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>{c.studentCount} students</td>
                    <td style={{ padding: '10px 12px' }}>{c.assignmentCount} assignments</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button 
                        onClick={() => deleteClass(c.id, c.name)} 
                        className="btn btn-danger" 
                        style={{ padding: '4px 8px', fontSize: '0.82rem' }}
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


function StudentDashboard({ token }) {
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
      

      <h2 className="page-title text-center">Let's play and learn! 🚀</h2>
      
      <section className="panel" style={{ marginTop: '20px' }}>
        <h3 className="section-title text-center" style={{ marginBottom: '24px' }}>Your Activities</h3>
        {assignments.length === 0 ? (
          <p className="text-center" style={{color: 'var(--text-muted)', fontSize: '1.2em'}}>
            No activities today! You are all caught up. 🎉
          </p>
        ) : (
          <div className="flex-row flex-wrap justify-center" style={{ gap: '24px' }}>
            {assignments.map(a => {
              const isCompleted = a.results && a.results.some(r => r.status === 'COMPLETED');
              return (
                <div key={a.id} className={`activity-card ${isCompleted ? 'completed' : ''}`}>
                  <div className="activity-card-title">{a.title}</div>
                  <div className="activity-card-subtitle">{a.application.name}</div>
                  
                  {isCompleted ? (
                    <div style={{ fontSize: '2em', marginTop: '10px' }}>✅ Done!</div>
                  ) : a.application.isReady === false ? (
                    <button className="btn" style={{ background: '#94a3b8', color: 'white', width: '100%', cursor: 'not-allowed' }} disabled>
                      Coming Soon 🚧
                    </button>
                  ) : (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => launchApp(a.appId, a.id)}>
                      Start ▶️
                    </button>
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

  return (
    <div>
      <h2 className="page-title text-center">Family Dashboard</h2>

      <div style={{ marginBottom: '30px' }}>
        {children.length === 0 ? (
          <p className="text-center" style={{color: 'var(--text-muted)'}}>No linked children found.</p>
        ) : (
          <div className="flex-row justify-center flex-wrap" style={{ gap: '20px' }}>
            {children.map(c => (
              <div 
                key={c.id} 
                className={`avatar-card ${selectedChildId === c.id ? 'selected' : ''}`}
                style={{ borderColor: selectedChildId === c.id ? 'var(--color-primary)' : 'var(--border)' }}
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
        <div className="grid-2">
          <section className="panel">
            <h3 className="section-title">Learning Activities</h3>
            {childData.assignments.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No activities assigned.</p> : (
              <ul className="list-group">
                {childData.assignments.map(a => {
                  const result = a.results[0];
                  const isCompleted = result && result.status === 'COMPLETED';
                  return (
                    <li key={a.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{a.title}</strong>
                        <div style={{color: 'var(--text-muted)', fontSize: '0.9em'}}>{a.application.name}</div>
                      </div>
                      <span className="status-badge" style={{ 
                          background: isCompleted ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', 
                          color: isCompleted ? 'var(--color-success)' : 'var(--color-warning)' 
                      }}>
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="panel">
            <h3 className="section-title">Saved Stories</h3>
            {childData.stories.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No stories saved yet.</p> : (
              <ul className="list-group">
                {childData.stories.map(s => (
                  <SavedStoryCard key={s.id} story={s} token={token} />
                ))}
              </ul>
            )}
          </section>

          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <h3 className="section-title">Enrolled Classes</h3>
            {childData.classes && childData.classes.length > 0 ? (
              <ul className="list-group">
                {childData.classes.map(c => <li key={c.id} className="list-item">{c.name}</li>)}
              </ul>
            ) : <p style={{color: 'var(--text-muted)'}}>Not enrolled in any classes.</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function SavedStoryCard({ story, token }) {
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
    <li className="list-item" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <strong style={{ fontSize: '1.05rem' }}>{story.title || "Untitled Story"}</strong>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85em', marginTop: '2px' }}>
            📅 {new Date(story.createdAt).toLocaleDateString()} at {new Date(story.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <span className="status-badge" style={{ 
          background: isMissing ? '#fee2e2' : loadError ? '#fef3c7' : 'var(--color-success-bg)', 
          color: isMissing ? '#ef4444' : loadError ? '#b45309' : 'var(--color-success)' 
        }}>
          {isMissing ? 'File Missing' : loadError ? 'Playback Error' : isLoaded ? 'Ready' : 'Saved'}
        </span>
      </div>

      {isMissing ? (
        <div style={{
          padding: '14px',
          background: '#fef2f2',
          border: '1px dashed #f87171',
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '0.9em',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '1.3em' }}>⚠️</span>
          <div>
            <strong>Story video file is unavailable on server.</strong>
            <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
              The video generation record exists, but the file was not found in the output directory.
            </div>
          </div>
        </div>
      ) : loadError ? (
        <div style={{
          padding: '14px',
          background: '#fffbeb',
          border: '1px dashed #f59e0b',
          borderRadius: '10px',
          color: '#92400e',
          fontSize: '0.9em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3em' }}>⚠️</span>
            <div>
              <strong>Failed to stream video.</strong>
              <div style={{ fontSize: '0.85em', opacity: 0.8, marginTop: '2px' }}>
                The browser could not load this media stream.
              </div>
            </div>
          </div>
          <button 
            onClick={() => setLoadError(false)} 
            className="btn btn-secondary" 
            style={{ padding: '4px 10px', fontSize: '0.85rem' }}
          >
            Retry
          </button>
        </div>
      ) : story.videoUrl ? (
        <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--border)', background: '#000' }}>
          <video 
            src={getVideoSrc(story.videoUrl)} 
            controls 
            preload="metadata"
            playsInline
            onLoadedMetadata={() => setIsLoaded(true)}
            onError={(e) => {
              console.error("Video load error for story:", story.id, e);
              setLoadError(true);
            }}
            style={{ width: '100%', maxHeight: '360px', display: 'block' }}
          ></video>
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9em' }}>No video URL recorded.</p>
      )}
    </li>
  );
}

export default App;
