import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, Map, Info, LogOut, ShieldAlert, FileText, Camera
} from 'lucide-react';
import './Dashboard.css';

export default function UserDashboard() {
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
            <LayoutDashboard className="sidebar-item-icon" /> Home
          </li>
          <li className={`sidebar-item ${activeMenu === 'explore' ? 'active' : ''}`} onClick={() => setActiveMenu('explore')}>
            <Map className="sidebar-item-icon" /> Explore Parks
          </li>
          <li className={`sidebar-item ${activeMenu === 'report' ? 'active' : ''}`} onClick={() => setActiveMenu('report')}>
            <FileText className="sidebar-item-icon" /> Report Incident
          </li>
          <li className={`sidebar-item ${activeMenu === 'gallery' ? 'active' : ''}`} onClick={() => setActiveMenu('gallery')}>
            <Camera className="sidebar-item-icon" /> Wildlife Gallery
          </li>
          <li className={`sidebar-item ${activeMenu === 'about' ? 'active' : ''}`} onClick={() => setActiveMenu('about')}>
            <Info className="sidebar-item-icon" /> About Us
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
          <div className="header-title">Welcome to WildGuard</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">Nature Lover</span>
              <span className="user-role">Community Member</span>
            </div>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #14b8a6, #0f766e)' }}>U</div>
          </div>
        </header>

        <div className="content-area">
          {activeMenu === 'dashboard' && (
            <>
              {/* Stats / Info */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                {[
                  { label: 'Parks Visited', value: '2', color: '#14b8a6' },
                  { label: 'Sightings Shared', value: '5', color: '#8b5cf6' },
                  { label: 'Incidents Reported', value: '0', color: '#ef4444' },
                ].map((stat, i) => (
                  <div key={i} className="dashboard-card-full" style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
                <div className="card-header">
                  <h2>Protect & Explore</h2>
                  <p>Discover wildlife, report suspicious activities, and help us conserve nature.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div style={{ background: 'rgba(20, 184, 166, 0.1)', border: '1px solid rgba(20, 184, 166, 0.2)', padding: '20px', borderRadius: '12px' }}>
                    <h3 style={{ color: '#14b8a6', margin: '0 0 10px 0' }}>Latest Sightings</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>View the latest animal sightings reported by the community in your area.</p>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '20px', borderRadius: '12px' }}>
                    <h3 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Report an Issue</h3>
                    <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: 0 }}>Help us protect wildlife by reporting poaching, fires, or injured animals.</p>
                  </div>
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
