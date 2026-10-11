import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Home, Activity } from 'lucide-react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link to="/" className="logo">
          <Activity className="logo-icon" size={28} strokeWidth={2.5} />
          <span className="logo-text">CORVEX</span>
        </Link>

        <div className="header-actions">
          {location.pathname !== '/' && (
            <button className="header-btn" onClick={() => navigate('/')}>
              <Home size={16} />
              Home
            </button>
          )}
          <button className="header-btn" onClick={() => navigate('/search')}>
            <Search size={16} />
            Search Patient
          </button>
        </div>
      </div>
    </header>
  );
}
