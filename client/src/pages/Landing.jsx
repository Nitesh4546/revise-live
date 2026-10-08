import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Button from '../components/ui/Button.jsx';
import Bar from '../components/ui/Bar.jsx';
import { ArrowRight, CheckCircle2, FileText, RefreshCw, BarChart2, ShieldCheck } from 'lucide-react';

export default function Landing() {
  const [pin, setPin] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    const cleanPin = pin.trim().replace(/\s+/g, '');
    if (cleanPin.length >= 4) {
      navigate(`/join?pin=${cleanPin}`);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col font-sans selection:bg-accent selection:text-white transition-colors">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full bg-surface/95 backdrop-blur-xs border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded-[var(--radius-sm,4px)]">
            <svg
              className="w-7 h-7 text-accent shrink-0"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="6" fill="var(--accent)" />
              <rect x="7" y="7" width="18" height="18" rx="2" stroke="var(--accent-text)" strokeWidth="2" />
              <path d="M11 12h10M11 16h10M11 20h6" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-lg tracking-tight text-text">ReviseLive</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted" aria-label="Site Navigation">
            <a href="#how-it-works" className="hover:text-text transition-colors">How it works</a>
            <a href="#features" className="hover:text-text transition-colors">Features</a>
            <a href="#students" className="hover:text-text transition-colors">For students</a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Button variant="primary" size="sm" onClick={() => navigate('/host')}>
                Go to Dashboard
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-xs sm:text-sm font-medium text-text hover:bg-surface-hover rounded-[var(--radius-sm,4px)] transition-colors"
                >
                  Sign in
                </Link>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                  Create account
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 py-14 sm:py-20 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headline, Copy, Action & Fast Join */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-sm,4px)] bg-bg-subtle border border-border text-xs font-semibold text-text-muted mb-6">
              <span>Diagnostic Classroom Revision</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-semibold tracking-tight text-text leading-[1.12] mb-5 max-w-2xl">
              Find out what your class didn't understand.
            </h1>

            <p className="text-base sm:text-lg text-text-muted mb-8 leading-relaxed max-w-[620px]">
              Turn your notes or a PDF into a live quiz, then see exactly which ideas students got wrong. Diagnostic misconception analytics help you reteach before moving on.
            </p>

            {/* Primary Actions & Join Bar */}
            <div className="w-full max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate(user ? '/host' : '/register')}
                className="w-full sm:w-auto"
              >
                <span>Create a quiz</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full sm:w-auto"
              >
                See how it works
              </Button>
            </div>

            {/* Direct Student PIN Entry Card */}
            <div className="w-full max-w-xl p-4 rounded-[var(--radius-md,8px)] bg-surface border border-border shadow-[var(--shadow-card)]">
              <form onSubmit={handleJoin} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <div className="flex-1">
                  <label htmlFor="hero-pin-input" className="sr-only">
                    Game PIN
                  </label>
                  <input
                    id="hero-pin-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter 6-digit game PIN"
                    className="w-full h-10 px-3.5 bg-bg-subtle text-text border border-border rounded-[var(--radius-sm,4px)] text-sm tracking-wider placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={pin.length < 4}
                  className="shrink-0"
                >
                  Join game
                </Button>
              </form>
              <p className="text-xs text-text-muted mt-2">
                Students join instantly with no login or account creation required.
              </p>
            </div>
          </div>

          {/* Right Column: Real UI Question Visual */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)] p-5 sm:p-6">
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-[var(--radius-sm,4px)] bg-bg-subtle text-text-muted border border-border">
                    Question 3 of 5
                  </span>
                  <span className="text-xs text-text-muted">Physics</span>
                </div>
                <span className="text-xs font-semibold text-accent">14s remaining</span>
              </div>

              <h2 className="text-base sm:text-lg font-semibold text-text mb-4 leading-snug">
                Which statement best describes Newton's Third Law of Motion?
              </h2>

              {/* 4 Lettered Option Tiles (Okabe-Ito functional colors) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                <div className="p-3 rounded-[var(--radius-sm,4px)] bg-tile-a text-white text-xs font-medium flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    A
                  </span>
                  <span className="truncate">Equal and opposite force pair</span>
                </div>
                <div className="p-3 rounded-[var(--radius-sm,4px)] bg-tile-b text-tile-b-text text-xs font-medium flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center font-bold text-xs">
                    B
                  </span>
                  <span className="truncate">Force equals mass times acceleration</span>
                </div>
                <div className="p-3 rounded-[var(--radius-sm,4px)] bg-tile-c text-tile-c-text text-xs font-medium flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-black/10 flex items-center justify-center font-bold text-xs">
                    C
                  </span>
                  <span className="truncate">Objects in motion stay in motion</span>
                </div>
                <div className="p-3 rounded-[var(--radius-sm,4px)] bg-tile-d text-white text-xs font-medium flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    D
                  </span>
                  <span className="truncate">Action force cancels out reaction</span>
                </div>
              </div>

              {/* Live Answer Distribution Bar */}
              <div className="p-3.5 rounded-[var(--radius-sm,4px)] bg-bg-subtle border border-border">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-text">Class Live Distribution</span>
                  <span className="text-text-muted">28 of 30 answered</span>
                </div>
                <div className="h-3 w-full bg-surface border border-border rounded-full overflow-hidden flex">
                  <div style={{ width: '68%' }} className="bg-tile-a" title="Option A (68%)" />
                  <div style={{ width: '14%' }} className="bg-tile-b" title="Option B (14%)" />
                  <div style={{ width: '11%' }} className="bg-tile-c" title="Option C (11%)" />
                  <div style={{ width: '7%' }} className="bg-tile-d" title="Option D (7%)" />
                </div>
                <p className="text-[11px] text-text-muted mt-2">
                  Detected Misconception: Confusing Newton's 1st and 3rd laws (25% of class).
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-16 sm:py-24 bg-bg-subtle border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text mb-3">
              How ReviseLive works
            </h2>
            <p className="text-sm sm:text-base text-text-muted">
              A straightforward diagnostic cycle designed for everyday classroom teaching.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-[var(--radius-md,8px)] bg-surface border border-border flex flex-col">
              <span className="text-xs font-bold text-accent mb-2">STEP 1</span>
              <h3 className="text-lg font-semibold text-text mb-2">
                Create from your notes or PDF
              </h3>
              <p className="text-sm text-text-muted mb-6 leading-relaxed">
                Paste lecture summaries or drop lecture slides. ReviseLive generates diagnostic questions with identified misconceptions.
              </p>
              <div className="mt-auto p-3 bg-bg-subtle rounded-[var(--radius-sm,4px)] border border-border text-xs">
                <div className="flex items-center gap-2 mb-2 font-semibold text-text">
                  <FileText className="w-3.5 h-3.5 text-accent" />
                  <span>lecture_notes_ch4.pdf</span>
                </div>
                <span className="text-text-muted">5 diagnostic questions extracted</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-[var(--radius-md,8px)] bg-surface border border-border flex flex-col">
              <span className="text-xs font-bold text-accent mb-2">STEP 2</span>
              <h3 className="text-lg font-semibold text-text mb-2">
                Host it live
              </h3>
              <p className="text-sm text-text-muted mb-6 leading-relaxed">
                Project the room code. Students join from phones or laptops in seconds without downloading an app or making accounts.
              </p>
              <div className="mt-auto p-3 bg-bg-subtle rounded-[var(--radius-sm,4px)] border border-border text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-text">Room PIN</span>
                  <span className="font-mono font-bold text-accent tracking-widest">482 109</span>
                </div>
                <span className="text-text-muted">32 students connected</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-[var(--radius-md,8px)] bg-surface border border-border flex flex-col">
              <span className="text-xs font-bold text-accent mb-2">STEP 3</span>
              <h3 className="text-lg font-semibold text-text mb-2">
                Review what to re-teach
              </h3>
              <p className="text-sm text-text-muted mb-6 leading-relaxed">
                Inspect real-time blindspot graphs, explain incorrect choices immediately, and launch an instant re-vote to confirm comprehension.
              </p>
              <div className="mt-auto p-3 bg-bg-subtle rounded-[var(--radius-sm,4px)] border border-border text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-text">Blindspot Score</span>
                  <span className="text-warning font-semibold">62% pass rate</span>
                </div>
                <span className="text-text-muted">Retest triggered for Question 3</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Rows */}
      <section id="features" className="py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text mb-3">
            Designed for genuine learning, not just trivia
          </h2>
          <p className="text-sm sm:text-base text-text-muted">
            Every feature helps teachers identify misconceptions and adapt instruction immediately.
          </p>
        </div>

        <div className="flex flex-col gap-16 sm:gap-20">
          {/* Feature 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold text-text mb-3">
                Immediate explanations and misconception analysis
              </h3>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-4">
                Students do not just see if they were right or wrong. Detailed Concept Anchors break down why distractors were attractive and clear up common misunderstandings before the next question.
              </p>
              <ul className="space-y-2 text-sm text-text">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Misconception labels on each answer choice</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Confidence rating checks to separate guesses from convictions</span>
                </li>
              </ul>
            </div>
            <div className="p-5 bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)]">
              <div className="text-xs font-semibold uppercase text-accent mb-2">Concept Anchor</div>
              <p className="text-sm font-medium text-text mb-3">
                "Newton's 3rd Law pairs always act on different bodies. Normal force and gravity are acting on the same book, so they are not an action-reaction pair."
              </p>
              <div className="p-2.5 bg-bg-subtle rounded-[var(--radius-sm,4px)] text-xs text-text-muted">
                Confidence accuracy: 78% of confident students answered correctly.
              </div>
            </div>
          </div>

          {/* Feature 2: Discuss & Re-vote */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1 p-5 bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-3">
                <span className="text-xs font-semibold text-text">Peer Discussion Mode</span>
                <span className="text-xs px-2 py-0.5 rounded-[var(--radius-sm,4px)] bg-accent/10 text-accent font-semibold">
                  Round 2 Vote
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-text-muted">
                  <span>Round 1 Class Correctness</span>
                  <span className="font-semibold text-danger">38%</span>
                </div>
                <div className="flex justify-between text-text">
                  <span>Round 2 (After Peer Discussion)</span>
                  <span className="font-semibold text-success">86% (+48%)</span>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h3 className="text-xl sm:text-2xl font-semibold text-text mb-3">
                Discuss & Re-vote in real time
              </h3>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-4">
                When less than half the class gets a question right, pause the room with one click. Let students debate with their neighbor, then re-vote to observe learning shifts directly on screen.
              </p>
              <ul className="space-y-2 text-sm text-text">
                <li className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-accent" />
                  <span>One-click pause into peer discussion</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Before-and-after distribution comparison</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Feature 3: Blindspot Report */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl sm:text-2xl font-semibold text-text mb-3">
                Blindspot reports and automated re-tests
              </h3>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-4">
                After the game, the Blindspot Radar highlights topics where student accuracy fell below 50%. Create an instant targeted retest quiz to reinforce those exact ideas.
              </p>
              <ul className="space-y-2 text-sm text-text">
                <li className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-accent" />
                  <span>Topic-level accuracy breakdowns</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Automated 1-click retest quiz generation</span>
                </li>
              </ul>
            </div>
            <div className="p-5 bg-surface border border-border rounded-[var(--radius-md,8px)] shadow-[var(--shadow-card)]">
              <div className="text-xs font-semibold text-text mb-2">Class Blindspot Radar</div>
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-text-muted">Thermodynamics</span>
                    <span className="font-semibold text-success">84%</span>
                  </div>
                  <Bar value={84} max={100} orientation="horizontal" color="bg-success" trackClassName="w-full h-1.5 rounded-full" fillClassName="rounded-full" />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-text-muted">Wave Optics</span>
                    <span className="font-semibold text-danger">41% (Blindspot)</span>
                  </div>
                  <Bar value={41} max={100} orientation="horizontal" color="bg-danger" trackClassName="w-full h-1.5 rounded-full" fillClassName="rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Students Band */}
      <section id="students" className="py-14 bg-bg-subtle border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border text-accent mb-4 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-text mb-3">
            Designed to be frictionless for students
          </h2>
          <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-2xl mx-auto mb-6">
            No accounts, no apps to install, and no tracking. Students join from any web browser with a 6-digit PIN, receive personal explanations during class, and save a digital revision receipt afterwards.
          </p>
          <div className="inline-flex items-center gap-3">
            <Button variant="secondary" size="md" onClick={() => navigate('/join')}>
              Join a game now
            </Button>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-text mb-3">
          Ready to see where your students need help?
        </h2>
        <p className="text-sm sm:text-base text-text-muted max-w-xl mx-auto mb-8">
          Sign up to host your first diagnostic quiz in minutes, or paste a game PIN to test the student experience.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => navigate(user ? '/host' : '/register')}
          >
            <span>Create a quiz</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => navigate('/join')}
          >
            Join a game
          </Button>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="mt-auto border-t border-border bg-surface py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-accent shrink-0"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <rect width="32" height="32" rx="6" fill="var(--accent)" />
              <rect x="7" y="7" width="18" height="18" rx="2" stroke="var(--accent-text)" strokeWidth="2" />
              <path d="M11 12h10M11 16h10M11 20h6" stroke="var(--accent-text)" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-text">ReviseLive</span>
            <span>— Diagnostic Classroom Revision</span>
          </div>

          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-text transition-colors">Teacher Login</Link>
            <Link to="/join" className="hover:text-text transition-colors">Student Join</Link>
            <span>© {new Date().getFullYear()} ReviseLive</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
