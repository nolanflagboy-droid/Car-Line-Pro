import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  deleteDoc, 
  doc, 
  updateDoc,
  getDocs 
} from 'firebase/firestore';
import { 
  Car, 
  Users, 
  School, 
  LogOut, 
  Upload, 
  Plus, 
  Trash2, 
  Search, 
  Monitor, 
  CheckCircle,
  Clock,
  Menu,
  X,
  UserPlus,
  Settings,
  Lock,
  AlertTriangle,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
// TODO: PASTE YOUR KEYS FROM FIREBASE CONSOLE HERE
const firebaseConfig = {
  apiKey: "AIzaSyCoxiLT-uCrIUynfRXqkRwtPipn3vW2Tb8",
  authDomain: "car-line-duty.firebaseapp.com",
  projectId: "car-line-duty",
  storageBucket: "car-line-duty.appspot.com",
  messagingSenderId: "889321753686",
  appId: "1:889321753686:web:2886e9d788b49d242fbff7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App ID allows you to run multiple separate "schools" on one database if needed.
// You can leave this as "default-school" or change it to something unique.
const appId = "default-school-v1";

// --- Constants & Helper Functions ---
const COLLECTIONS = {
  SCHOOLS: 'schools',
  USERS: 'users',
  STUDENTS: 'students',
  CALLS: 'calls'
};

const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher'
};

// Helper to format time
const formatTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

// --- Main Application Component ---
export default function CarLineApp() {
  // Auth State
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null); 
  const [loading, setLoading] = useState(true);

  // Data State
  const [schools, setSchools] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [mySchoolStudents, setMySchoolStudents] = useState([]);
  const [mySchoolCalls, setMySchoolCalls] = useState([]);

  // UI State
  const [view, setView] = useState('login'); 
  const [currentTab, setCurrentTab] = useState('display'); 

  // --- Firebase Connection ---
  useEffect(() => {
    const initAuth = async () => {
      // Simple anonymous auth wrapper for this template
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Syncing (Global Listeners) ---
  useEffect(() => {
    if (!firebaseUser) return;

    // 1. Schools
    const unsubSchools = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SCHOOLS),
      (snapshot) => {
        setSchools(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      },
      (err) => console.error("Schools sync error", err)
    );

    // 2. Users (We fetch all and filter in memory due to strict query rules)
    const unsubUsers = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS),
      (snapshot) => {
        const users = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllUsers(users);
      },
      (err) => console.error("Users sync error", err)
    );

    return () => {
      unsubSchools();
      unsubUsers();
    };
  }, [firebaseUser]);

  // --- School Specific Data Syncing ---
  useEffect(() => {
    if (!firebaseUser || !currentUser) return;

    // 3. Students
    const unsubStudents = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.STUDENTS),
      (snapshot) => {
        // Filter in memory for my school
        const allStudents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setMySchoolStudents(allStudents.filter(s => s.schoolId === currentUser.schoolId));
      },
      (err) => console.error("Students sync error", err)
    );

    // 4. Calls
    const unsubCalls = onSnapshot(
      collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.CALLS),
      (snapshot) => {
        const allCalls = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        const today = new Date().toDateString();
        setMySchoolCalls(allCalls.filter(c => 
          c.schoolId === currentUser.schoolId && 
          new Date(c.calledAt || c.timestamp).toDateString() === today
        ));
      },
      (err) => console.error("Calls sync error", err)
    );

    return () => {
      unsubStudents();
      unsubCalls();
    };
  }, [firebaseUser, currentUser]);

  // --- Actions ---

  const handleLogin = (email, password) => {
    const foundUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!foundUser) {
      alert("User email not found. Please contact your school admin.");
      return;
    }

    const school = schools.find(s => s.id === foundUser.schoolId);

    if (!school) {
      alert("School data missing.");
      return;
    }

    if (school.password !== password) {
      alert("Incorrect school password.");
      return;
    }

    setCurrentUser(foundUser);
    setView('dashboard');
    if (foundUser.role === ROLES.ADMIN) setCurrentTab('admin');
    else setCurrentTab('display');
  };

  const handleCreateSchool = async (schoolName, schoolPassword, adminName, adminEmail) => {
    if (!firebaseUser) return;

    if (allUsers.find(u => u.email.toLowerCase() === adminEmail.toLowerCase())) {
      alert("This email is already registered.");
      return;
    }

    try {
      const schoolRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SCHOOLS), {
        name: schoolName,
        password: schoolPassword,
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), {
        schoolId: schoolRef.id,
        name: adminName,
        email: adminEmail,
        role: ROLES.ADMIN,
        createdAt: new Date().toISOString()
      });

      setCurrentUser({
        schoolId: schoolRef.id,
        name: adminName,
        email: adminEmail,
        role: ROLES.ADMIN
      });
      setView('dashboard');
      setCurrentTab('admin');
    } catch (err) {
      console.error(err);
      alert("Error creating school.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('login');
    setMySchoolStudents([]);
    setMySchoolCalls([]);
  };

  // --- Views ---

  if (view === 'login') {
    return (
      <LoginScreen 
        onLogin={handleLogin} 
        onRegister={() => setView('register')} 
      />
    );
  }

  if (view === 'register') {
    return (
      <RegisterScreen 
        onCancel={() => setView('login')} 
        onCreate={handleCreateSchool} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <Car className="h-8 w-8 text-indigo-200" />
              <div className="hidden md:block">
                <h1 className="text-xl font-bold leading-tight">CarLine Pro</h1>
                <div className="text-xs text-indigo-200 font-medium">
                   {schools.find(s => s.id === currentUser.schoolId)?.name || 'Loading...'}
                </div>
              </div>
            </div>

            <nav className="flex space-x-2 bg-indigo-800/50 p-1 rounded-lg">
              <NavButton 
                  active={currentTab === 'display'} 
                  onClick={() => setCurrentTab('display')}
                  icon={<Monitor size={18} />}
                  label="Classroom"
              />
              <NavButton 
                  active={currentTab === 'caller'} 
                  onClick={() => setCurrentTab('caller')}
                  icon={<Car size={18} />}
                  label="Caller"
              />
              {currentUser.role === ROLES.ADMIN && (
                 <NavButton 
                    active={currentTab === 'admin'} 
                    onClick={() => setCurrentTab('admin')}
                    icon={<School size={18} />}
                    label="Admin"
                 />
              )}
            </nav>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium">{currentUser.name}</div>
                <div className="text-xs text-indigo-300 uppercase">{currentUser.role}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-indigo-600 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentTab === 'admin' && (
          <AdminView 
            schoolId={currentUser.schoolId} 
            students={mySchoolStudents}
            users={allUsers.filter(u => u.schoolId === currentUser.schoolId)}
            schoolData={schools.find(s => s.id === currentUser.schoolId)}
          />
        )}
        {currentTab === 'caller' && (
          <CallerView 
            schoolId={currentUser.schoolId} 
            students={mySchoolStudents}
            activeCalls={mySchoolCalls}
          />
        )}
        {currentTab === 'display' && (
          <DisplayView 
            user={currentUser}
            calls={mySchoolCalls}
            students={mySchoolStudents}
          />
        )}
      </main>
    </div>
  );
}

// --- Sub-Components ---

function NavButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active 
          ? 'bg-white text-indigo-700 shadow-sm' 
          : 'text-indigo-100 hover:bg-indigo-600'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function LoginScreen({ onLogin, onRegister }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-700 p-8 text-center">
          <Car className="h-16 w-16 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">CarLine Pro</h1>
          <p className="text-indigo-200 mt-2">Streamlined Dismissal System</p>
        </div>
        <div className="p-8">
          <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="teacher@school.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Password</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  placeholder="Shared school password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-indigo-200"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm mb-3">School not registered yet?</p>
            <button 
              onClick={onRegister}
              className="text-indigo-600 font-medium text-sm hover:underline"
            >
              Register New School
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterScreen({ onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Create New School</h2>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(name, password, adminName, adminEmail); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Set School Password</label>
              <input 
                type="text" 
                required
                placeholder="Everyone will use this to login"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">This password will be shared with all staff.</p>
            </div>
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Name</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={adminName}
                onChange={e => setAdminName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
              <input 
                type="email" 
                required
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button 
              type="button" 
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
            >
              Create School
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- TAB: ADMIN VIEW ---
function AdminView({ schoolId, students, users, schoolData }) {
  const [activeSubTab, setActiveSubTab] = useState('students'); 

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex flex-wrap gap-6">
        <button 
          onClick={() => setActiveSubTab('students')}
          className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'students' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Manage Students
        </button>
        <button 
          onClick={() => setActiveSubTab('users')}
          className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'users' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Manage Users
        </button>
        <button 
          onClick={() => setActiveSubTab('settings')}
          className={`pb-1 text-sm font-medium border-b-2 transition-colors ${activeSubTab === 'settings' ? 'border-indigo-600 text-indigo-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          School Settings
        </button>
      </div>

      <div className="p-6">
        {activeSubTab === 'students' && (
          <StudentManager schoolId={schoolId} students={students} />
        )}
        {activeSubTab === 'users' && (
          <UserManager schoolId={schoolId} users={users} />
        )}
        {activeSubTab === 'settings' && (
          <SchoolSettings schoolData={schoolData} />
        )}
      </div>
    </div>
  );
}

function SchoolSettings({ schoolData }) {
  const [newPassword, setNewPassword] = useState(schoolData?.password || '');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      alert("Password cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.SCHOOLS, schoolData.id), {
        password: newPassword
      });
      alert("School password updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Error updating password.");
    }
    setSaving(false);
  };

  const handleClearHistory = async () => {
    if (!confirm("Are you sure you want to clear ALL call history for this school? This will remove all active and past calls. This cannot be undone.")) return;

    setClearing(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.CALLS));
      const schoolCalls = querySnapshot.docs.filter(doc => doc.data().schoolId === schoolData.id);

      if (schoolCalls.length === 0) {
        alert("No history to clear.");
        setClearing(false);
        return;
      }
      const deletePromises = schoolCalls.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      alert(`Successfully cleared ${schoolCalls.length} records. The dashboard is now empty.`);
    } catch (err) {
      console.error("Error clearing history:", err);
      alert("Failed to clear history.");
    }
    setClearing(false);
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* General Settings */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Settings size={20} /> General Settings
        </h3>

        <form onSubmit={handleSave} className="space-y-4">
           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">School Name</label>
             <div className="px-4 py-2 border border-slate-200 rounded-lg bg-slate-100 text-slate-500">
               {schoolData?.name}
             </div>
             <p className="text-xs text-slate-400 mt-1">School name cannot be changed.</p>
           </div>

           <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Global School Password</label>
             <div className="flex gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input 
                    type="text" 
                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                <button 
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
             </div>
             <p className="text-xs text-slate-500 mt-2">
               Changing this will require all teachers and staff to use the new password next time they log in.
             </p>
           </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 p-6 rounded-lg border border-red-200">
        <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center gap-2">
          <AlertTriangle size={20} /> Data Management
        </h3>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="font-medium text-red-900">Clear Daily History</h4>
            <p className="text-sm text-red-700 mt-1">
              Removes all student calls (waiting and departed) from the database. 
              Use this at the end of the day to reset the dashboard for tomorrow.
            </p>
          </div>
          <button 
            onClick={handleClearHistory}
            disabled={clearing}
            className="whitespace-nowrap bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 shadow-sm"
          >
            {clearing ? 'Clearing...' : 'Clear History'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StudentManager({ schoolId, students }) {
  const [newName, setNewName] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newTeacher, setNewTeacher] = useState('');
  const [showCsv, setShowCsv] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [csvFile, setCsvFile] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newTag || !newName || !newTeacher) return;

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.STUDENTS), {
        schoolId,
        name: newName,
        tag: newTag,
        teacher: newTeacher,
        createdAt: new Date().toISOString()
      });
      setNewName('');
      setNewTag('');
      setNewTeacher('');
    } catch(err) {
      console.error(err);
      alert("Error adding student");
    }
  };

  const handleDelete = async (id) => {
    if(!confirm("Delete this student?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.STUDENTS, id));
    } catch(err) {
      alert("Error deleting");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
    }
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    setProcessing(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const lines = text.split('\n');
      let addedCount = 0;

      for (let line of lines) {
        const cleanLine = line.replace('\r', '');
        const [tag, name, teacher] = cleanLine.split(',').map(s => s?.trim());

        if (tag && name && teacher && tag !== 'Tag' && tag !== '') { 
           await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.STUDENTS), {
              schoolId,
              name,
              tag,
              teacher,
              createdAt: new Date().toISOString()
           });
           addedCount++;
        }
      }
      setProcessing(false);
      setShowCsv(false);
      setCsvFile(null);
      alert(`Added ${addedCount} students successfully.`);
    };

    reader.onerror = () => {
      setProcessing(false);
      alert("Failed to read file");
    };

    reader.readAsText(csvFile);
  };

  const sortedStudents = [...students].sort((a,b) => parseInt(a.tag) - parseInt(b.tag));

  return (
    <div className="space-y-8">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Plus size={16} /> Add Individual Student
        </h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-3">
          <input 
            placeholder="Tag # (e.g. 101)" 
            className="flex-1 px-3 py-2 border rounded text-sm"
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
          />
          <input 
            placeholder="Student Name" 
            className="flex-[2] px-3 py-2 border rounded text-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input 
            placeholder="Teacher Name" 
            className="flex-[2] px-3 py-2 border rounded text-sm"
            value={newTeacher}
            onChange={e => setNewTeacher(e.target.value)}
          />
          <button className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700">Add</button>
        </form>
      </div>

      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Upload size={16} /> Bulk Upload (CSV)
          </h3>
          <button onClick={() => setShowCsv(!showCsv)} className="text-indigo-600 text-xs font-medium hover:underline">
            {showCsv ? 'Hide' : 'Expand'}
          </button>
        </div>

        {showCsv && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
             <p className="text-xs text-slate-500 mb-4">
               Upload a <strong>.csv</strong> file with columns: <code>Tag Number, Student Name, Teacher Name</code>
             </p>

             <div className="flex items-center gap-3 mb-4">
               <input 
                 type="file" 
                 accept=".csv"
                 onChange={handleFileChange}
                 className="block w-full text-sm text-slate-500
                   file:mr-4 file:py-2 file:px-4
                   file:rounded-full file:border-0
                   file:text-sm file:font-semibold
                   file:bg-indigo-50 file:text-indigo-700
                   hover:file:bg-indigo-100"
               />
             </div>

             <button 
                onClick={handleCsvUpload} 
                disabled={!csvFile || processing}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 w-full disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {processing ? 'Processing File...' : 'Upload Data'}
             </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Master Student List ({students.length})</h3>
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
              <tr>
                <th className="px-6 py-3">Tag</th>
                <th className="px-6 py-3">Student Name</th>
                <th className="px-6 py-3">Teacher</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedStudents.map(s => (
                <tr key={s.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{s.tag}</td>
                  <td className="px-6 py-3">{s.name}</td>
                  <td className="px-6 py-3">{s.teacher}</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-8 text-center text-slate-400">
                    No students added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserManager({ schoolId, users }) {
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState(ROLES.TEACHER);

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (users.find(u => u.email.toLowerCase() === newEmail.toLowerCase())) {
      alert("User email already exists");
      return;
    }

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS), {
        schoolId,
        email: newEmail,
        name: newName,
        role: newRole,
        createdAt: new Date().toISOString()
      });
      setNewEmail('');
      setNewName('');
    } catch(err) {
      alert("Error adding user");
    }
  };

  const handleDeleteUser = async (id, role) => {
    if (role === ROLES.ADMIN && users.filter(u => u.role === ROLES.ADMIN).length <= 1) {
      alert("Cannot delete the last admin.");
      return;
    }
    if (confirm("Remove access for this user?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.USERS, id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <UserPlus size={16} /> Add Authorized User
        </h3>
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input 
            placeholder="Full Name" 
            className="px-3 py-2 border rounded text-sm"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            required
          />
          <input 
            type="email"
            placeholder="Email Address" 
            className="px-3 py-2 border rounded text-sm"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            required
          />
          <select 
            className="px-3 py-2 border rounded text-sm"
            value={newRole}
            onChange={e => setNewRole(e.target.value)}
          >
            <option value={ROLES.TEACHER}>Teacher</option>
            <option value={ROLES.ADMIN}>Admin</option>
          </select>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700">Grant Access</button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Authorized Users</h3>
        <div className="overflow-x-auto border rounded-lg shadow-sm">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="bg-white border-b hover:bg-slate-50">
                  <td className="px-6 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-3">{u.email}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      u.role === ROLES.ADMIN ? 'bg-purple-100 text-purple-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => handleDeleteUser(u.id, u.role)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- TAB: CALLER VIEW ---
function CallerView({ schoolId, students, activeCalls }) {
  const [input, setInput] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCall = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const matchedStudents = students.filter(s => s.tag === input.trim());
    const now = new Date().toISOString();

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.CALLS), {
        schoolId,
        tag: input.trim(),
        calledAt: now, 
        timestamp: now, 
        status: 'waiting', 
        studentCount: matchedStudents.length 
      });
      setInput('');
      inputRef.current?.focus();
    } catch(err) {
      console.error(err);
      alert("Failed to send call");
    }
  };

  const handleKeypad = (num) => {
    if (num === 'C') setInput('');
    else if (num === 'BACK') setInput(prev => prev.slice(0, -1));
    else setInput(prev => prev + num);
    inputRef.current?.focus();
  };

  const recentCalls = [...activeCalls].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 flex flex-col">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Car className="text-indigo-600" /> Enter Car Tag
        </h2>

        <form onSubmit={handleCall} className="mb-6">
          <input 
            ref={inputRef}
            type="number" 
            className="w-full text-5xl font-mono text-center py-6 border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-200"
            placeholder="---"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
          />
        </form>

        <div className="grid grid-cols-3 gap-3 flex-1">
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button 
              key={n}
              onClick={() => handleKeypad(n.toString())}
              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-3xl font-bold text-slate-700 py-4 transition-colors active:scale-95"
            >
              {n}
            </button>
          ))}
          <button 
            onClick={() => handleKeypad('C')}
            className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-xl font-bold text-red-600 py-4 transition-colors"
          >
            CLR
          </button>
          <button 
             onClick={() => handleKeypad('0')}
             className="bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-3xl font-bold text-slate-700 py-4"
          >
            0
          </button>
          <button 
            onClick={handleCall}
            className="bg-green-600 hover:bg-green-700 border border-green-700 rounded-lg text-xl font-bold text-white py-4 shadow-md active:scale-95"
          >
            CALL
          </button>
        </div>
      </div>

      <div className="bg-slate-100 p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-700 mb-4 flex items-center gap-2">
           <Clock size={20} /> Recently Called
        </h3>
        <div className="space-y-3">
          {recentCalls.map(call => {
             const time = formatTime(call.calledAt || call.timestamp);
             const studentsForCall = students.filter(s => s.tag === call.tag);

             return (
               <div key={call.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-indigo-500 flex justify-between items-center animate-in slide-in-from-left-2 duration-300">
                 <div>
                    <div className="text-2xl font-bold text-indigo-900">#{call.tag}</div>
                    <div className="text-xs text-slate-400">{time}</div>
                 </div>
                 <div className="text-right">
                    {studentsForCall.length > 0 ? (
                      <div className="text-sm font-medium text-slate-700">
                        {studentsForCall.map(s => s.name).join(', ')}
                      </div>
                    ) : (
                      <div className="text-sm text-red-400 italic">Unknown Tag</div>
                    )}
                 </div>
               </div>
             )
          })}
          {recentCalls.length === 0 && (
            <div className="text-center text-slate-400 py-10">No calls yet today</div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- TAB: DISPLAY VIEW ---
function DisplayView({ user, calls, students }) {
  const [filterTeacher, setFilterTeacher] = useState('All');
  const [hideDeparted, setHideDeparted] = useState(true);

  // Pagination State
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const hydratedCalls = useMemo(() => {
    return calls.map(call => {
      const matched = students.filter(s => s.tag === call.tag);
      return { ...call, students: matched };
    }).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [calls, students]);

  const filteredCalls = useMemo(() => {
    return hydratedCalls.filter(call => {
      if (hideDeparted && call.status === 'departed') return false;
      if (filterTeacher !== 'All') {
        return call.students.some(s => s.teacher === filterTeacher);
      }
      return true;
    });
  }, [hydratedCalls, filterTeacher, hideDeparted]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterTeacher, hideDeparted]);

  const totalPages = Math.ceil(filteredCalls.length / ITEMS_PER_PAGE) || 1;
  const paginatedCalls = filteredCalls.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const teachers = useMemo(() => {
    const t = new Set(students.map(s => s.teacher));
    return Array.from(t).sort();
  }, [students]);

  useEffect(() => {
    if (user.role === ROLES.TEACHER) {
      const match = teachers.find(t => t.toLowerCase() === user.name.toLowerCase());
      if (match) setFilterTeacher(match);
    }
  }, [user, teachers]);

  const markDeparted = async (callId) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', COLLECTIONS.CALLS, callId), {
        status: 'departed',
        departedAt: new Date().toISOString()
      });
    } catch(err) {
      console.error(err);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap gap-4 items-center justify-between sticky top-20 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
             <Search size={20} className="text-slate-400" />
             <span className="text-sm font-medium text-slate-700">Filter by Teacher:</span>
             <select 
               className="border-slate-300 rounded-md text-sm py-1.5 pl-2 pr-8 focus:ring-indigo-500 focus:border-indigo-500"
               value={filterTeacher}
               onChange={e => setFilterTeacher(e.target.value)}
             >
               <option value="All">Show All Classes</option>
               {teachers.map(t => <option key={t} value={t}>{t}</option>)}
             </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input 
              type="checkbox" 
              checked={hideDeparted} 
              onChange={e => setHideDeparted(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            Hide Departed
          </label>
        </div>
        <div className="text-sm text-slate-500">
           Showing {paginatedCalls.length} of {filteredCalls.length} Active Cars
        </div>
      </div>

      <div className="flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {paginatedCalls.map(call => {
             const isDeparted = call.status === 'departed';
             const calledTime = formatTime(call.calledAt || call.timestamp);
             const departedTime = isDeparted ? formatTime(call.departedAt) : null;

             return (
               <div 
                 key={call.id} 
                 className={`relative overflow-hidden rounded-xl border-2 transition-all duration-500 ${
                   isDeparted 
                     ? 'bg-slate-50 border-slate-200 opacity-60 grayscale' 
                     : 'bg-white border-indigo-100 shadow-md hover:shadow-lg hover:border-indigo-300 transform hover:-translate-y-1'
                 }`}
               >
                 <div className={`p-4 flex justify-between items-center ${isDeparted ? 'bg-slate-100' : 'bg-indigo-600'}`}>
                   <h2 className={`text-3xl font-black ${isDeparted ? 'text-slate-500' : 'text-white'}`}>
                     #{call.tag}
                   </h2>
                   <div className="text-right">
                     <div className={`text-xs font-mono ${isDeparted ? 'text-slate-400' : 'text-indigo-200'}`}>
                       Called: {calledTime}
                     </div>
                     {departedTime && (
                        <div className="text-xs font-mono text-slate-400">
                          Dep: {departedTime}
                        </div>
                     )}
                   </div>
                 </div>

                 <div className="p-4 space-y-3 min-h-[140px]">
                   {call.students.length > 0 ? (
                     call.students.map((student, idx) => (
                       <div key={idx} className={`flex flex-col pb-2 ${idx !== call.students.length -1 ? 'border-b border-slate-100' : ''}`}>
                          <span className="font-bold text-slate-800 text-lg leading-tight">{student.name}</span>
                          <span className="text-sm text-indigo-600 font-medium">{student.teacher}</span>
                       </div>
                     ))
                   ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <span className="text-sm italic">No students linked</span>
                      </div>
                   )}
                 </div>

                 <div className="p-3 bg-slate-50 border-t border-slate-100">
                   {!isDeparted ? (
                     <button 
                       onClick={() => markDeparted(call.id)}
                       className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                     >
                       <CheckCircle size={16} /> Mark Departed
                     </button>
                   ) : (
                     <div className="w-full py-2 text-center text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
                       <CheckCircle size={16} /> Departed
                     </div>
                   )}
                 </div>
               </div>
             );
          })}

          {filteredCalls.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="bg-slate-100 p-6 rounded-full mb-4">
                <Car size={48} className="text-slate-300" />
              </div>
              <p className="text-lg font-medium">No active cars for this filter.</p>
              <p className="text-sm">Waiting for calls from the parking lot...</p>
            </div>
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8 pb-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm font-medium text-slate-600">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
