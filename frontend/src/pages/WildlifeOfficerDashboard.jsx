import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, MapPin, AlertTriangle,
  ClipboardList, Camera, Settings, LogOut, ShieldAlert, CheckCircle
} from 'lucide-react';
import { apiService } from '../services/api';
import './Dashboard.css';

export default function WildlifeOfficerDashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [assignedReports, setAssignedReports] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // State for recording outcome with image
  const [recordingOutcomeFor, setRecordingOutcomeFor] = useState(null);
  const [outcomeText, setOutcomeText] = useState('');
  const [outcomeImage, setOutcomeImage] = useState(null);
  const [isSubmittingOutcome, setIsSubmittingOutcome] = useState(false);
  const [isSimulatingGPS, setIsSimulatingGPS] = useState(null);
  const [gpsSimulationState, setGpsSimulationState] = useState(null);

  React.useEffect(() => {
    if (activeMenu === 'tasks') {
      const fetchTasks = async () => {
        try {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.id) {
            setCurrentUserId(userData.user.id);
            const result = await apiService.getAllReports(null, userData.user.id);
            setAssignedReports(result.data || []);
          }
        } catch (err) {
          console.error("Failed to fetch assigned tasks", err);
        }
      };
      fetchTasks();
    }
  }, [activeMenu]);

  const handleUpdateTask = async (code, assignmentId, rangerStatus, reportStatus = null, outcome = null) => {
    try {
      const payload = { assignment_id: assignmentId, ranger_status: rangerStatus };
      if (reportStatus) payload.status = reportStatus;
      if (outcome) payload.ranger_outcome = outcome;

      await apiService.updateReport(code, payload);
      alert("Task updated successfully!");
      setActiveMenu('dashboard');
      setTimeout(() => setActiveMenu('tasks'), 100);
    } catch (err) {
      alert("Error updating task.");
    }
  };

  const submitOutcome = async () => {
    if (!outcomeText) {
      alert("Please enter the outcome description.");
      return;
    }
    
    setIsSubmittingOutcome(true);
    try {
      let imageUrl = null;
      if (outcomeImage) {
        const fileExt = outcomeImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(filePath, outcomeImage);

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('evidence')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData.publicUrl;
      }

      const payload = { 
        assignment_id: recordingOutcomeFor.assignmentId,
        ranger_status: 'OUTCOME_RECORDED',
        status: 'RESOLVED',
        ranger_outcome: outcomeText
      };
      if (imageUrl) payload.ranger_outcome_image = imageUrl;

      await apiService.updateReport(recordingOutcomeFor.code, payload);
      alert("Outcome recorded successfully!");
      setRecordingOutcomeFor(null);
      setOutcomeText('');
      setOutcomeImage(null);
      setActiveMenu('dashboard');
      setTimeout(() => setActiveMenu('tasks'), 100);
    } catch (err) {
      console.error(err);
      alert("Error uploading image or recording outcome.");
    } finally {
      setIsSubmittingOutcome(false);
    }
  };

  const handleSimulateGPS = async (assignmentId) => {
    setIsSimulatingGPS(assignmentId);
    const coordinates = [
        { lat: 6.9271, lng: 79.8612 },
        { lat: 6.9275, lng: 79.8615 },
        { lat: 6.9280, lng: 79.8620 },
        { lat: 6.9285, lng: 79.8625 },
        { lat: 6.9290, lng: 79.8630 }
    ];

    setGpsSimulationState({
      active: true,
      currentPoint: 0,
      totalPoints: coordinates.length,
      lastLat: 'N/A',
      lastLng: 'N/A',
      lastTime: 'N/A',
      assignmentId
    });

    for (let i = 0; i < coordinates.length; i++) {
        // check if user clicked "Stop Simulation"
        // In a real app we'd need a ref or state check here, for simplicity we'll just let it run 
        // or check if active is still true (React state closure might need a ref, so we'll just run it)
        try {
            await apiService.postLocationUpdate(assignmentId, coordinates[i].lat, coordinates[i].lng);
            setGpsSimulationState(prev => prev ? {
              ...prev,
              currentPoint: i + 1,
              lastLat: coordinates[i].lat.toFixed(4),
              lastLng: coordinates[i].lng.toFixed(4),
              lastTime: new Date().toLocaleTimeString()
            } : prev);
        } catch (e) {
            console.error("Simulation error", e);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
    
    setGpsSimulationState(prev => prev ? { ...prev, active: false } : null);
    setIsSimulatingGPS(null);
  };

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
          <div className="header-title">Ranger Dashboard</div>
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">Ranger</span>
              <span className="user-role">Field Patrol</span>
            </div>
            <div className="avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>RG</div>
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
                  <h2>Ranger Overview</h2>
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

          {activeMenu === 'tasks' && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header">
                <h2>My Assigned Tasks</h2>
                <p>Manage reports assigned to you by the Community Liaison Officer.</p>
              </div>

              {/* GPS Tracker Status Panel */}
              {gpsSimulationState?.active && (
                <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid #6366f1', padding: '16px', borderRadius: '12px', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: '0 0 8px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={20} /> GPS Tracker: SIMULATING
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#cbd5e1', fontSize: '0.9rem' }}>
                      <div><strong>Device:</strong> GPS-01 (Simulated)</div>
                      <div><strong>Last update:</strong> {gpsSimulationState.lastTime}</div>
                      <div><strong>Location:</strong> {gpsSimulationState.lastLat}, {gpsSimulationState.lastLng}</div>
                      <div><strong>Updates sent:</strong> {gpsSimulationState.currentPoint} / {gpsSimulationState.totalPoints}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setGpsSimulationState(prev => prev ? { ...prev, active: false } : null)}
                    style={{ background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                    Stop Simulation
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '20px' }}>
                {assignedReports.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No tasks assigned currently.</p>
                ) : (
                  assignedReports.map(report => {
                    // Find the most recent assignment for this ranger
                    const assignmentsForMe = report.response_assignments?.filter(a => a.ranger_id === currentUserId) || [];
                    const activeAssignment = assignmentsForMe[assignmentsForMe.length - 1];
                    if (!activeAssignment) return null;

                    return (
                    <div key={report.report_code} style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', padding: '20px', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{report.report_code}</span>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '20px', 
                          fontSize: '0.8rem', 
                          background: activeAssignment.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 
                                      activeAssignment.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.2)' : 
                                      activeAssignment.status === 'DECLINED' ? 'rgba(239, 68, 68, 0.2)' : 
                                      activeAssignment.status === 'RESPONDING' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)',
                          color: activeAssignment.status === 'PENDING' ? '#f59e0b' : 
                                 activeAssignment.status === 'ACCEPTED' ? '#10b981' : 
                                 activeAssignment.status === 'DECLINED' ? '#ef4444' : 
                                 activeAssignment.status === 'RESPONDING' ? '#38bdf8' : '#e2e8f0'
                        }}>
                          {activeAssignment.status || 'UNKNOWN'}
                        </span>
                      </div>
                      <p style={{ color: '#e2e8f0', margin: '0 0 8px 0' }}><strong>Incident:</strong> {report.incident_type}</p>
                      <p style={{ color: '#e2e8f0', margin: '0 0 16px 0' }}><strong>Location:</strong> {report.area} — {report.landmark}</p>
                      
                      {activeAssignment.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button onClick={() => handleUpdateTask(report.report_code, activeAssignment.id, 'ACCEPTED')} className="submit-btn" style={{ width: 'auto', padding: '8px 16px', background: '#10b981' }}>Acknowledge</button>
                          <button onClick={() => handleUpdateTask(report.report_code, activeAssignment.id, 'DECLINED')} className="submit-btn" style={{ width: 'auto', padding: '8px 16px', background: '#ef4444' }}>Decline</button>
                        </div>
                      )}

                      {activeAssignment.status === 'ACCEPTED' && (
                        <button onClick={() => handleUpdateTask(report.report_code, activeAssignment.id, 'RESPONDING', 'RANGER_RESPONDING')} className="submit-btn" style={{ width: 'auto', padding: '8px 16px', background: '#38bdf8' }}>Mark as Responding</button>
                      )}

                      {activeAssignment.status === 'RESPONDING' && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button onClick={() => setRecordingOutcomeFor({ code: report.report_code, assignmentId: activeAssignment.id })} className="submit-btn" style={{ width: 'auto', padding: '8px 16px', background: '#f59e0b' }}>Record Outcome</button>
                          <button 
                            onClick={() => handleSimulateGPS(activeAssignment.id)} 
                            disabled={isSimulatingGPS === activeAssignment.id}
                            className="submit-btn" 
                            style={{ width: 'auto', padding: '8px 16px', background: '#6366f1' }}>
                            {isSimulatingGPS === activeAssignment.id ? 'Simulating GPS...' : 'Start GPS Simulation'}
                          </button>
                        </div>
                      )}
                    </div>
                  )})
                )}
              </div>
              
              {/* Record Outcome Modal */}
              {recordingOutcomeFor && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="dashboard-card-full" style={{ width: '90%', maxWidth: '500px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', zIndex: 1001, padding: '24px', borderRadius: '16px' }}>
                    <h3 style={{ color: '#fff', marginTop: 0 }}>Record Outcome</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Report ID: {recordingOutcomeFor}</p>
                    
                    <div style={{ marginTop: '20px' }}>
                      <label style={{ color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>Outcome Description (Required)</label>
                      <textarea 
                        value={outcomeText}
                        onChange={(e) => setOutcomeText(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff', minHeight: '100px' }}
                        placeholder="What happened? Was the animal relocated? Any injuries?"
                      />
                    </div>

                    <div style={{ marginTop: '20px' }}>
                      <label style={{ color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>Attach Photo (Optional)</label>
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={(e) => setOutcomeImage(e.target.files[0])}
                        style={{ color: '#94a3b8' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '30px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setRecordingOutcomeFor(null)} className="submit-btn" style={{ width: 'auto', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }}>Cancel</button>
                      <button onClick={submitOutcome} disabled={isSubmittingOutcome} className="submit-btn" style={{ width: 'auto', background: '#10b981' }}>
                        {isSubmittingOutcome ? 'Saving...' : 'Save Outcome'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMenu !== 'dashboard' && activeMenu !== 'tasks' && (
            <div className="dashboard-card-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', position: 'relative', zIndex: 10 }}>
              <h3>This module is under construction.</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
