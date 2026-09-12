import { useEffect } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import WorkspaceApp from "./pages/WorkspaceApp";
import { useAuth } from "./store/auth";

export default function App() {
  const status = useAuth((s) => s.status);
  const view = useAuth((s) => s.view);
  const go = useAuth((s) => s.go);
  const bootstrap = useAuth((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "loading") {
    return (
      <div className="splash">
        <span className="brand-mark">A</span>
        <p>Connecting to Atlas…</p>
      </div>
    );
  }

  if (status === "authed") {
    return <WorkspaceApp />;
  }

  if (view === "login") {
    return <Login onBack={() => go("landing")} />;
  }

  return <Landing onSignIn={() => go("login")} />;
}
