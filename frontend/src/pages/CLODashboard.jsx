import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, MessageSquare, FileText,
  Settings, LogOut, ShieldAlert, Bell, MapPin
} from 'lucide-react';
import './Dashboard.css';

export default function CLODashboard() {
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
          <li className={`sidebar-item ${activeMenu === 'community' ? 'active' : ''}`} onClick={() => setActiveMenu('community')}>
            <MessageSquare className="sidebar-item-icon" /> Community Reports
          </li>
          <li className={`sidebar-item ${activeMenu === 'incidents' ? 'active' : ''}`} onClick={() => setActiveMenu('incidents')}>
            <Bell className="sidebar-item-icon" /> Incidents
          </li>
          <li className={`sidebar-item ${activeMenu === 'zones' ? 'active' : ''}`} onClick={() => setActiveMenu('zones')}>
            <MapPin className="sidebar-item-icon" /> Zone Map
          </li>
          <li className={`sidebar-item ${activeMenu === 'reports' ? 'active' : ''}`} onClick={() => setActiveMenu('reports')}>
            <FileText className="sidebar-item-icon" /> Filed Reports
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
          <div className="header-title">Community Liaison Dashboard</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">CLO Officer</span>
              <span className="user-role">Community Liaison</span>
            </div>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #38bdf8, #0284c7)' }}>CL</div>
          </div>
        </header>

        <div className="content-area">
          {activeMenu === 'dashboard' && (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                  { label: 'Open Reports', value: '—', color: '#f59e0b' },
                  { label: 'Resolved Today', value: '—', color: '#10b981' },
                  { label: 'Pending Incidents', value: '—', color: '#ef4444' },
                  { label: 'Community Alerts', value: '—', color: '#38bdf8' },
                ].map((stat, i) => (
                  <div key={i} className="dashboard-card-full" style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
                <div className="card-header">
                  <h2>Community Liaison Overview</h2>
                  <p>Monitor community reports, wildlife incidents and zone activity.</p>
                </div>
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '60px 0' }}>
                  🗺️ Community management modules coming soon.
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
