import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthWrapper } from './components/Auth/AuthWrapper';
import { Header } from './components/Layout/Header';
import { Dashboard } from './components/Dashboard/Dashboard';

function App() {
  return (
    <Router>
      <AuthWrapper>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </div>
      </AuthWrapper>
    </Router>
  );
}

export default App;