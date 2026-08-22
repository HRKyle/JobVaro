import { useState, type FormEvent } from "react";
import {
  signUp,
  login,
  resendVerification,
  type AuthUser,
} from "~/auth/functions";

// After a successful login or signup, route the user to the Welcome/Dashboard
// page. This is the single, immediate post-auth destination (only fires on an
// actual auth action, never on manual navigation). A hard navigation guarantees
// a fresh server-side render so the nav bar and greeting reflect the new session.
function goToWelcome() {
  if (typeof window !== "undefined") {
    window.location.href = "/welcome";
  }
}

// ── Shared props ──────────────────────────────────────────────────────────

interface AuthFormsProps {
  onAuthSuccess: (user: AuthUser) => void;
}

// ── Shared input style ────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500";

function Field({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  iconPath,
  required,
  minLength,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: string;
  iconPath: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
        </svg>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          minLength={minLength}
          className={inputCls}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}

const ErrorBox = ({ error }: { error: string }) =>
  error ? (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </div>
  ) : null;

const SubmitButton = ({
  loading,
  loadingLabel,
  label,
}: {
  loading: boolean;
  loadingLabel: string;
  label: string;
}) => (
  <button
    type="submit"
    disabled={loading}
    className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:shadow-lg hover:shadow-indigo-500/35 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-md"
  >
    {loading && (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    )}
    {loading ? loadingLabel : label}
  </button>
);

// ── Sign Up Form ───────────────────────────────────────────────────────────

function SignUpForm({ onAuthSuccess }: AuthFormsProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  async function handleResend() {
    setResending(true);
    setResendMsg("");
    try {
      const result = await resendVerification({ data: { email: sentTo } });
      setResendMsg(
        result.success
          ? "A new confirmation email is on its way."
          : result.error ?? "Something went wrong. Please try again.",
      );
    } catch {
      setResendMsg("Something went wrong. Please try again.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = await signUp({ data: { email, password, name: name.trim() } });
      if (result.success) {
        if (result.needsVerification) {
          // Account created but not yet verified — ask them to check their inbox.
          setSentTo(result.email);
        } else {
          onAuthSuccess(result.user);
          goToWelcome();
        }
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex w-full flex-col gap-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-5 text-left dark:border-indigo-900 dark:bg-indigo-950/40">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-50">
          Almost there — check your email
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">{sentTo}</span>.
          Click it to verify your email and log in. The link expires in 24 hours.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Didn't get it? Check your spam folder. The link expires in 24 hours —
          if it runs out, use the button below to send a new one.
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {resending ? "Sending…" : "Resend confirmation email"}
        </button>
        {resendMsg && (
          <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">{resendMsg}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <ErrorBox error={error} />
      <Field
        id="signup-name"
        label="Name"
        type="text"
        value={name}
        onChange={setName}
        placeholder="Your name"
        autoComplete="name"
        required
        iconPath="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
      <Field
        id="signup-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        required
        iconPath="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
      <Field
        id="signup-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
        autoComplete="new-password"
        required
        minLength={8}
        iconPath="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
      <SubmitButton loading={loading} loadingLabel="Creating account…" label="Sign up" />
    </form>
  );
}

// ── Login Form ─────────────────────────────────────────────────────────────

function LoginForm({ onAuthSuccess }: AuthFormsProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const result = await login({ data: { email, password } });
      if (result.success) {
        onAuthSuccess(result.user);
        goToWelcome();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <ErrorBox error={error} />
      <Field
        id="login-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        required
        iconPath="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
      <Field
        id="login-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
        autoComplete="current-password"
        required
        minLength={8}
        iconPath="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
      <div className="flex justify-end">
        <a
          href="/forgot-password"
          className="text-sm font-semibold text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          Forgot your password?
        </a>
      </div>
      <SubmitButton loading={loading} loadingLabel="Logging in…" label="Log in" />
    </form>
  );
}

// ── Exported combined component ────────────────────────────────────────────

export function AuthForms({ onAuthSuccess }: AuthFormsProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Tab-style toggle */}
      <div className="grid w-full grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
        {(
          [
            ["signup", "Sign Up"],
            ["login", "Log In"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              mode === key
                ? "bg-white text-indigo-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-700 dark:text-indigo-300 dark:ring-gray-600"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <LoginForm onAuthSuccess={onAuthSuccess} />
      ) : (
        <SignUpForm onAuthSuccess={onAuthSuccess} />
      )}
    </div>
  );
}
