import React, { useState } from 'react';
import { apiService } from '../../services/api';

const IncidentsModule = () => {
  const [incidents, setIncidents] = useState([]);
  const [formData, setFormData] = useState({ title: '', description: '', category: 'Wildlife Sighting', severity: 'LOW', location: '', status: 'OPEN' });
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const result = await apiService.getIncidents();
      setIncidents(result || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await apiService.updateIncident(editingId, formData);
        alert('Incident updated!');
      } else {
        await apiService.createIncident(formData);
        alert('Incident created!');
      }
      setFormData({ title: '', description: '', category: 'Wildlife Sighting', severity: 'LOW', location: '', status: 'OPEN' });
      setEditingId(null);
      fetchIncidents();
    } catch (err) {
      alert('Error saving incident');
    }
    setLoading(false);
  };

  const handleEdit = (incident) => {
    setFormData({
      title: incident.title,
      description: incident.description || '',
      category: incident.category,
      severity: incident.severity,
      location: incident.location || '',
      status: incident.status
    });
    setEditingId(incident.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this incident?')) return;
    try {
      await apiService.deleteIncident(id);
      alert('Incident deleted!');
      fetchIncidents();
    } catch (err) {
      alert('Error deleting incident');
    }
  };

  return (
    <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
      <div className="card-header">
        <h2>Incidents Management</h2>
        <p>Manage and track all wildlife and community incidents.</p>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '20px', borderRadius: '12px', marginTop: '20px' }}>
        <h3 style={{ color: '#e2e8f0', marginBottom: '16px' }}>{editingId ? 'Edit Incident' : 'Report New Incident'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <input required type="text" placeholder="Incident Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} />
          <input required type="text" placeholder="Location" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }} />
          
          <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
            <option style={{color: 'black'}} value="Wildlife Sighting">Wildlife Sighting</option>
            <option style={{color: 'black'}} value="Poaching Activity">Poaching Activity</option>
            <option style={{color: 'black'}} value="Encroachment">Encroachment</option>
            <option style={{color: 'black'}} value="Property Damage">Property Damage</option>
          </select>
          
          <select value={formData.severity} onChange={e => setFormData({...formData, severity: e.target.value})} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
            <option style={{color: 'black'}} value="LOW">Low Severity</option>
            <option style={{color: 'black'}} value="MEDIUM">Medium Severity</option>
            <option style={{color: 'black'}} value="HIGH">High Severity</option>
          </select>

          <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px' }}>
            <option style={{color: 'black'}} value="OPEN">Open</option>
            <option style={{color: 'black'}} value="IN_PROGRESS">In Progress</option>
            <option style={{color: 'black'}} value="RESOLVED">Resolved</option>
          </select>

          <input type="text" placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} style={{ padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', gridColumn: '1 / -1' }} />
          
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '12px' }}>
            <button type="submit" className="submit-btn" disabled={loading} style={{ width: 'auto', background: '#38bdf8', color: '#fff' }}>
              {loading ? 'Saving...' : (editingId ? 'Update Incident' : 'Save Incident')}
            </button>
            {editingId && (
              <button type="button" className="submit-btn" onClick={() => { setEditingId(null); setFormData({ title: '', description: '', category: 'Wildlife Sighting', severity: 'LOW', location: '', status: 'OPEN' }); }} style={{ width: 'auto', background: 'transparent', border: '1px solid #94a3b8', color: '#94a3b8' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div style={{ overflowX: 'auto', marginTop: '30px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: '#e2e8f0' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
              <th style={{ padding: '12px', fontWeight: 500 }}>Title</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Category</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Location</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Severity</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Status</th>
              <th style={{ padding: '12px', fontWeight: 500 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map(inc => (
              <tr key={inc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px' }}>{inc.title}</td>
                <td style={{ padding: '12px' }}>{inc.category}</td>
                <td style={{ padding: '12px' }}>{inc.location}</td>
                <td style={{ padding: '12px', color: inc.severity === 'HIGH' ? '#ef4444' : (inc.severity === 'MEDIUM' ? '#f59e0b' : '#10b981') }}>{inc.severity}</td>
                <td style={{ padding: '12px' }}>{inc.status}</td>
                <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEdit(inc)} style={{ padding: '4px 8px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => handleDelete(inc.id)} style={{ padding: '4px 8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Delete</button>
                </td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr><td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>No incidents recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IncidentsModule;
