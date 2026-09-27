import React, { useState } from 'react';
import { 
  Mail, Lock, Phone, Hash, MapPin, UserPlus, 
  LayoutDashboard, Users, Settings, LogOut, ShieldAlert, Compass
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import PatrolPlanningManager from '../components/patrolPlanning/PatrolPlanningManager';
import './Login.css'; // Input styles
import './Dashboard.css'; // Dashboard layout styles

export default function ParkManagerDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('patrol_planning');
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mobileNumber: '',
    age: '',
    assignedCheckpoint: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:5000/api/wildlife-officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create officer');
      }

      setMessage({ type: 'success', text: 'Wildlife Officer added successfully!' });
      setFormData({ email: '', password: '', mobileNumber: '', age: '', assignedCheckpoint: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <ShieldAlert size={28} />
          WildGuard
        </div>
        
        <ul className="sidebar-menu">
          <li className={`sidebar-item ${activeMenu === 'patrol_planning' ? 'active' : ''}`} onClick={() => setActiveMenu('patrol_planning')}>
            <Compass className="sidebar-item-icon" />
            Patrol Planning (UC01)
          </li>
          <li className={`sidebar-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveMenu('patrol_planning')}>
            <LayoutDashboard className="sidebar-item-icon" />
            Overview
          </li>
          <li className={`sidebar-item ${activeMenu === 'add_officer' ? 'active' : ''}`} onClick={() => setActiveMenu('add_officer')}>
            <UserPlus className="sidebar-item-icon" />
            Add Officer
          </li>
          <li className={`sidebar-item ${activeMenu === 'view_officers' ? 'active' : ''}`} onClick={() => setActiveMenu('view_officers')}>
            <Users className="sidebar-item-icon" />
            View Officers
          </li>
          <li className={`sidebar-item ${activeMenu === 'settings' ? 'active' : ''}`} onClick={() => setActiveMenu('settings')}>
            <Settings className="sidebar-item-icon" />
            Settings
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            Logout
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="bg-blob blob-tr"></div>
        <div className="bg-blob blob-bl"></div>

        <header className="top-header">
          <div className="header-title">
            {activeMenu === 'patrol_planning' ? 'Risk-Based Ranger Patrol Planning (UC01)' : activeMenu === 'add_officer' ? 'Officer Management' : 'Dashboard'}
          </div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">Park Manager</span>
              <span className="user-role">Admin Access</span>
            </div>
            <div className="avatar">PM</div>
          </div>
        </header>

        <div className="content-area">
          {activeMenu === 'patrol_planning' ? (
            <PatrolPlanningManager />
          ) : activeMenu === 'add_officer' ? (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header">
                <h2>Register Wildlife Officer</h2>
                <p>Create a new officer account and assign them to a checkpoint.</p>
              </div>

              {message && (
                <div style={{ 
                  padding: '12px 16px', 
                  borderRadius: '8px', 
                  marginBottom: '24px',
                  background: message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: message.type === 'error' ? '#fca5a5' : '#6ee7b7',
                  border: `1px solid ${message.type === 'error' ? '#ef4444' : '#10b981'}`
                }}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleAddOfficer} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label htmlFor="email">Email Address</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon" />
                      <input type="email" id="email" className="form-input" placeholder="officer@wildguard.com" value={formData.email} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-group" style={{ flex: '1 1 200px' }}>
                    <label htmlFor="password">Temporary Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" />
                      <input type="text" id="password" className="form-input" placeholder="Set password" value={formData.password} onChange={handleChange} required minLength="6" />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '2 1 200px' }}>
                    <label htmlFor="mobileNumber">Mobile Number</label>
                    <div className="input-wrapper">
                      <Phone className="input-icon" />
                      <input type="tel" id="mobileNumber" className="form-input" placeholder="+94 77 123 4567" value={formData.mobileNumber} onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="form-group" style={{ flex: '1 1 100px' }}>
                    <label htmlFor="age">Age</label>
                    <div className="input-wrapper">
                      <Hash className="input-icon" />
                      <input type="number" id="age" className="form-input" placeholder="25" value={formData.age} onChange={handleChange} required min="18" max="65" />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="assignedCheckpoint">Assigned Checkpoint / Zone</label>
                  <div className="input-wrapper">
                    <MapPin className="input-icon" />
                    <input type="text" id="assignedCheckpoint" className="form-input" placeholder="e.g. North Gate Zone A" value={formData.assignedCheckpoint} onChange={handleChange} required />
                  </div>
                </div>

                <button type="submit" className="submit-btn" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '16px', padding: '16px' }}>
                  <UserPlus size={20} />
                  {loading ? 'Registering Officer...' : 'Complete Registration'}
                </button>
              </form>
            </div>
          ) : (
            <div className="dashboard-card-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8' }}>
              <h3>This module is under construction.</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
