import { signIn, auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await auth()) redirect('/');
  const params = await searchParams;
  return (
    <main className="login-shell">
      <div className="login-card">
        <div className="brand-mark">R</div>
        <p className="eyebrow">HUMAN JUDGMENT. CLEARER SIGNAL.</p>
        <h1>Welcome to RubricOps.</h1>
        <p className="muted">
          A shared workspace for thoughtful evaluation, consistent rubrics, and
          decisions you can trace.
        </p>
        {params.error && (
          <p role="alert" className="error">
            Sign-in failed. Check your account and password.
          </p>
        )}
        {process.env.DEMO_MODE === 'true' && (
          <form
            action={async (form) => {
              'use server';
              try {
                await signIn('credentials', {
                  email: form.get('email'),
                  password: form.get('password'),
                  redirectTo: '/',
                });
              } catch (e) {
                if (e instanceof AuthError)
                  redirect('/login?error=credentials');
                throw e;
              }
            }}
          >
            <label>
              Workspace account
              <select name="email">
                <option value="admin@rubricops.local">Amara · Admin</option>
                <option value="reviewer@rubricops.local">
                  Noah · Reviewer
                </option>
                <option value="evaluator@rubricops.local">
                  Maya · Evaluator
                </option>
                <option value="evaluator2@rubricops.local">
                  Leo · Evaluator
                </option>
              </select>
            </label>
            <label>
              Demo password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </label>
            <button className="primary">
              Enter workspace <span>↗</span>
            </button>
            <p className="small muted">
              Local demo accounts. Use the password set during setup.
            </p>
          </form>
        )}
        {process.env.AUTH_GITHUB_ID && (
          <form
            action={async () => {
              'use server';
              await signIn('github', { redirectTo: '/' });
            }}
          >
            <button className="primary">Continue with GitHub</button>
          </form>
        )}
        {process.env.DEMO_MODE !== 'true' && !process.env.AUTH_GITHUB_ID && (
          <p role="alert">
            Sign-in is not configured. Set up an authentication provider first.
          </p>
        )}
        <div className="login-foot">
          RubricOps <span>Evaluation Review Platform</span>
        </div>
      </div>
    </main>
  );
}
