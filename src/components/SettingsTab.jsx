import { signOut, signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../firebase';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.31z"/>
    </svg>
  );
}

export default function SettingsTab({ user }) {
  return (
    <div className="tab-content-scroll">
      {user ? (
        <div className="settings-account">
          <div className="settings-avatar-wrap">
            {user.photoURL
              ? <img src={user.photoURL} alt="avatar" className="settings-avatar" />
              : <div className="settings-avatar-placeholder">{user.displayName?.[0]}</div>
            }
          </div>
          <div className="settings-name">{user.displayName}</div>
          <div className="settings-email">{user.email}</div>
          <button className="settings-signout-btn" onClick={() => signOut(auth)}>
            Sign out
          </button>
        </div>
      ) : (
        <div className="settings-signin-prompt">
          <div className="settings-prompt-icon">🏊</div>
          <h2 className="settings-prompt-title">Sign in to personalize</h2>
          <p className="settings-prompt-desc">
            Save your pool order, hide pools you don't use, and get your schedule your way.
          </p>
          <button className="google-btn" onClick={() => signInWithPopup(auth, provider)}>
            <GoogleIcon />
            Sign in with Google
          </button>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-section-title">Preferences</div>
        <div className="settings-placeholder-row">Pool order</div>
        <div className="settings-placeholder-row">Active pools</div>
      </div>
    </div>
  );
}
