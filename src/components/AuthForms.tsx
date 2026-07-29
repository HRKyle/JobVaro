import { useState, type FormEvent } from "react";
import { signUp, login, type AuthUser } from "~/auth/functions";

// ── Shared props ──────────────────────────────────────────────────────────

interface AuthFormsProps {
  onAuthSuccess: (user: AuthUser) => void;
}

// ── Sign Up Form ───────────────────────────────────────────────────────────

function SignUpForm({ onAuthSuccess }: AuthFormsProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
        onAuthSuccess(result.user);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold">Create your account</h2>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-name" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Name
        </label>
        <input
          id="signup-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="Your name"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="signup-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="At least 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating account…" : "Sign up"}
      </button>
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm">
      <h2 className="text-xl font-semibold">Welcome back</h2>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="login-email" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="you@example.com"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="login-password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          minLength={8}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          placeholder="At least 8 characters"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

// ── Exported combined component ────────────────────────────────────────────

export function AuthForms({ onAuthSuccess }: AuthFormsProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");

  return (
    <div className="flex flex-col items-center gap-6">
      {mode === "login" ? (
        <LoginForm onAuthSuccess={onAuthSuccess} />
      ) : (
        <SignUpForm onAuthSuccess={onAuthSuccess} />
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("login")}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
            >
              Log in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
