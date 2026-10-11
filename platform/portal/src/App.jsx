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
          <h1>EduVision ✨</h1>
          <div className="user-badge">
            {user.avatar && <img src={user.avatar} alt="avatar" />}
            <span>Hi, <strong>{user.displayName || user.username}</strong></span>
            <button onClick={logout} className="btn btn-danger">Exit</button>
          </div>
        </header>
        {['TEACHER', 'ADMIN'].includes(user.role) ? <TeacherDashboard token={token} /> : 
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

  if (loading) return <div className="text-center page-title" style={{marginTop: '40px'}}>Loading dashboard...</div>;

  return (
    <div>
      <h2 className="page-title text-center">Teacher Dashboard</h2>
      
      <div className="grid-2">
        <section className="panel">
          <h3 className="section-title">Create Class</h3>
          <div className="flex-row">
            <input className="input-field" placeholder="Class Name" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
            <button onClick={createClass} className="btn btn-primary">Create</button>
          </div>
          <ul className="list-group" style={{ marginTop: '20px' }}>
            {classes.length === 0 ? <li className="list-item" style={{color: 'var(--text-muted)'}}>No classes yet</li> : classes.map(c => <li key={c.id} className="list-item">{c.name}</li>)}
          </ul>
        </section>

        <TeacherRosterPanel classes={classes} token={token} />
      </div>

      <div className="grid-2" style={{ marginTop: '24px' }}>
        <section className="panel">
          <h3 className="section-title">Assign Activity</h3>
          <div className="form-group">
            <input className="input-field" placeholder="Assignment Title" value={newAssignment.title} onChange={e => setNewAssignment({...newAssignment, title: e.target.value})} />
            <select className="input-field" value={newAssignment.classId} onChange={e => setNewAssignment({...newAssignment, classId: e.target.value})}>
              <option value="">-- Select Class --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input-field" value={newAssignment.appId} onChange={e => setNewAssignment({...newAssignment, appId: e.target.value})}>
              <option value="">-- Select Application --</option>
              {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={createAssignment} className="btn btn-success" style={{ marginTop: '10px' }}>Create Assignment</button>
          </div>
        </section>
      </div>

      <section className="panel" style={{ marginTop: '24px' }}>
        <h3 className="section-title">Results & Active Assignments</h3>
        {assignments.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No assignments created.</p> : (
          <ul className="list-group">
            {assignments.map(a => (
              <li key={a.id} className="list-item" style={{ paddingBottom: '16px', marginBottom: '8px' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: '8px' }}>
                  <strong>{a.title}</strong> — <span style={{color: 'var(--text-muted)'}}>{a.application.name}</span> <em>({a.class.name})</em>
                </div>
                <ul style={{ paddingLeft: '20px', listStyleType: 'circle', color: 'var(--text-muted)' }}>
                  {a.results.length === 0 ? <li>No results yet</li> : a.results.map(r => (
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

  // If classes load and we have a stored class, ensure it's still valid
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

  return (
    <section className="panel">
      <h3 className="section-title">Class Roster</h3>
      <select className="input-field" value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={{ marginBottom: '10px' }}>
        <option value="">-- Select Class to Manage --</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {selectedClass && (
        <div style={{ marginTop: '10px' }}>
          <div className="flex-row" style={{ marginBottom: '16px' }}>
            <select className="input-field" value={studentToEnroll} onChange={e => setStudentToEnroll(e.target.value)}>
              <option value="">-- Select Student to Add --</option>
              {allStudents.filter(s => !roster.find(r => r.id === s.id)).map(s => (
                <option key={s.id} value={s.id}>
                  {s.displayName ? `${s.displayName} (${s.username})` : s.username}
                </option>
              ))}
            </select>
            <button onClick={enrollStudent} className="btn btn-success" disabled={!studentToEnroll}>
              Add to Class
            </button>
          </div>

          <ul className="list-group">
            {roster.length === 0 ? <p style={{color: 'var(--text-muted)'}}>No students enrolled in this class yet.</p> : roster.map(s => (
              <li key={s.id} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {s.avatar && <img src={s.avatar} alt="avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
                  <span><strong>{s.displayName || s.username}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.85em' }}>({s.username})</span></span>
                </div>
                <button onClick={() => removeStudent(s.id)} className="btn btn-danger" style={{ padding: '4px 8px', minHeight: '30px', fontSize: '0.9rem' }}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
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
              const result = a.results[0]; // Assuming one result per user per assignment
              const isCompleted = result && result.status === 'COMPLETED';
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

      <ParentChildManager token={token} onChildLinked={(child) => {
        setChildren(prev => {
          if (prev.some(c => c.id === child.id)) return prev;
          return [...prev, child];
        });
        handleSelectChild(child.id);
      }} />

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

function ParentChildManager({ token, onChildLinked }) {
  const [tab, setTab] = useState('CREATE'); // 'CREATE' or 'LINK'
  
  // Create child state
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('https://api.dicebear.com/7.x/bottts/svg?seed=Buddy');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Link existing student state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const avatarPresets = [
    'https://api.dicebear.com/7.x/bottts/svg?seed=Buddy',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sparky',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Star',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Luna',
    'https://api.dicebear.com/7.x/bottts/svg?seed=Sunny',
  ];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/portal/parent/create-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ displayName: name.trim(), avatar: selectedAvatar })
      });
      const data = await res.json();
      onChildLinked(data.child);
      setName('');
      alert(`🎉 Added ${data.child.displayName} to your family!`);
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsSubmitting(true);
    try {
      const res = await apiFetch(`${API_URL}/portal/parent/link-child`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      onChildLinked(data.child);
      setUsername('');
      setPassword('');
      alert(`🎉 Successfully linked ${data.child.displayName || data.child.username}!`);
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="panel" style={{ maxWidth: '540px', margin: '0 auto 30px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        <button 
          type="button"
          onClick={() => setTab('CREATE')} 
          className={`btn ${tab === 'CREATE' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px' }}
        >
          ✨ Add Child
        </button>
        <button 
          type="button"
          onClick={() => setTab('LINK')} 
          className={`btn ${tab === 'LINK' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '10px' }}
        >
          🔗 Link School Account
        </button>
      </div>

      {tab === 'CREATE' ? (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            Enter your child's name and choose an avatar. No passwords to remember!
          </p>

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '6px' }}>Child's Name</label>
            <input 
              className="input-field" 
              placeholder="e.g. Maya or Charlie" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '8px' }}>Choose Avatar</label>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {avatarPresets.map((av, idx) => (
                <img 
                  key={idx} 
                  src={av} 
                  alt={`preset-${idx}`}
                  onClick={() => setSelectedAvatar(av)}
                  style={{ 
                    width: '52px', 
                    height: '52px', 
                    borderRadius: '50%', 
                    cursor: 'pointer',
                    border: selectedAvatar === av ? '4px solid var(--color-primary)' : '2px solid var(--border)',
                    transform: selectedAvatar === av ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s',
                    padding: '2px',
                    background: 'var(--color-sky-blue)'
                  }} 
                />
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-success" 
            style={{ width: '100%', marginTop: '8px' }}
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : 'Add Child to Family ✨'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            Provide your child's school credentials to link an existing school-created student profile.
          </p>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '6px' }}>Student Username</label>
            <input 
              className="input-field" 
              placeholder="e.g. student1" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: '6px' }}>Password</label>
            <input 
              className="input-field" 
              type="password" 
              placeholder="School password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px' }}
            disabled={!username || !password || isSubmitting}
          >
            {isSubmitting ? 'Linking...' : 'Link School Account 🔗'}
          </button>
        </form>
      )}
    </div>
  );
}

export default App;
