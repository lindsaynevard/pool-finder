import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import SignIn from './components/SignIn';
import Schedule from './components/Schedule';
import './App.css';

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u ?? null));
  }, []);

  if (user === undefined) {
    return <div className="loading">Loading…</div>;
  }

  return user ? <Schedule user={user} /> : <SignIn />;
}
