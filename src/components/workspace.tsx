'use client';
import { useCallback, useEffect, useState } from 'react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Criterion } from '@/lib/validation';
type Evaluation = {
  id: string;
  scores: Record<string, number>;
  rationale: string;
  user: { name: string };
  durationMs: number;
};
type Rubric = {
  id: string;
  name: string;
  version: number;
  criteria: Criterion[];
  publishedAt: string;
};
type Task = {
  id: string;
  externalId: string;
  prompt: string;
  response: string;
  source: string;
  status: string;
  rubric: Rubric;
  evaluations: Evaluation[];
  reviews: {
    id: string;
    decision: string;
    rationale: string;
    scores: Record<string, number>;
    user: { name: string };
  }[];
  lease?: { expiresAt: string };
};
type Snapshot = {
  user: { name: string; role: string; email: string };
  tasks: Task[];
  rubrics: Rubric[];
  events: { id: string; action: string; actorId: string; createdAt: string }[];
  metrics: {
    total: number;
    completed: number;
    paired: number;
    evaluations: number;
    audits: number;
    overturnRate: number | null;
    medianSeconds: number | null;
    criteria: {
      id: string;
      name: string;
      version: number;
      pairs: number;
      kappa: number | null;
      agreement: number | null;
      raters: string[];
    }[];
  };
};
type View =
  | 'Overview'
  | 'Task queue'
  | 'Review inbox'
  | 'Adjudication'
  | 'Rubrics'
  | 'Data & imports'
  | 'Activity';
const icons: Record<View, string> = {
  Overview: '◫',
  'Task queue': '≡',
  'Review inbox': '▣',
  Adjudication: '⇄',
  Rubrics: '▤',
  'Data & imports': '↥',
  Activity: '◷',
};
const statusName: Record<string, string> = {
  OPEN: 'In queue',
  REVIEW: 'Needs review',
  ADJUDICATION: 'Disagreement',
  DONE: 'Completed',
};
const pct = (n: number | null) =>
  n === null ? '—' : `${(n * 100).toFixed(1)}%`;
export default function Workspace({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<Snapshot | null>(null),
    [view, setView] = useState<View>('Overview');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('ALL');
  const refresh = useCallback(async () => {
    const res = await fetch('/api/workspace');
    if (res.status === 401) {
      router.push('/login');
      return;
    }
    const body = await res.json();
    if (!res.ok) throw new Error(body.error);
    setData(body);
  }, [router]);
  useEffect(() => {
    let active = true;
    fetch('/api/workspace')
      .then(async (res) => {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(body.error);
        if (active) setData(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [router]);
  async function act(action: string, payload: unknown = {}) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function claim() {
    const result = await act('claim');
    if (result?.task) setSelected(result.task);
    else if (result)
      setNotice(
        'No tasks are available for you right now. You may have already scored the remaining tasks, or other evaluators hold their leases.',
      );
  }
  if (!data)
    return (
      <main className="loading">
        <div className="brand-mark">R</div>
        <h1>Opening your workspace</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button onClick={() => refresh().catch((e) => setError(e.message))}>
              Try again
            </button>
          </>
        ) : (
          <p>Loading evaluations and rubrics…</p>
        )}
      </main>
    );
  const role = data.user.role,
    admin = role === 'ADMIN',
    evaluator = role === 'EVALUATOR';
  const counts = (status: string) =>
    data.tasks.filter((t) => t.status === status).length;
  const nav: View[] = [
    'Overview',
    ...(evaluator
      ? ['Task queue' as View]
      : ['Task queue' as View, 'Review inbox' as View]),
    ...(admin ? ['Adjudication' as View] : []),
    'Rubrics',
    ...(admin ? ['Data & imports' as View, 'Activity' as View] : []),
  ];
  const filtered = data.tasks.filter(
    (t) =>
      (view !== 'Review inbox' || t.status === 'REVIEW') &&
      (view !== 'Adjudication' || t.status === 'ADJUDICATION') &&
      (filter === 'ALL' || t.status === filter) &&
      `${t.prompt} ${t.externalId} ${t.source}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function navigate(v: View) {
    setView(v);
    setFilter('ALL');
    setSearch('');
    setNotice('');
  }
  const headings: Record<View, [string, string]> = {
    Overview: [
      'Good work starts with shared standards.',
      'Your evaluation pipeline, from first judgment to final decision.',
    ],
    'Task queue': [
      'Every response deserves a closer look.',
      'Two independent evaluations. One consistent rubric.',
    ],
    'Review inbox': [
      'A second look makes the difference.',
      'Audit the sampled evaluations and document your decision.',
    ],
    Adjudication: [
      'Turn disagreement into a decision.',
      'Compare independent scores and record a final judgment.',
    ],
    Rubrics: [
      'Make quality a shared language.',
      'Published versions stay fixed. New tasks can use a new version.',
    ],
    'Data & imports': [
      'Bring your next evaluation into focus.',
      'Import local data exports into a versioned evaluation queue.',
    ],
    Activity: [
      'A record behind every decision.',
      'The latest 30 workflow events, recorded by the server.',
    ],
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">R</span>RubricOps
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-avatar">EW</span>
          <div>
            Evaluation workspace<small>Quality operations</small>
          </div>
          <span>⌄</span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {nav.map((v) => (
            <button
              key={v}
              aria-label={v}
              className={view === v ? 'nav-item active' : 'nav-item'}
              onClick={() => navigate(v)}
            >
              <span className="nav-icon">{icons[v]}</span>
              {v}
              {v === 'Review inbox' && (
                <span className="nav-count">{counts('REVIEW')}</span>
              )}
              {v === 'Adjudication' && (
                <span className="nav-count">{counts('ADJUDICATION')}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quality-note">
            <span>✦</span>
            <strong>Better judgments, together.</strong>
            <p>Small decisions shape better AI. Make each one count.</p>
          </div>
          <div className="user-card">
            <span className="avatar">
              {data.user.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </span>
            <div>
              <strong>{data.user.name}</strong>
              <small>{role.toLowerCase()}</small>
            </div>
            <button
              className="signout"
              aria-label="Sign out"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              ↪
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span className="muted">Workspace</span>
            <span className="breadcrumb">/</span>
            {view}
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            {demo ? 'Local demo' : 'Workspace live'}
            <span className="topbar-divider" />
            <span className="small">{data.user.name.split(' ')[0]}</span>
            <button
              className="avatar small-avatar"
              aria-label="Sign out of workspace"
              onClick={() => signOut({ callbackUrl: '/login' })}
            >
              {data.user.name[0]}
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === 'Overview'
                  ? 'THE QUALITY PICTURE'
                  : view.toUpperCase()}
              </p>
              <h1>{headings[view][0]}</h1>
              <p className="muted">{headings[view][1]}</p>
            </div>
            <div className="heading-actions">
              {evaluator ? (
                <button className="primary" disabled={busy} onClick={claim}>
                  Start evaluating <span>↗</span>
                </button>
              ) : (
                admin && (
                  <button
                    className="primary"
                    onClick={() => navigate('Data & imports')}
                  >
                    ＋ Import tasks
                  </button>
                )
              )}
              <button
                className="icon-button"
                aria-label="Refresh workspace"
                onClick={() => refresh().catch((e) => setError(e.message))}
              >
                ↻
              </button>
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <span>◈</span>
              <div>
                <strong>A workspace you can explore.</strong> Seeded scores and
                durations are synthetic demo data. New decisions are saved to
                your local database.
              </div>
              <span className="pill">SEED 42</span>
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                ×
              </button>
            </div>
          )}
          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}
          {view === 'Overview' && (
            <>
              <section className="stats-grid">
                <Stat
                  label="Tasks in workspace"
                  value={String(data.metrics.total)}
                  detail={`${data.metrics.evaluations} independent evaluations`}
                  icon="▤"
                />
                <Stat
                  label="Ready for review"
                  value={String(counts('REVIEW'))}
                  detail="Sampled quality checks"
                  icon="▣"
                />
                <Stat
                  label="Reviewer overturn rate"
                  value={pct(data.metrics.overturnRate)}
                  detail={`${data.metrics.audits} confirm / overturn decisions`}
                  icon="⇄"
                />
                <Stat
                  label="Median evaluation time"
                  value={
                    data.metrics.medianSeconds === null
                      ? '—'
                      : `${Math.round(data.metrics.medianSeconds)}s`
                  }
                  detail="Across submitted evaluations"
                  icon="◷"
                />
              </section>
              <div className="overview-grid">
                <section className="panel agreement-panel">
                  <PanelTitle
                    title="How well are evaluators aligned?"
                    subtitle="Unweighted Cohen’s κ · by rubric version and evaluator pair"
                  />
                  <div className="chart-legend">
                    <i />
                    Agreement beyond chance
                    <span>{data.metrics.paired} paired tasks</span>
                  </div>
                  <div className="chart-wrap">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={data.metrics.criteria.map((c) => ({
                          ...c,
                          label: `${c.name} · v${c.version}`,
                        }))}
                        margin={{ top: 10, right: 15, left: -24, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 4"
                          vertical={false}
                          stroke="#e6e9e6"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#65716b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[-1, 1]}
                          tick={{ fontSize: 11, fill: '#65716b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: '#f3f6f3' }}
                          labelFormatter={(label, items) =>
                            `${label} · ${(items[0]?.payload?.raters ?? []).join(' / ')}`
                          }
                        />
                        <Bar
                          dataKey="kappa"
                          name="Cohen’s κ"
                          isAnimationActive={false}
                          fill="#47775e"
                          radius={[5, 5, 0, 0]}
                          maxBarSize={56}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="metric-details">
                    {data.metrics.criteria.map((c) => (
                      <div key={c.id}>
                        <strong>
                          {c.name} <small>v{c.version}</small>
                        </strong>
                        <span>
                          κ{' '}
                          {c.kappa === null ? 'undefined' : c.kappa.toFixed(3)}
                        </span>
                        <small>
                          {c.raters.length
                            ? c.raters.join(' / ')
                            : 'No paired evaluators'}
                        </small>
                        <small>
                          {c.pairs} pairs · {pct(c.agreement)} exact agreement
                        </small>
                      </div>
                    ))}
                  </div>
                  <p className="panel-foot">
                    κ is undefined without paired scores or when expected
                    agreement is 100%.
                  </p>
                </section>
                <section className="panel pipeline-panel">
                  <PanelTitle
                    title="Keep the work moving"
                    subtitle="A clear path from response to resolution"
                  />
                  <div className="pipeline">
                    {['OPEN', 'REVIEW', 'ADJUDICATION', 'DONE'].map((s, i) => (
                      <button
                        key={s}
                        onClick={() => {
                          navigate(
                            s === 'REVIEW' && !evaluator
                              ? 'Review inbox'
                              : s === 'ADJUDICATION' && admin
                                ? 'Adjudication'
                                : 'Task queue',
                          );
                          setFilter(s);
                        }}
                      >
                        <span className={`step step-${i}`}>{i + 1}</span>
                        <div>
                          <strong>{statusName[s]}</strong>
                          <small>
                            {
                              [
                                'Independent scoring',
                                'Reviewer quality check',
                                'Final judgment needed',
                                'Ready for reporting',
                              ][i]
                            }
                          </small>
                        </div>
                        <b>{counts(s)}</b>
                        <span className="muted">↗</span>
                      </button>
                    ))}
                  </div>
                  <div className="completion">
                    <div>
                      <span>Completion</span>
                      <strong>
                        {pct(
                          rateLocal(data.metrics.completed, data.metrics.total),
                        )}
                      </strong>
                    </div>
                    <progress
                      value={data.metrics.completed}
                      max={data.metrics.total || 1}
                    />
                    <p>
                      {data.metrics.completed} of {data.metrics.total} tasks
                      resolved
                    </p>
                  </div>
                </section>
              </div>
              <section className="panel">
                <PanelTitle
                  title="On the review desk"
                  subtitle="Responses awaiting a closer look"
                  action={
                    <button
                      className="text-button"
                      onClick={() =>
                        navigate(evaluator ? 'Task queue' : 'Review inbox')
                      }
                    >
                      View queue ↗
                    </button>
                  }
                />
                <TaskTable
                  tasks={data.tasks
                    .filter((t) =>
                      ['REVIEW', 'ADJUDICATION'].includes(t.status),
                    )
                    .slice(0, 5)}
                  open={setSelected}
                />
              </section>
            </>
          )}
          {['Task queue', 'Review inbox', 'Adjudication'].includes(view) && (
            <section className="panel">
              <div className="table-tools">
                <div>
                  <h2>{view}</h2>
                  <p className="muted small">
                    {filtered.length} tasks · scores remain hidden from
                    evaluators
                  </p>
                </div>
                <div className="filters">
                  <input
                    aria-label="Search tasks"
                    placeholder="Search tasks or sources…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {view === 'Task queue' && (
                    <select
                      aria-label="Filter status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="ALL">All statuses</option>
                      {Object.entries(statusName).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <TaskTable tasks={filtered} open={setSelected} />
            </section>
          )}
          {view === 'Rubrics' && (
            <div className="rubric-layout">
              <div>
                {data.rubrics.map((r) => (
                  <section className="panel rubric-card" key={r.id}>
                    <div className="rubric-heading">
                      <div>
                        <p className="eyebrow">
                          PUBLISHED · VERSION {r.version}
                        </p>
                        <h2>{r.name}</h2>
                      </div>
                      <span className="badge DONE">Immutable</span>
                    </div>
                    {r.criteria.map((c, i) => (
                      <div className="criterion" key={c.id}>
                        <span className="criterion-number">0{i + 1}</span>
                        <div>
                          <h3>{c.name}</h3>
                          <p>{c.description}</p>
                          <span className="scale-note">
                            Score from 1 (lowest) to 5 (highest)
                          </span>
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              {admin && (
                <RubricForm
                  busy={busy}
                  submit={async (payload) => {
                    const result = await act('publish', payload);
                    if (result)
                      setNotice(
                        `Rubric v${result.version} published. Existing tasks retain their original version.`,
                      );
                    return !!result;
                  }}
                />
              )}
            </div>
          )}
          {view === 'Data & imports' && admin && (
            <ImportForm
              rubrics={data.rubrics}
              busy={busy}
              submit={async (payload) => {
                const result = await act('import', payload);
                if (result)
                  setNotice(
                    `${result.count} tasks imported into the evaluation queue.`,
                  );
                return !!result;
              }}
            />
          )}
          {view === 'Activity' && (
            <section className="panel">
              <PanelTitle
                title="Workflow activity"
                subtitle="Claims, submissions, imports, and rubric publications"
              />
              {data.events.length ? (
                data.events.map((e) => (
                  <div className="event" key={e.id}>
                    <span className="event-dot" />
                    <div>
                      <strong>
                        {e.action.toLowerCase().replaceAll('_', ' ')}
                      </strong>
                      <p>{e.actorId}</p>
                    </div>
                    <time>{new Date(e.createdAt).toLocaleString()}</time>
                  </div>
                ))
              ) : (
                <div className="empty">
                  No workflow events yet. Try importing or evaluating a task.
                </div>
              )}
            </section>
          )}
          <footer className="page-footer">
            <span>
              RubricOps{' '}
              <span className="muted">
                / Thoughtful evaluation, traceable decisions.
              </span>
            </span>
            <button
              className="text-button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(data.metrics, null, 2)], {
                  type: 'application/json',
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'rubricops-metrics.json';
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export metrics ↓
            </button>
          </footer>
        </main>
      </div>
      {selected && (
        <TaskDialog
          task={selected}
          role={role}
          busy={busy}
          error={error}
          close={() => {
            setSelected(null);
            setError('');
          }}
          submit={async (action, payload) => {
            const result = await act(action, payload);
            if (result) {
              setSelected(null);
              setNotice(
                action === 'release'
                  ? 'Task released.'
                  : 'Decision saved. Thank you for the careful review.',
              );
            }
          }}
        />
      )}
    </div>
  );
}
function rateLocal(a: number, b: number) {
  return b ? a / b : null;
}
function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <article className="stat">
      <div>
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
function PanelTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel-title">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function TaskTable({
  tasks,
  open,
}: {
  tasks: Task[];
  open: (t: Task) => void;
}) {
  return tasks.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Task / prompt</th>
            <th>Source</th>
            <th>Rubric</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <button className="task-link" onClick={() => open(t)}>
                  <small>{t.externalId}</small>
                  <strong>{t.prompt}</strong>
                </button>
              </td>
              <td>
                <span className="source-label">{t.source}</span>
              </td>
              <td>
                <span className="version">v{t.rubric.version}</span>
              </td>
              <td>
                <span className={`badge ${t.status}`}>
                  {statusName[t.status]}
                </span>
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Open ${t.externalId}`}
                  onClick={() => open(t)}
                >
                  ↗
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty">
      <span>✓</span>
      <h3>Nothing here right now</h3>
      <p>Change your filters or check back when new tasks arrive.</p>
    </div>
  );
}
function TaskDialog({
  task,
  role,
  busy,
  error,
  close,
  submit,
}: {
  task: Task;
  role: string;
  busy: boolean;
  error: string;
  close: () => void;
  submit: (action: string, payload: unknown) => Promise<void>;
}) {
  const evaluate = role === 'EVALUATOR' && !!task.lease;
  const review =
    (role === 'ADMIN' && ['REVIEW', 'ADJUDICATION'].includes(task.status)) ||
    (role === 'REVIEWER' && task.status === 'REVIEW');
  const [scores, setScores] = useState<Record<string, number>>(
      evaluate ? {} : (task.evaluations[0]?.scores ?? {}),
    ),
    [rationale, setRationale] = useState('');
  const [decision, setDecision] = useState(
    task.status === 'ADJUDICATION' ? 'RESOLVE' : 'CONFIRM',
  );
  const [secondsLeft, setSecondsLeft] = useState(() =>
    task.lease
      ? Math.max(
          0,
          Math.floor((Date.parse(task.lease.expiresAt) - Date.now()) / 1000),
        )
      : 0,
  );
  useEffect(() => {
    if (!task.lease) return;
    const timer = setInterval(
      () =>
        setSecondsLeft(
          Math.max(
            0,
            Math.floor((Date.parse(task.lease!.expiresAt) - Date.now()) / 1000),
          ),
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [task.lease]);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <div className="modal-backdrop">
      <section
        className="task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
        ref={(el) => {
          if (el && !el.contains(document.activeElement)) el.focus();
        }}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
          if (e.key === 'Tab') {
            const items = e.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input, textarea, select, [tabindex="0"]',
            );
            const first = items[0],
              last = items[items.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === e.currentTarget)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <header>
          <div>
            <p className="eyebrow">
              {task.externalId} · RUBRIC V{task.rubric.version}
            </p>
            <h2 id="task-title">
              {evaluate
                ? 'Your independent evaluation'
                : review
                  ? 'Review the evidence'
                  : 'Task details'}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close task"
            onClick={close}
          >
            ×
          </button>
        </header>
        <div className="dialog-body">
          <div className="task-evidence">
            <p className="eyebrow">PROMPT</p>
            <div className="prompt-block">{task.prompt}</div>
            <p className="eyebrow">MODEL RESPONSE</p>
            <div className="response-block">{task.response}</div>
            {task.evaluations.map((e) => (
              <div className="evaluation-block" key={e.id}>
                <h3>{e.user.name}</h3>
                <div className="score-chips">
                  {Object.entries(e.scores).map(([k, v]) => (
                    <span key={k}>
                      {k} <b>{v}/5</b>
                    </span>
                  ))}
                </div>
                <p>{e.rationale}</p>
                <small className="muted">
                  {Math.round(e.durationMs / 1000)} seconds
                </small>
              </div>
            ))}
            {task.reviews.map((r) => (
              <div className="evaluation-block" key={r.id}>
                <h3>
                  {r.decision} · {r.user.name}
                </h3>
                <p>{r.rationale}</p>
                <div className="score-chips">
                  {Object.entries(r.scores).map(([k, v]) => (
                    <span key={k}>
                      {k} <b>{v}/5</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="scoring-panel">
            {evaluate || review ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(evaluate ? 'evaluate' : 'review', {
                    taskId: task.id,
                    scores,
                    rationale,
                    decision,
                  });
                }}
              >
                <h3>
                  {evaluate ? 'Score this response' : 'Record your decision'}
                </h3>
                {evaluate && (
                  <p className="lease">
                    Lease remaining: {Math.floor(secondsLeft / 60)}:
                    {String(secondsLeft % 60).padStart(2, '0')}
                  </p>
                )}
                {task.rubric.criteria.map((c) => (
                  <fieldset key={c.id}>
                    <legend>{c.name}</legend>
                    <p>{c.description}</p>
                    <div className="score-options">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <label
                          className={scores[c.id] === n ? 'chosen' : ''}
                          key={n}
                        >
                          <input
                            type="radio"
                            name={c.id}
                            value={n}
                            required
                            checked={scores[c.id] === n}
                            onChange={() => setScores({ ...scores, [c.id]: n })}
                          />
                          {n}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                {review && task.status !== 'ADJUDICATION' && (
                  <label>
                    Decision
                    <select
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    >
                      <option value="CONFIRM">Confirm original scores</option>
                      <option value="OVERTURN">Overturn scores</option>
                      <option value="ESCALATE">Escalate to adjudication</option>
                    </select>
                  </label>
                )}
                <label>
                  Rationale
                  <textarea
                    required
                    minLength={12}
                    maxLength={4000}
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder="Explain the evidence behind your scores…"
                    rows={4}
                  />
                </label>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="primary full"
                  disabled={busy || (evaluate && secondsLeft === 0)}
                >
                  {busy
                    ? 'Saving…'
                    : evaluate
                      ? 'Submit evaluation'
                      : 'Save decision'}{' '}
                  <span>↗</span>
                </button>
                {evaluate && (
                  <button
                    className="text-button full"
                    type="button"
                    disabled={busy}
                    onClick={() => submit('release', { taskId: task.id })}
                  >
                    Release task
                  </button>
                )}
              </form>
            ) : (
              <>
                <h3>{task.rubric.name}</h3>
                {task.rubric.criteria.map((c) => (
                  <div className="read-criterion" key={c.id}>
                    <strong>{c.name}</strong>
                    <p>{c.description}</p>
                  </div>
                ))}
                {role === 'EVALUATOR' && (
                  <p className="notice">
                    Use “Start evaluating” to claim an available task. Other
                    evaluators’ scores remain hidden.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
function RubricForm({
  busy,
  submit,
}: {
  busy: boolean;
  submit: (p: unknown) => Promise<boolean>;
}) {
  const [name, setName] = useState(''),
    [criteria, setCriteria] = useState([
      { id: 'accuracy', name: 'Accuracy', description: '' },
    ]);
  return (
    <section className="panel form-panel">
      <h2>Publish a new version</h2>
      <p className="muted small">
        Existing versions and assigned tasks remain unchanged. Each criterion
        uses a 1–5 scale.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await submit({ name, criteria })) setName('');
        }}
      >
        <label>
          Rubric name
          <input
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. General response quality"
          />
        </label>
        {criteria.map((c, i) => (
          <div className="criterion-editor" key={i}>
            <label>
              Criterion ID
              <input
                required
                pattern="[a-z][a-z0-9_]{0,39}"
                value={c.id}
                onChange={(e) =>
                  setCriteria(
                    criteria.map((x, j) =>
                      j === i ? { ...x, id: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Display name
              <input
                required
                maxLength={80}
                value={c.name}
                onChange={(e) =>
                  setCriteria(
                    criteria.map((x, j) =>
                      j === i ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Scoring guidance
              <textarea
                required
                maxLength={600}
                value={c.description}
                onChange={(e) =>
                  setCriteria(
                    criteria.map((x, j) =>
                      j === i ? { ...x, description: e.target.value } : x,
                    ),
                  )
                }
                placeholder="Describe what low, middle, and high scores mean."
              />
            </label>
            {criteria.length > 1 && (
              <button
                type="button"
                className="text-button"
                onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}
              >
                Remove criterion
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="secondary full"
          disabled={criteria.length >= 12}
          onClick={() =>
            setCriteria([...criteria, { id: '', name: '', description: '' }])
          }
        >
          ＋ Add criterion
        </button>
        <button className="primary full" disabled={busy}>
          Publish immutable version ↗
        </button>
      </form>
    </section>
  );
}
function ImportForm({
  rubrics,
  busy,
  submit,
}: {
  rubrics: Rubric[];
  busy: boolean;
  submit: (p: unknown) => Promise<boolean>;
}) {
  const [format, setFormat] = useState('normalized'),
    [rubricId, setRubricId] = useState(rubrics[0]?.id ?? ''),
    [content, setContent] = useState(''),
    [error, setError] = useState('');
  return (
    <div className="import-layout">
      <section className="panel form-panel">
        <h2>Import a task batch</h2>
        <p className="muted">JSON array · up to 500 records · 2 MB maximum</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            try {
              const rows = JSON.parse(content);
              if (await submit({ format, rubricId, rows })) setContent('');
            } catch {
              setError('Enter a valid JSON array.');
            }
          }}
        >
          <div className="form-row">
            <label>
              Data format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option value="normalized">Normalized tasks</option>
                <option value="hh">HH-RLHF export</option>
                <option value="arena">Chatbot Arena export</option>
              </select>
            </label>
            <label>
              Assigned rubric
              <select
                required
                value={rubricId}
                onChange={(e) => setRubricId(e.target.value)}
              >
                {rubrics.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} · v{r.version}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="file-drop">
            ↑ Choose a JSON file
            <input
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2_000_000) {
                  setError('File exceeds 2 MB.');
                  return;
                }
                setContent(await file.text());
                setError('');
              }}
            />
          </label>
          <label>
            Or paste JSON
            <textarea
              className="code-input"
              required
              rows={12}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                '[\n  {\n    "externalId": "task-001",\n    "prompt": "What is a rubric?",\n    "response": "A scoring guide.",\n    "source": "my-dataset"\n  }\n]'
              }
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !rubricId}>
            Validate & import ↗
          </button>
        </form>
      </section>
      <section className="panel import-guide">
        <span className="guide-icon">↥</span>
        <h2>Start with clean records.</h2>
        <p>
          Each task needs a stable external ID, a prompt, a response, and a
          source. Duplicate IDs are rejected; a batch is imported only when
          every record is valid.
        </p>
        <h3>Dataset exports</h3>
        <p>
          <strong>HH-RLHF:</strong> supply an <code>id</code> and{' '}
          <code>chosen</code> transcript. The final assistant turn becomes the
          response.
        </p>
        <p>
          <strong>Arena:</strong> supply <code>question_id</code> and{' '}
          <code>conversation_a</code>. The first assistant turn becomes the
          response.
        </p>
        <h3>Review sampling</h3>
        <p>
          A deterministic 25% hash-based sample is selected for review. Any
          score disagreement is sent to adjudication, whether sampled or not.
        </p>
        <p className="small muted">
          Local imports do not download data or contact Hugging Face. Included
          fixtures are synthetic.
        </p>
      </section>
    </div>
  );
}
