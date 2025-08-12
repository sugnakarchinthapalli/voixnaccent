import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthWrapper } from './components/Auth/AuthWrapper';
import { Header } from './components/Layout/Header';
import { Dashboard } from './components/Dashboard/Dashboard';
import { BasicVideoRecorder } from './components/BasicVideoRecorder';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public route for basic video recorder - NO AuthWrapper */}
        <Route path="/recorder" element={<BasicVideoRecorder />} />
        
        {/* Protected routes for internal users - WITH AuthWrapper */}
        <Route path="/*" element={
          <AuthWrapper>
            <div className="min-h-screen bg-gray-50">
              <Header />
              <Routes>
                <Route path="/" element={<Dashboard />} />
              </Routes>
            </div>
          </AuthWrapper>
        } />
      </Routes>
    </Router>
  );
}

export default App;