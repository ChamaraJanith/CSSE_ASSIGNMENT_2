import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, Users, ShieldCheck, Settings,
  LogOut, ShieldAlert, UserCog, Bell, BarChart3
} from 'lucide-react';
import './Dashboard.css';

export default function AdminDashboard() {
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
          <li className={`sidebar-item ${activeMenu === 'users' ? 'active' : ''}`} onClick={() => setActiveMenu('users')}>
            <Users className="sidebar-item-icon" /> Manage Users
          </li>
          <li className={`sidebar-item ${activeMenu === 'roles' ? 'active' : ''}`} onClick={() => setActiveMenu('roles')}>
            <UserCog className="sidebar-item-icon" /> Role Management
          </li>
          <li className={`sidebar-item ${activeMenu === 'reports' ? 'active' : ''}`} onClick={() => setActiveMenu('reports')}>
            <BarChart3 className="sidebar-item-icon" /> Reports
          </li>
          <li className={`sidebar-item ${activeMenu === 'alerts' ? 'active' : ''}`} onClick={() => setActiveMenu('alerts')}>
            <Bell className="sidebar-item-icon" /> System Alerts
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
          <div className="header-title">Admin Dashboard</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">System Administrator</span>
              <span className="user-role">Full Access</span>
            </div>
            <div className="avatar">AD</div>
          </div>
        </header>

        <div className="content-area">
          {activeMenu === 'dashboard' && (
            <>
              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                  { label: 'Total Users', value: '—', icon: <Users size={24} />, color: '#10b981' },
                  { label: 'Park Managers', value: '—', icon: <ShieldCheck size={24} />, color: '#6366f1' },
                  { label: 'Wildlife Officers', value: '—', icon: <ShieldAlert size={24} />, color: '#f59e0b' },
                  { label: 'CLO Officers', value: '—', icon: <UserCog size={24} />, color: '#38bdf8' },
                ].map((stat, i) => (
                  <div key={i} className="dashboard-card-full" style={{ padding: '24px', position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ color: stat.color }}>{stat.icon}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fff' }}>{stat.value}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent activity placeholder */}
              <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
                <div className="card-header">
                  <h2>System Overview</h2>
                  <p>Welcome, Administrator. You have full control over WildGuard.</p>
                </div>
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '60px 0', fontSize: '1rem' }}>
                  📊 Analytics & management modules coming soon.
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
