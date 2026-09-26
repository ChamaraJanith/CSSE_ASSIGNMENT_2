import React, { useState } from 'react';
import { Mail, Lock, Phone, Hash, MapPin, UserPlus } from 'lucide-react';
import './Login.css'; // Reusing the beautiful green glassmorphism styles

export default function ParkManagerDashboard() {
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

  const handleAddOfficer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // We will send this to our backend endpoint to securely create the user
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
    <div className="login-container" style={{ alignItems: 'flex-start', paddingTop: '50px' }}>
      <div className="login-blob-1"></div>
      <div className="login-blob-2"></div>
      
      <div className="login-card" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="login-header">
          <h1 style={{ color: '#34d399' }}>Park Manager Dashboard</h1>
          <p>Register a new Wildlife Officer to the system.</p>
        </div>

        {message && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            textAlign: 'center', 
            marginBottom: '20px',
            background: message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
            color: message.type === 'error' ? '#fca5a5' : '#6ee7b7',
            border: `1px solid ${message.type === 'error' ? '#ef4444' : '#10b981'}`
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAddOfficer} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', gap: '20px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <Mail className="input-icon" />
                <input type="email" id="email" className="form-input" placeholder="officer@wildguard.com" value={formData.email} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="password">Temporary Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" />
                <input type="text" id="password" className="form-input" placeholder="Set password" value={formData.password} onChange={handleChange} required minLength="6" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="mobileNumber">Mobile Number</label>
              <div className="input-wrapper">
                <Phone className="input-icon" />
                <input type="tel" id="mobileNumber" className="form-input" placeholder="+94 77 123 4567" value={formData.mobileNumber} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-group" style={{ width: '120px' }}>
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

          <button type="submit" className="submit-btn" disabled={loading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
            <UserPlus size={20} />
            {loading ? 'Registering Officer...' : 'Add Wildlife Officer'}
          </button>
        </form>
      </div>
    </div>
  );
}
