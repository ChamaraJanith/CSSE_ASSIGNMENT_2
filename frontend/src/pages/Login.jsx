import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // 2. Fetch this user's role from the user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('roles(role_name)')
        .eq('user_id', data.user.id)
        .single();

      console.log('Login Role Check:', { roleData, roleError, userId: data.user.id });

      // If they have no special role, they are just a regular public user!
      if (roleError || !roleData || !roleData.roles?.role_name) {
        console.warn("No special role found, redirecting to /user");
        navigate('/user');
        return; // Stop here, routing is complete
      }

      const role = roleData.roles.role_name;
      console.log('Assigned Role:', role);

      // 3. Route to correct dashboard based on role
      if (role === 'admin') {
        navigate('/admin');
      } else if (role === 'park_manager') {
        navigate('/park-manager');
      } else if (role === 'community_liaison_officer') {
        navigate('/clo');
      } else if (role === 'wildlife_officer') {
        navigate('/wildlife-officer');
      } else {
        navigate('/user'); // Fallback just in case
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-blob-1"></div>
      <div className="login-blob-2"></div>
      
      <div className="login-card">
        <div className="login-header">
          <h1>Welcome back</h1>
          <p>Please enter your details to sign in.</p>
        </div>

        {error && <div style={{ color: '#ef4444', textAlign: 'center', marginBottom: '10px' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" />
              <input 
                type="email" 
                id="email"
                className="form-input" 
                placeholder="Enter your email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input 
                type="password" 
                id="password"
                className="form-input" 
                placeholder="Enter your password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <a href="#" className="forgot-password">Forgot password?</a>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="signup-link">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
