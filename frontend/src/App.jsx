import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/AdminDashboard';
import ParkManagerDashboard from './pages/ParkManagerDashboard';
import CLODashboard from './pages/CLODashboard';
import WildlifeOfficerDashboard from './pages/WildlifeOfficerDashboard';
import UserDashboard from './pages/UserDashboard';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/park-manager" element={<ParkManagerDashboard />} />
        <Route path="/clo" element={<CLODashboard />} />
        <Route path="/wildlife-officer" element={<WildlifeOfficerDashboard />} />
        <Route path="/user" element={<UserDashboard />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
