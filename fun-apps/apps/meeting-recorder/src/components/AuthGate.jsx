import { useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { auth, provider } from "../firebase";

export default function AuthGate({ children }) {
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) {
    return <div className="screen-center">Loading...</div>;
  }

  if (!user) {
    return (
      <div className="screen-center">
        <div className="auth-card">
          <div className="auth-card__logo">🎙️</div>
          <h1>Meeting Notes AI</h1>
          <p>Record meetings, auto-transcribe, and format into your own templates.</p>
          <button
            className="btn btn--primary"
            onClick={async () => {
              setError("");
              try {
                await signInWithPopup(auth, provider);
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Sign in with Google
          </button>
          {error && <p className="auth-card__error">{error}</p>}
        </div>
      </div>
    );
  }

  return children({ user, signOut: () => signOut(auth) });
}
