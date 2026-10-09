import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import {
  LayoutDashboard, MessageSquare, FileText,
  Settings, LogOut, ShieldAlert, Bell, MapPin
} from 'lucide-react';
import { apiService } from '../services/api';
import './Dashboard.css';

import LeafletMap from '../components/CLODashboard/LeafletMap';
import FiledReportsModule from '../components/CLODashboard/FiledReportsModule';
import FullZoneMap from '../components/CLODashboard/FullZoneMap';
import IncidentsModule from '../components/CLODashboard/IncidentsModule';

export default function CLODashboard() {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState('dashboard');

  const [allReports, setAllReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [rangers, setRangers] = useState([]);
  const [selectedRanger, setSelectedRanger] = useState('');
  
  React.useEffect(() => {
    const fetchRangers = async () => {
      try {
        const result = await apiService.getRangers();
        setRangers(result.data || []);
      } catch (err) {
        console.error("Failed to fetch rangers", err);
      }
    };
    fetchRangers();
  }, []);
  
  const fetchReports = async () => {
    try {
      const result = await apiService.getAllReports();
      // Sort: NEW status first, then by immediate_risk
      const sorted = result.data.sort((a, b) => {
        if (a.status === 'NEW' && b.status !== 'NEW') return -1;
        if (b.status === 'NEW' && a.status !== 'NEW') return 1;
        if (a.immediate_risk && !b.immediate_risk) return -1;
        if (b.immediate_risk && !a.immediate_risk) return 1;
        return 0;
      });
      setAllReports(sorted);
    } catch (err) {
      console.error("Failed to fetch reports", err);
    }
  };

  React.useEffect(() => {
    if (activeMenu === 'community' || activeMenu === 'dashboard') {
      fetchReports();
    }
  }, [activeMenu]);

  const openReports = allReports.filter(r => r.status === 'NEW').length;
  const pendingIncidents = allReports.filter(r => ['UNDER_REVIEW', 'PENDING_INFORMATION', 'RANGER_ASSIGNED'].includes(r.status)).length;
  const communityAlerts = allReports.filter(r => r.immediate_risk).length;
  const today = new Date().toDateString();
  const resolvedToday = allReports.filter(r => r.status === 'RESOLVED' && new Date(r.updated_at || r.incident_datetime).toDateString() === today).length;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleUpdateStatus = async (code, newStatus, newPriority = null, clarificationRequest = null, assignedRangerId = null, rangerStatus = null) => {
    try {
      const payload = { status: newStatus };
      if (newPriority) payload.priority = newPriority;
      if (clarificationRequest) payload.clarification_request = clarificationRequest;
      if (assignedRangerId) payload.assigned_ranger_id = assignedRangerId;
      if (rangerStatus) payload.ranger_status = rangerStatus;
      
      await apiService.updateReport(code, payload);
      alert("Report updated successfully!");
      setActiveMenu('community');
    } catch (err) {
      alert("Error: " + err.message);
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
          <li className={`sidebar-item ${activeMenu === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveMenu('dashboard')}>
            <LayoutDashboard className="sidebar-item-icon" /> Overview
          </li>
          <li className={`sidebar-item ${activeMenu === 'community' || activeMenu === 'review-report' ? 'active' : ''}`} onClick={() => setActiveMenu('community')}>
            <MessageSquare className="sidebar-item-icon" /> Conflict Report Queue
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
                  { label: 'Open Reports', value: openReports.toString(), color: '#f59e0b' },
                  { label: 'Resolved Today', value: resolvedToday.toString(), color: '#10b981' },
                  { label: 'Pending Incidents', value: pendingIncidents.toString(), color: '#ef4444' },
                  { label: 'Community Alerts', value: communityAlerts.toString(), color: '#38bdf8' },
                ].map((stat, i) => (
                  <div key={i} className="dashboard-card-full" style={{ padding: '24px', position: 'relative', zIndex: 10 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '8px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
                <div className="card-header">
                  <h2>Recent Community Reports</h2>
                  <p>Latest wildlife incidents and zone activity.</p>
                </div>
                <div style={{ overflowX: 'auto', marginTop: '20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#e2e8f0' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                        <th style={{ padding: '12px', fontWeight: 500 }}>Report ID</th>
                        <th style={{ padding: '12px', fontWeight: 500 }}>Incident</th>
                        <th style={{ padding: '12px', fontWeight: 500 }}>Area</th>
                        <th style={{ padding: '12px', fontWeight: 500 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allReports.slice(0, 5).map(report => (
                        <tr key={report.id} style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                        }}>
                          <td style={{ padding: '12px' }}>{report.report_code}</td>
                          <td style={{ padding: '12px' }}>{report.incident_type}</td>
                          <td style={{ padding: '12px' }}>{report.area}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                              background: report.status === 'NEW' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                              color: report.status === 'NEW' ? '#f59e0b' : '#10b981'
                            }}>
                              {report.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {allReports.length === 0 && (
                        <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No recent reports found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeMenu === 'community' && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header">
                <h2>Conflict Report Queue</h2>
                <p>Review and prioritize incoming incident reports from the community.</p>
              </div>
              
              <div style={{ overflowX: 'auto', marginTop: '20px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#e2e8f0' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Report ID</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Incident</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Area</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Submitted</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Immediate danger</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>Status</th>
                      <th style={{ padding: '12px', fontWeight: 500 }}>View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allReports.map(report => (
                      <tr key={report.id} style={{ 
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: report.immediate_risk ? 'rgba(239, 68, 68, 0.05)' : 'transparent'
                      }}>
                        <td style={{ padding: '12px' }}>{report.report_code}</td>
                        <td style={{ padding: '12px' }}>{report.incident_type}</td>
                        <td style={{ padding: '12px' }}>{report.area}</td>
                        <td style={{ padding: '12px' }}>{new Date(report.incident_datetime).toLocaleDateString()}</td>
                        <td style={{ padding: '12px', color: report.immediate_risk ? '#ef4444' : '#94a3b8', fontWeight: report.immediate_risk ? 'bold' : 'normal' }}>
                          {report.immediate_risk ? 'YES (Urgent)' : 'No'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold',
                            background: report.status === 'NEW' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                            color: report.status === 'NEW' ? '#f59e0b' : '#10b981'
                          }}>
                            {report.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <button onClick={() => { setSelectedReport(report); setActiveMenu('review-report'); }} className="submit-btn" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>View</button>
                        </td>
                      </tr>
                    ))}
                    {allReports.length === 0 && (
                      <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No reports found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeMenu === 'review-report' && selectedReport && (
            <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2>Review & Prioritise Conflict Report</h2>
                  <p>Report ID: {selectedReport.report_code}</p>
                </div>
                <button onClick={() => setActiveMenu('community')} className="submit-btn" style={{ width: 'auto', background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8' }}>Back to Queue</button>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Incident Type: <span style={{ color: '#e2e8f0' }}>{selectedReport.incident_type}</span></p>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Area: <span style={{ color: '#e2e8f0' }}>{selectedReport.area}</span></p>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Date: <span style={{ color: '#e2e8f0' }}>{new Date(selectedReport.incident_datetime).toLocaleString()}</span></p>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Current Status: <span style={{ color: '#e2e8f0' }}>{selectedReport.status}</span></p>
                </div>
                <div>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Reporter: <span style={{ color: '#e2e8f0' }}>{selectedReport.reporter_name}</span></p>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Contact: <span style={{ color: '#e2e8f0' }}>{selectedReport.contact_number}</span></p>
                  <p style={{ color: '#94a3b8', margin: '4px 0' }}>Immediate Risk: <span style={{ color: selectedReport.immediate_risk ? '#ef4444' : '#e2e8f0' }}>{selectedReport.immediate_risk ? 'YES' : 'NO'}</span></p>
                </div>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginTop: '20px' }}>
                <p style={{ color: '#94a3b8', margin: '0 0 8px 0' }}>Description:</p>
                <p style={{ color: '#e2e8f0', margin: 0 }}>{selectedReport.description}</p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginTop: '20px' }}>
                <p style={{ color: '#94a3b8', margin: '0 0 12px 0' }}>Evidence:</p>
                {selectedReport.evidence_url && !selectedReport.evidence_url.includes('simulated') ? (
                  <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                    <div style={{ width: '100%', height: '250px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img 
                        src={selectedReport.evidence_url} 
                        alt="Evidence" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                ) : selectedReport.evidence_url && selectedReport.evidence_url.includes('simulated') ? (
                  <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', fontSize: '0.8rem', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      {selectedReport.evidence_url.replace('simulated_upload_url_', '')}
                    </div>
                    <div style={{ width: '100%', height: '250px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img 
                        src={selectedReport.incident_type === 'ELEPHANT_SIGHTING' 
                          ? "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?q=80&w=400&auto=format&fit=crop" 
                          : "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=400&auto=format&fit=crop"} 
                        alt="Evidence Placeholder" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontStyle: 'italic', margin: 0 }}>No evidence provided</p>
                )}
              </div>

              {selectedReport.response_assignments && selectedReport.response_assignments.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ color: '#38bdf8', margin: '0 0 16px 0', fontSize: '1.1rem' }}>Ranger Assignment History</h3>
                  {selectedReport.response_assignments.map((assignment, idx) => (
                    <div key={assignment.id || idx} style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9rem' }}>
                          Assigned to: <span style={{ color: '#e2e8f0' }}>{rangers.find(r => r.id === assignment.ranger_id)?.name || assignment.ranger_id}</span>
                        </p>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '20px', 
                          fontSize: '0.8rem', 
                          background: assignment.status === 'PENDING' ? 'rgba(245, 158, 11, 0.2)' : 
                                      assignment.status === 'ACCEPTED' ? 'rgba(16, 185, 129, 0.2)' : 
                                      assignment.status === 'DECLINED' ? 'rgba(239, 68, 68, 0.2)' : 
                                      assignment.status === 'RESPONDING' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)',
                          color: assignment.status === 'PENDING' ? '#f59e0b' : 
                                 assignment.status === 'ACCEPTED' ? '#10b981' : 
                                 assignment.status === 'DECLINED' ? '#ef4444' : 
                                 assignment.status === 'RESPONDING' ? '#38bdf8' : '#e2e8f0'
                        }}>
                          {assignment.status}
                        </span>
                      </div>
                      
                      {assignment.ranger_location_updates && assignment.ranger_location_updates.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '8px' }}>
                          <h4 style={{ margin: '0 0 8px 0', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                            <MapPin size={16} /> Live GPS Tracking (Simulated)
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                            {(() => {
                              const locations = [...(assignment.ranger_location_updates ?? [])]
                                .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
                              const latest = locations[0];
                              if (!latest) return <div>No tracker location received yet.</div>;
                              const lat = Number(latest.latitude);
                              const lon = Number(latest.longitude);
                              if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                                return <div>Tracker location is invalid.</div>;
                              }
                              return (
                                <>
                                  <div><strong>Last update:</strong> {new Date(latest.recorded_at).toLocaleTimeString()}</div>
                                  <div><strong>Location:</strong> {lat.toFixed(5)}, {lon.toFixed(5)}</div>
                                  <div><strong>Updates received:</strong> {locations.length}</div>
                                  <div><strong>Source:</strong> {latest.source ?? "Unknown"}</div>
                                  <div style={{ gridColumn: "1 / -1", marginTop: 12 }}>
                                    <LeafletMap locations={locations} incidentLocation={selectedReport} />
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      
                      {assignment.outcome && (
                        <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                          <h4 style={{ color: '#10b981', margin: '0 0 8px 0', fontSize: '1rem' }}>Outcome Recorded</h4>
                          <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.5' }}>{assignment.outcome}</p>
                          
                          {assignment.outcome_image_url && (
                            <div>
                              <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '0.9rem' }}>Attached Photo:</p>
                              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                                <div style={{ width: '100%', height: '250px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img 
                                    src={assignment.outcome_image_url} 
                                    alt="Ranger Outcome Evidence" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedReport.report_clarifications && selectedReport.report_clarifications.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ color: '#34d399', margin: '0 0 16px 0', fontSize: '1.1rem' }}>Clarification History</h3>
                  {selectedReport.report_clarifications.map((clarification, idx) => (
                    <div key={clarification.id || idx} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
                      <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                        Officer Request ({new Date(clarification.created_at).toLocaleString()}):
                      </p>
                      <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                        {clarification.officer_request}
                      </p>
                      
                      {clarification.user_reply ? (
                        <>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />
                          <p style={{ color: '#34d399', margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                            User Reply:
                          </p>
                          <p style={{ color: '#e2e8f0', margin: '0 0 16px 0', lineHeight: '1.5' }}>
                            {clarification.user_reply}
                          </p>
                          {clarification.evidence_url && (
                            <div>
                              <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '0.9rem' }}>Attached Photo:</p>
                              <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'hidden', maxWidth: '400px' }}>
                                <div style={{ width: '100%', height: '250px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <img 
                                    src={clarification.evidence_url} 
                                    alt="Clarification Evidence" 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p style={{ color: '#f59e0b', margin: 0, fontStyle: 'italic', fontSize: '0.9rem' }}>Waiting for user reply...</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '16px', marginTop: '32px', flexWrap: 'wrap' }}>
                <button onClick={() => {
                  const reqText = prompt("Enter clarification request message for the user:");
                  if (reqText) {
                    handleUpdateStatus(selectedReport.report_code, 'PENDING_INFORMATION', null, reqText);
                  }
                }} className="submit-btn" style={{ width: 'auto', background: '#ef4444' }}>
                  Request Clarification
                </button>
                <button onClick={() => handleUpdateStatus(selectedReport.report_code, 'UNDER_REVIEW', 'HIGH')} className="submit-btn" style={{ width: 'auto', background: '#f59e0b' }}>
                  Set Priority HIGH & Review
                </button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select 
                    value={selectedRanger} 
                    onChange={(e) => setSelectedRanger(e.target.value)}
                    style={{ padding: '10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', outline: 'none' }}
                  >
                    <option value="">-- Select Ranger --</option>
                    {rangers.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button 
                    onClick={() => {
                      if (!selectedRanger) {
                        alert('Please select a ranger first!');
                        return;
                      }
                      handleUpdateStatus(selectedReport.report_code, 'RANGER_ASSIGNED', null, null, selectedRanger, 'PENDING');
                    }} 
                    className="submit-btn" 
                    style={{ width: 'auto', background: '#10b981' }}
                  >
                    Assign Ranger
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'incidents' && (
            <IncidentsModule />
          )}

          {activeMenu === 'zones' && (
            <FullZoneMap />
          )}

          {activeMenu === 'reports' && (
            <FiledReportsModule />
          )}

          {activeMenu !== 'dashboard' && activeMenu !== 'community' && activeMenu !== 'review-report' && activeMenu !== 'incidents' && activeMenu !== 'zones' && activeMenu !== 'reports' && (
            <div className="dashboard-card-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#94a3b8', position: 'relative', zIndex: 10 }}>
              <h3>This module is under construction.</h3>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
