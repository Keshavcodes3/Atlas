import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "../store/auth";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginInput = z.infer<typeof loginSchema>;

interface Props {
  onBack: () => void;
}

export default function Login({ onBack }: Props) {
  const login = useAuth((s) => s.login);
  const serverError = useAuth((s) => s.lastError);
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginInput) => {
    await login(data.email, data.password);
    // success navigates via store (view -> "app")
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-side">
          <button type="button" className="linklike light" onClick={onBack}>
            <ArrowLeft size={15} /> Back to site
          </button>
          <div>
            <p className="pill pill-dark">
              <ShieldCheck size={14} /> workspace access
            </p>
            <h1>Welcome back.</h1>
            <p className="auth-sub">
              Sign in to reach your workspaces, documents and members. Sessions
              use httpOnly cookies with automatic Bearer fallback.
            </p>
          </div>
          <ul className="auth-points">
            <li>Workspace-isolated reads, always</li>
            <li>RBAC enforced before business logic</li>
            <li>Documents: pending → ready, async</li>
          </ul>
        </div>

        <div className="auth-form-pane">
          <div className="auth-form-head">
            <span className="brand-mark sm">A</span>
            <div>
              <strong>Sign in</strong>
              <span>Login only — accounts are provisioned by your admin.</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@team.com"
                {...register("email")}
              />
              {errors.email && (
                <em className="ferr">{errors.email.message}</em>
              )}
            </label>

            <label className="field">
              <span>Password</span>
              <div className="pwrow">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
              {errors.password && (
                <em className="ferr">{errors.password.message}</em>
              )}
            </label>

            {serverError && (
              <p className="server-err" role="alert">
                <KeyRound size={15} /> {serverError}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={17} className="spin" /> Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <p className="auth-note">
              No public sign-up. Need access? Ask a workspace owner to add your
              email as a member.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
