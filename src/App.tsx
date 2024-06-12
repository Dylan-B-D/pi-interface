import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Interface from './pages/FileExplorer';
import LoginPage from './pages/LoginPage';

/**
 * App component.
 * 
 * @returns {JSX.Element} The rendered App component.
 */
const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/interface" element={<Interface />} />
      </Routes>
    </Router>
  );
};

export default App;
