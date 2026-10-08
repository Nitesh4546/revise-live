import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import QRJoinCard from '../components/QRJoinCard.jsx';
import PlayerList from '../components/PlayerList.jsx';
import CountdownTimer from '../components/CountdownTimer.jsx';
import AnswerTile from '../components/AnswerTile.jsx';
import ConceptAnchor from '../components/ConceptAnchor.jsx';
import AnswerDistributionChart from '../components/AnswerDistributionChart.jsx';
import Leaderboard from '../components/Leaderboard.jsx';
import Podium from '../components/Podium.jsx';
import BlindspotRadar from '../components/BlindspotRadar.jsx';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import Badge from '../components/ui/Badge.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import {
  Users,
  AlertCircle,
  HelpCircle,
  ArrowRightLeft,
} from 'lucide-react';

export default function ProjectorDisplay() {
  const { pin } = useParams();
  const [searchParams] = useSearchParams();
  const { socket, connected } = useSocket();

  const tokenParam = searchParams.get('token') || '';
  const displayToken = tokenParam || sessionStorage.getItem(`reviselive:display:${pin}`) || '';

  const [status, setStatus] = useState('LOBBY'); // LOBBY, QUESTION_ACTIVE, DISCUSSION, REVOTE, QUESTION_REVEAL, LEADERBOARD, FINISHED
  const [players, setPlayers] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [currentRound, setCurrentRound] = useState('main');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Question & Discussion state
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [discussionData, setDiscussionData] = useState(null);
  const [revoteData, setRevoteData] = useState(null);

  // Reveal state
  const [revealData, setRevealData] = useState(null);

  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState([]);

  // End state
  const [endData, setEndData] = useState(null);
  const [error, setError] = useState('');

  // Countdown timer for question
  const { secondsLeft: questionSecondsLeft } = useCountdown(
    currentQuestion?.endsAt,
    currentQuestion?.serverNow,
    currentQuestion?.timeLimit || 20
  );

  // Countdown timer for discussion
  const { secondsLeft: discussionSecondsLeft } = useCountdown(
    discussionData?.endsAt,
    discussionData?.serverNow,
    discussionData?.seconds || 60
  );

  // Countdown timer for revote
  const { secondsLeft: revoteSecondsLeft } = useCountdown(
    revoteData?.endsAt,
    revoteData?.serverNow,
    revoteData?.seconds || 15
  );

  // Join display room with displayToken
  useEffect(() => {
    if (!socket || !connected || !pin) return;

    if (displayToken) {
      sessionStorage.setItem(`reviselive:display:${pin}`, displayToken);
    }

    socket.emit('display:join', { pin, displayToken: displayToken || 'anonymous-display' }, (res) => {
      if (res.ok && res.data) {
        const d = res.data;
        setStatus(d.status);
        setPlayers(d.players || []);
        setQuizTitle(d.quizTitle || '');
        setCurrentRound(d.currentRound || 'main');
        setCurrentQuestionIndex(d.currentQuestionIndex);
        setTotalQuestions(d.totalQuestions);
        if (d.question) setCurrentQuestion(d.question);
      } else {
        setError(res.error?.message || 'Display connection unauthorized.');
      }
    });
  }, [socket, connected, pin, displayToken]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handlePlayerJoined = (data) => {
      setPlayers(data.players || []);
    };

    const handlePlayerLeft = (data) => {
      setPlayers(data.players || []);
    };

    const handleQuestionStart = (data) => {
      setStatus('QUESTION_ACTIVE');
      setCurrentQuestion(data);
      setCurrentRound(data.round || 'main');
      setCurrentQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setRevealData(null);
      setDiscussionData(null);
      setRevoteData(null);
    };

    const handleDiscussionStart = (data) => {
      setStatus('DISCUSSION');
      setDiscussionData(data);
    };

    const handleRevoteStart = (data) => {
      setStatus('REVOTE');
      setRevoteData(data);
    };

    const handleQuestionReveal = (data) => {
      setStatus('QUESTION_REVEAL');
      setRevealData(data);
    };

    const handleLeaderboardUpdate = (data) => {
      setStatus('LEADERBOARD');
      setLeaderboardData(data.topPlayers || []);
    };

    const handleGameEnded = (data) => {
      setStatus('FINISHED');
      setEndData(data);
    };

    socket.on('room:player-joined', handlePlayerJoined);
    socket.on('room:player-left', handlePlayerLeft);
    socket.on('game:question-start', handleQuestionStart);
    socket.on('game:discussion-start', handleDiscussionStart);
    socket.on('game:revote-start', handleRevoteStart);
    socket.on('game:question-reveal', handleQuestionReveal);
    socket.on('game:leaderboard-update', handleLeaderboardUpdate);
    socket.on('game:ended', handleGameEnded);

    return () => {
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-left', handlePlayerLeft);
      socket.off('game:question-start', handleQuestionStart);
      socket.off('game:discussion-start', handleDiscussionStart);
      socket.off('game:revote-start', handleRevoteStart);
      socket.off('game:question-reveal', handleQuestionReveal);
      socket.off('game:leaderboard-update', handleLeaderboardUpdate);
      socket.off('game:ended', handleGameEnded);
    };
  }, [socket]);

  const connectedCount = players.filter((p) => p.connected).length;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between select-none font-sans transition-colors">
      <ConnectionBanner />

      {/* Top Projector Header */}
      <header className="border-b border-border bg-surface/95 backdrop-blur-xs px-6 sm:px-8 py-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
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
          <div>
            <span className="text-base font-semibold text-text tracking-tight">
              {quizTitle || 'ReviseLive Classroom'}
            </span>
            {currentRound === 'retest' && (
              <Badge variant="accent" className="ml-2">
                Retest Round
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <ThemeToggle />

          {/* PIN Display */}
          <div className="flex items-center gap-2 bg-bg-subtle px-4 py-1.5 rounded-[var(--radius-sm,4px)] border border-border font-mono">
            <span className="text-xs uppercase text-text-muted font-semibold">PIN</span>
            <span className="text-xl sm:text-2xl font-bold text-accent tracking-wider">{pin}</span>
          </div>

          {/* Connected Player Counter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold bg-bg-subtle px-3 py-1.5 rounded-[var(--radius-sm,4px)] border border-border text-text">
            <Users className="w-3.5 h-3.5 text-accent" />
            <span>{connectedCount}</span>
          </div>
        </div>
      </header>

      {/* Main Display Body */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 max-w-7xl mx-auto w-full text-center">
        {error ? (
          <div className="p-6 bg-danger/10 border border-danger/30 rounded-[var(--radius-md,8px)] text-danger max-w-md flex flex-col items-center gap-2.5">
            <AlertCircle className="w-8 h-8 text-danger" />
            <p className="text-base font-semibold">{error}</p>
          </div>
        ) : status === 'LOBBY' ? (
          /* ==========================================
             1. LOBBY SCREEN (Read-Only)
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-4xl py-6">
            <QRJoinCard pin={pin} />
            <div className="mt-8 w-full">
              <PlayerList players={players} showKick={false} />
            </div>
          </div>
        ) : status === 'QUESTION_ACTIVE' ? (
          /* ==========================================
             2. ACTIVE QUESTION SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full max-w-5xl mb-6">
              <Badge variant="accent" className="text-xs sm:text-sm py-1 px-3">
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </Badge>
              <span className="text-xs uppercase tracking-wider font-semibold text-text-muted">
                {currentQuestion?.topicTag}
              </span>
            </div>

            {/* Question Text (at least 40px font size) & Countdown */}
            <div className="w-full max-w-5xl mb-8 flex items-center justify-between gap-6 text-left">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-semibold text-text leading-snug flex-1 font-sans">
                {currentQuestion?.questionText}
              </h2>
              <CountdownTimer
                secondsLeft={questionSecondsLeft}
                totalSeconds={currentQuestion?.timeLimit || 20}
              />
            </div>

            {/* Vertical Stack of Exam-Paper Answer Cards */}
            <div className="flex flex-col gap-3.5 w-full max-w-5xl">
              {(currentQuestion?.options || []).map((optText, idx) => (
                <AnswerTile
                  key={idx}
                  index={idx}
                  text={optText}
                  large={true}
                  disabled={true}
                />
              ))}
            </div>
          </div>
        ) : status === 'DISCUSSION' ? (
          /* ==========================================
             2B. PEER INSTRUCTION DISCUSSION
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl">
            <div className="flex items-center justify-between w-full mb-6">
              <span className="text-xs uppercase font-bold tracking-wider text-accent bg-accent/10 px-3.5 py-1.5 rounded-[var(--radius-sm,4px)] border border-accent/30">
                Peer Discussion • Convince a Neighbor
              </span>
              <CountdownTimer
                secondsLeft={discussionSecondsLeft}
                totalSeconds={discussionData?.seconds || 60}
              />
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text mb-6 text-left w-full font-sans">
              {discussionData?.questionText}
            </h2>

            {/* Masked Answer Distribution (Correct answer is secret!) */}
            <div className="w-full mb-6">
              <AnswerDistributionChart
                counts={discussionData?.distribution || [0, 0, 0, 0]}
                mode="live"
              />
            </div>

            <p className="text-sm text-text-muted font-medium">
              Turn to someone who chose a different answer. Explain your reasoning and listen to theirs!
            </p>
          </div>
        ) : status === 'REVOTE' ? (
          /* ==========================================
             2C. RE-VOTE PHASE
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl">
            <div className="flex items-center justify-between w-full mb-6">
              <span className="text-xs uppercase font-bold tracking-wider text-success bg-success/10 px-3.5 py-1.5 rounded-[var(--radius-sm,4px)] border border-success/30">
                Re-vote Phase • Submit on your device
              </span>
              <CountdownTimer
                secondsLeft={revoteSecondsLeft}
                totalSeconds={revoteData?.seconds || 15}
              />
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-text mb-8 text-left w-full font-sans">
              {revoteData?.questionText}
            </h2>

            <div className="flex flex-col gap-3.5 w-full max-w-5xl">
              {(revoteData?.options || []).map((optText, idx) => (
                <AnswerTile
                  key={idx}
                  index={idx}
                  text={optText}
                  large={true}
                  disabled={true}
                />
              ))}
            </div>
          </div>
        ) : status === 'QUESTION_REVEAL' ? (
          /* ==========================================
             3. QUESTION REVEAL SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold text-text leading-snug mb-6 text-left w-full font-sans">
              {currentQuestion?.questionText}
            </h2>

            {/* Answer Cards with Correct Option Highlighted */}
            <div className="flex flex-col gap-3 w-full mb-6">
              {(currentQuestion?.options || []).map((optText, idx) => (
                <AnswerTile
                  key={idx}
                  index={idx}
                  text={optText}
                  isCorrect={revealData?.correctIndex === idx}
                  isDimmed={revealData?.correctIndex !== idx}
                  disabled={true}
                />
              ))}
            </div>

            {/* Top Distractor Misconception Banner */}
            {revealData?.topDistractorRationale && (
              <div className="w-full p-4 mb-5 rounded-[var(--radius-md,8px)] bg-warning/10 border border-warning/30 text-text text-left flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs uppercase font-bold text-warning block mb-0.5">
                    Classroom Misconception Rationale
                  </span>
                  <p className="text-sm font-medium">
                    {revealData.topDistractorRationale}
                  </p>
                </div>
              </div>
            )}

            {/* Confident Misconception Badge */}
            {revealData?.confidentWrongCount > 0 && (
              <div className="w-full p-3.5 mb-5 rounded-[var(--radius-md,8px)] bg-danger/10 border border-danger/30 text-danger text-left flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                <span className="text-xs font-semibold">
                  {revealData.confidentWrongCount} student{revealData.confidentWrongCount > 1 ? 's were' : ' was'} Certain and wrong on this question!
                </span>
              </div>
            )}

            {/* Peer Shift Visualization */}
            {revealData?.peerShift && (
              <div className="w-full p-4 mb-6 rounded-[var(--radius-md,8px)] bg-surface border border-border text-left shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-accent uppercase tracking-wider">
                  <ArrowRightLeft className="w-4 h-4 text-accent" />
                  <span>Peer Discussion Shift</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-bg-subtle p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-bold text-success font-mono">{revealData.peerShift.wrongToRight || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-semibold">Wrong → Right</span>
                  </div>
                  <div className="bg-bg-subtle p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-bold text-danger font-mono">{revealData.peerShift.rightToWrong || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-semibold">Right → Wrong</span>
                  </div>
                  <div className="bg-bg-subtle p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-bold text-text font-mono">{revealData.peerShift.rightToRight || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-semibold">Right → Right</span>
                  </div>
                  <div className="bg-bg-subtle p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-bold text-text-muted font-mono">{revealData.peerShift.wrongToWrong || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-semibold">Wrong → Wrong</span>
                  </div>
                </div>
              </div>
            )}

            {/* Distribution Chart and Concept Anchor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              <AnswerDistributionChart
                counts={revealData?.optionCounts || [0, 0, 0, 0]}
                mode="reveal"
                correctIndex={revealData?.correctIndex}
              />
              <ConceptAnchor
                explanation={revealData?.explanation}
                topicTag={revealData?.topicTag}
                correctAnswerText={
                  revealData?.correctIndex !== undefined
                    ? currentQuestion?.options[revealData.correctIndex]
                    : null
                }
              />
            </div>
          </div>
        ) : status === 'LEADERBOARD' ? (
          /* ==========================================
             4. LEADERBOARD SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-3xl">
            <Leaderboard topPlayers={leaderboardData} />
          </div>
        ) : status === 'FINISHED' ? (
          /* ==========================================
             5. FINISHED PODIUM & BLINDSPOT RADAR SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl space-y-8">
            <div className="text-center">
              <span className="text-xs uppercase font-semibold tracking-wider text-accent mb-1 block">
                Session Complete
              </span>
              <h2 className="text-3xl sm:text-4xl font-semibold text-text font-sans">
                Classroom Mastery &amp; Podium
              </h2>
            </div>

            <Podium podium={endData?.podium || []} />
            <BlindspotRadar report={endData?.blindspotReport} />
          </div>
        ) : null}
      </main>

      {/* Projector Footer Status */}
      <footer className="border-t border-border py-3 px-6 sm:px-8 text-center text-xs text-text-muted flex items-center justify-between">
        <span>ReviseLive Projector View</span>
        <span className="font-mono">PIN: {pin}</span>
      </footer>
    </div>
  );
}
