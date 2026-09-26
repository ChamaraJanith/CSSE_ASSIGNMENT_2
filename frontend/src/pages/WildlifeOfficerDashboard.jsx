import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, MapPin, AlertTriangle,
  ClipboardList, Camera, Settings, LogOut, ShieldAlert, CheckCircle
} from 'lucide-react';
import './Dashboard.css';

export default function WildlifeOfficerDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
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
          <li className={`sidebar-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveMenu('dashboard')}>
            <LayoutDashboard className="sidebar-item-icon" /> Overview
          </li>
          <li className={`sidebar-item ${activeMenu === 'patrol' ? 'active' : ''}`} onClick={() => setActiveMenu('patrol')}>
            <MapPin className="sidebar-item-icon" /> My Patrol Zone
          </li>
          <li className={`sidebar-item ${activeMenu === 'report' ? 'active' : ''}`} onClick={() => setActiveMenu('report')}>
            <ClipboardList className="sidebar-item-icon" /> File Report
          </li>
          <li className={`sidebar-item ${activeMenu === 'incidents' ? 'active' : ''}`} onClick={() => setActiveMenu('incidents')}>
            <AlertTriangle className="sidebar-item-icon" /> Incidents
          </li>
          <li className={`sidebar-item ${activeMenu === 'sightings' ? 'active' : ''}`} onClick={() => setActiveMenu('sightings')}>
            <Camera className="sidebar-item-icon" /> Animal Sightings
          </li>
          <li className={`sidebar-item ${activeMenu === 'tasks' ? 'active' : ''}`} onClick={() => setActiveMenu('tasks')}>
            <CheckCircle className="sidebar-item-icon" /> My Tasks
          </li>
          <li className={`sidebar-item ${activeMenu === 'settings' ? 'active' : ''}`} onClick={() => setActiveMenu('settings')}>
            <Settings className="sidebar-item-icon" /> Settings
          </li>
        </ul>
        <div className="sidebar-footer">
          <div className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} /> Logout
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="bg-blob blob-tr"></div>
        <div className="bg-blob blob-bl"></div>

        <header className="top-header">
          <div className="header-title">Wildlife Officer Dashboard</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">Wildlife Officer</span>
              <span className="user-role">Field Patrol</span>
            </div>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>WO</div>
          </div>
        </header>

        <div className="content-area">
          {activeMenu === 'dashboard' && (
            <>
              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                  { label: 'Assigned Checkpoint', value: '—', color: '#10b981' },
                  { label: 'Reports Filed', value: '—', color: '#f59e0b' },
                  { label: 'Active Incidents', value: '—', color: '#ef4444' },
                  { label: 'Sightings Logged', value: '—', color: '#38bdf8' },
                ].map((stat, i) => (
                  <div key={i} className="dashboard-card-full" style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Welcome card */}
              <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
                <div className="card-header">
                  <h2>Field Officer Overview</h2>
                  <p>Monitor your patrol zone, log sightings and file incident reports.</p>
                </div>

                {/* Quick actions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '8px' }}>
                  {[
                    { label: 'File New Report', icon: <ClipboardList size={28} />, color: '#10b981', menu: 'report' },
                    { label: 'Log Sighting', icon: <Camera size={28} />, color: '#38bdf8', menu: 'sightings' },
                    { label: 'Report Incident', icon: <AlertTriangle size={28} />, color: '#ef4444', menu: 'incidents' },
                    { label: 'View My Zone', icon: <MapPin size={28} />, color: '#f59e0b', menu: 'patrol' },
                  ].map((action, i) => (
                    <div
                      key={i}
                      onClick={() => setActiveMenu(action.menu)}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px',
                        padding: '24px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        color: action.color
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    >
                      {action.icon}
                      <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{action.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeMenu !== 'dashboard' && (
            <div className="dashboard-card-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', position: 'relative', zIndex: 10 }}>
              <h3>This module is under construction.</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
