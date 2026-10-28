import { useState, useEffect, useRef } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/AuthContext.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';

export default function NavBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close menus on route change
  useEffect(() => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle click outside profile dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onLogout = async () => {
    setDropdownOpen(false);
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  // Unauthenticated navbar
  if (!user) {
    return (
      <header className="navbar-header">
        <div className="navbar-container flex-between align-center">
          <Link to="/" className="brand-logo flex-align gap-2">
            <span className="brand-icon">✓</span>
            <span className="brand-name">VoteForge</span>
          </Link>
          <div className="nav-actions flex-align gap-3">
            <button
              className="icon-btn theme-toggle-btn"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <Link to="/login" className="btn btn-sm btn-primary">
              Sign in
            </Link>
          </div>
        </div>
      </header>
    );
  }

  const initials = user.name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Primary navigation tabs
  const centerTabs = [
    { to: '/', label: 'Elections', icon: '🗳️', end: true },
    { to: '/results', label: 'Live Results', icon: '📊', end: false },
    { to: '/my-votes', label: 'My Votes', icon: '🧾', end: false },
    ...(user.role === 'admin'
      ? [
          {
            to: '/admin/security',
            label: 'Security Copilot',
            icon: '🛡️',
            isSecurity: true,
            end: false,
          },
        ]
      : []),
  ];

  return (
    <header className="navbar-header">
      <div className="navbar-container flex-between align-center">
        {/* LEFT: Branding Logo */}
        <div className="flex-align gap-3">
          <Link to="/" className="brand-logo flex-align gap-2">
            <span className="brand-icon">✓</span>
            <span className="brand-name">VoteForge</span>
          </Link>
        </div>

        {/* CENTER: Primary Navigation Links (Desktop) */}
        <nav className="desktop-nav-links flex-align gap-1">
          {centerTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `nav-item-link ${tab.isSecurity ? 'security-nav-item' : ''} ${
                  isActive ? 'active' : ''
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="activeNavPill"
                      className="nav-active-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="nav-item-content flex-align gap-2">
                    <span className="nav-icon">{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.isSecurity && (
                      <span className="security-ai-dot" title="AI Security Engine Active">
                        ● AI Online
                      </span>
                    )}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* RIGHT: Quick Controls & Profile Dropdown */}
        <div className="nav-actions flex-align gap-3">
          {/* Theme Toggle Button */}
          <button
            className="icon-btn theme-toggle-btn"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* User Profile Dropdown Trigger */}
          <div className="profile-dropdown-container" ref={dropdownRef}>
            <button
              className={`profile-trigger-btn flex-align gap-2 ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
              aria-label="User account menu"
            >
              <span className="avatar-circle">{initials}</span>
              <span className="user-meta-info flex-align gap-2">
                <span className="user-display-name">{user.name}</span>
                <span className={`role-badge ${user.role === 'admin' ? 'role-admin' : 'role-student'}`}>
                  {user.role === 'admin' ? 'Admin' : 'Student'}
                </span>
              </span>
              <span className="dropdown-caret">▼</span>
            </button>

            {/* Profile Dropdown Menu */}
            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="profile-dropdown-menu"
                  role="menu"
                >
                  <div className="dropdown-user-header p-3">
                    <div className="flex-align gap-3">
                      <span className="avatar-circle lg">{initials}</span>
                      <div className="user-details">
                        <div className="user-name-bold">{user.name}</div>
                        <div className="user-sub-id">ID: {user.studentId}</div>
                      </div>
                    </div>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="dropdown-menu-items">
                    <Link to="/profile" className="dropdown-item flex-align gap-2" role="menuitem">
                      <span>👤</span> My Profile
                    </Link>

                    {user.role === 'admin' && (
                      <>
                        <Link to="/admin/security" className="dropdown-item flex-align gap-2" role="menuitem">
                          <span>🛡️</span> Security Copilot
                        </Link>
                        <Link to="/admin" className="dropdown-item flex-align gap-2" role="menuitem">
                          <span>⚙️</span> Admin Console
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="dropdown-divider" />

                  <button className="dropdown-item logout-item flex-align gap-2" onClick={onLogout} role="menuitem">
                    <span>🚪</span> Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mobile-nav-drawer"
          >
            <div className="mobile-nav-inner p-4 space-y-2">
              <div className="mobile-user-card flex-align gap-3 p-3 rounded">
                <span className="avatar-circle">{initials}</span>
                <div>
                  <div className="font-semibold">{user.name}</div>
                  <div className="text-xs text-muted">ID: {user.studentId}</div>
                </div>
              </div>

              <div className="dropdown-divider" />

              {centerTabs.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `mobile-nav-link flex-between align-center ${isActive ? 'active' : ''}`
                  }
                >
                  <span className="flex-align gap-2">
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </span>
                  {tab.isSecurity && <span className="badge badge-sm badge-admin">Shield</span>}
                </NavLink>
              ))}

              {user.role === 'admin' && (
                <NavLink to="/admin" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
                  <span className="flex-align gap-2">
                    <span>⚙️</span>
                    <span>Admin Console</span>
                  </span>
                </NavLink>
              )}

              <NavLink to="/profile" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
                <span className="flex-align gap-2">
                  <span>👤</span>
                  <span>My Profile</span>
                </span>
              </NavLink>

              <div className="dropdown-divider" />

              <div className="flex-between align-center pt-2">
                <button className="btn btn-sm btn-ghost" onClick={toggle}>
                  {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
                <button className="btn btn-sm btn-outline-danger" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
