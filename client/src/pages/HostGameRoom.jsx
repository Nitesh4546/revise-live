import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { useCountdown } from '../hooks/useCountdown.js';
import { sessionApi } from '../api/sessionApi.js';
import {
  FastForward,
  ArrowRight,
  Lock,
  Unlock,
  Download,
  FileText,
  AlertCircle,
  Loader2,
  Users,
  Tv,
  Copy,
  Check,
  Eye,
  MessageSquare,
  ArrowRightLeft,
  RotateCcw,
  HelpCircle,
  Sliders,
  CheckCircle,
  X
} from 'lucide-react';

export default function HostGameRoom() {
  const { id: quizId } = useParams();
  const navigate = useNavigate();
  const [downloadingClassPdf, setDownloadingClassPdf] = useState(false);
  const { socket, connected } = useSocket();

  const isPinParam = quizId && /^\d{6}$/.test(quizId);
  const initialPin = isPinParam ? quizId : '';
  const initialHostToken = initialPin ? sessionStorage.getItem(`reviselive:host:${initialPin}`) || '' : '';
  const initialDisplayToken = initialPin ? sessionStorage.getItem(`reviselive:display:${initialPin}`) || '' : '';

  const [pin, setPin] = useState(initialPin);
  const [hostToken, setHostToken] = useState(initialHostToken);
  const [displayToken, setDisplayToken] = useState(initialDisplayToken);
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState('LOBBY'); // LOBBY, QUESTION_ACTIVE, DISCUSSION, REVOTE, QUESTION_REVEAL, LEADERBOARD, FINISHED
  const [locked, setLocked] = useState(false);
  const [players, setPlayers] = useState([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [currentRound, setCurrentRound] = useState('main');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const roomCreatingRef = useRef(false);

  // Modals & Navigation Controls
  const [showDisplayModal, setShowDisplayModal] = useState(false);
  const [showRetestModal, setShowRetestModal] = useState(false);
  const [showRetestResultsModal, setShowRetestResultsModal] = useState(false);
  const [isRetestLoading, setIsRetestLoading] = useState(false);
  const [retestError, setRetestError] = useState(null);
  const [showAllQuestionsInRetest, setShowAllQuestionsInRetest] = useState(false);
  const [showGameSetupModal, setShowGameSetupModal] = useState(false);
  const [copiedDisplayLink, setCopiedDisplayLink] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [isInactive, setIsInactive] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const lastActionClickRef = useRef(0);
  const revealEnteredAtRef = useRef(0);
  const inactivityTimerRef = useRef(null);

  // Question & Host Private Stats (C5)
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [previewData, setPreviewData] = useState(null);
  const [liveHistogram, setLiveHistogram] = useState([0, 0, 0, 0]);
  const [nudgeList, setNudgeList] = useState([]);

  // Peer Instruction Discussion (C3)
  const [peerSuggested, setPeerSuggested] = useState(null);
  const [discussionData, setDiscussionData] = useState(null);
  const [revoteData, setRevoteData] = useState(null);

  // Reveal state
  const [revealData, setRevealData] = useState(null);

  // Leaderboard state
  const [leaderboardData, setLeaderboardData] = useState([]);

  // End state
  const [endData, setEndData] = useState(null);
  const [selectedRetestIndexes, setSelectedRetestIndexes] = useState([]);
  const [error, setError] = useState('');

  // Countdown timer hook
  const { secondsLeft: questionSecondsLeft } = useCountdown(
    currentQuestion?.endsAt,
    currentQuestion?.serverNow,
    currentQuestion?.timeLimit || 20
  );

  const { secondsLeft: discussionSecondsLeft } = useCountdown(
    discussionData?.endsAt,
    discussionData?.serverNow,
    discussionData?.seconds || 60
  );

  const { secondsLeft: revoteSecondsLeft } = useCountdown(
    revoteData?.endsAt,
    revoteData?.serverNow,
    revoteData?.seconds || 15
  );

  // Present Here inactivity timer (fades button to 30% after 3s of inactivity)
  useEffect(() => {
    if (!presentMode) {
      setIsInactive(false);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      return;
    }

    const resetInactivity = () => {
      setIsInactive(false);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        setIsInactive(true);
      }, 3000);
    };

    resetInactivity();

    window.addEventListener('mousemove', resetInactivity);
    window.addEventListener('keydown', resetInactivity);
    window.addEventListener('pointerdown', resetInactivity);
    window.addEventListener('touchstart', resetInactivity);

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener('mousemove', resetInactivity);
      window.removeEventListener('keydown', resetInactivity);
      window.removeEventListener('pointerdown', resetInactivity);
      window.removeEventListener('touchstart', resetInactivity);
    };
  }, [presentMode]);

  // Initialize or reconnect host room
  useEffect(() => {
    if (!socket || !connected) return;

    if (pin && hostToken) {
      // Reconnect existing host session
      socket.emit('host:reconnect', { pin, hostToken }, (res) => {
        if (res.ok && res.data) {
          const d = res.data;
          setStatus(d.status);
          setLocked(d.locked);
          setPlayers(d.players || []);
          setQuizTitle(d.quizTitle || '');
          setCurrentRound(d.currentRound || 'main');
          setCurrentQuestionIndex(d.currentQuestionIndex);
          setTotalQuestions(d.totalQuestions);
          if (d.displayToken) {
            setDisplayToken(d.displayToken);
            sessionStorage.setItem(`reviselive:display:${pin}`, d.displayToken);
          }
          if (d.settings) {
            setSettings(d.settings);
          }
          if (d.question) setCurrentQuestion(d.question);
          if (d.previewCorrectIndex !== undefined) {
            setPreviewData({
              correctIndex: d.previewCorrectIndex,
              explanation: d.previewExplanation
            });
          }
          if (d.liveHistogram) setLiveHistogram(d.liveHistogram);
          if (d.nudgeList) setNudgeList(d.nudgeList);
        } else {
          sessionStorage.removeItem(`reviselive:host:${pin}`);
          setPin('');
          setHostToken('');
        }
      });
    } else if (quizId && !isPinParam && !pin && !roomCreatingRef.current) {
      // Create new host room
      roomCreatingRef.current = true;
      const currentToken = localStorage.getItem('token');
      if (currentToken) {
        socket.auth = { token: currentToken };
      }
      const payload = {
        quizId,
        ...(settings ? { settings } : {}),
        ...(currentToken ? { token: currentToken } : {})
      };
      socket.emit('host:create-room', payload, (res) => {
        if (res.ok && res.data) {
          setPin(res.data.pin);
          setHostToken(res.data.hostToken);
          setDisplayToken(res.data.displayToken || '');
          setSettings(res.data.settings || null);
          sessionStorage.setItem(`reviselive:host:${res.data.pin}`, res.data.hostToken);
          if (res.data.displayToken) {
            sessionStorage.setItem(`reviselive:display:${res.data.pin}`, res.data.displayToken);
          }
        } else {
          roomCreatingRef.current = false;
          setError(res.error?.message || 'Failed to create live game room');
        }
      });
    }
  }, [socket, connected, quizId, pin, hostToken, isPinParam, settings]);

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
      setAnsweredCount(0);
      setLiveHistogram([0, 0, 0, 0]);
      setRevealData(null);
      setPeerSuggested(null);
      setDiscussionData(null);
      setRevoteData(null);
    };

    const handlePlayerAnswered = (data) => {
      setAnsweredCount(data.answeredCount);
      if (data.liveHistogram) setLiveHistogram(data.liveHistogram);
      if (data.nudgeList) setNudgeList(data.nudgeList);
    };

    const handleLiveStats = (data) => {
      if (data.histogram) setLiveHistogram(data.histogram);
      if (data.answeredCount !== undefined) setAnsweredCount(data.answeredCount);
      if (data.nudgeList) setNudgeList(data.nudgeList);
    };

    const handleQuestionPreview = (data) => {
      setPreviewData(data);
    };

    const handlePeerSuggested = (data) => {
      setPeerSuggested(data);
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
      revealEnteredAtRef.current = Date.now();
      setStatus('QUESTION_REVEAL');
      setRevealData(data);
    };

    const handleBlindspotPreview = (data) => {
      if (data?.blindspotReport?.questionAccuracy) {
        const weak = data.blindspotReport.questionAccuracy
          .filter((q) => (q.accuracy ?? 1) < 0.5)
          .map((q) => q.questionIndex);
        setSelectedRetestIndexes(weak);
      }
    };

    const handleLeaderboardUpdate = (data) => {
      setStatus('LEADERBOARD');
      setLeaderboardData(data.topPlayers || []);
    };

    const handleGameEnded = (data) => {
      setStatus('FINISHED');
      setEndData(data);
      if (data.blindspotReport?.questionAccuracy) {
        const weak = data.blindspotReport.questionAccuracy
          .filter((q) => (q.accuracy ?? 1) < 0.5)
          .map((q) => q.questionIndex);
        setSelectedRetestIndexes(weak);
      }
    };

    socket.on('room:player-joined', handlePlayerJoined);
    socket.on('room:player-left', handlePlayerLeft);
    socket.on('game:question-start', handleQuestionStart);
    socket.on('host:player-answered', handlePlayerAnswered);
    socket.on('host:live-stats', handleLiveStats);
    socket.on('host:question-preview', handleQuestionPreview);
    socket.on('host:peer-instruction-suggested', handlePeerSuggested);
    socket.on('host:blindspot-preview', handleBlindspotPreview);
    socket.on('game:discussion-start', handleDiscussionStart);
    socket.on('game:revote-start', handleRevoteStart);
    socket.on('game:question-reveal', handleQuestionReveal);
    socket.on('game:leaderboard-update', handleLeaderboardUpdate);
    socket.on('game:ended', handleGameEnded);

    return () => {
      socket.off('room:player-joined', handlePlayerJoined);
      socket.off('room:player-left', handlePlayerLeft);
      socket.off('game:question-start', handleQuestionStart);
      socket.off('host:player-answered', handlePlayerAnswered);
      socket.off('host:live-stats', handleLiveStats);
      socket.off('host:question-preview', handleQuestionPreview);
      socket.off('host:peer-instruction-suggested', handlePeerSuggested);
      socket.off('host:blindspot-preview', handleBlindspotPreview);
      socket.off('game:discussion-start', handleDiscussionStart);
      socket.off('game:revote-start', handleRevoteStart);
      socket.off('game:question-reveal', handleQuestionReveal);
      socket.off('game:leaderboard-update', handleLeaderboardUpdate);
      socket.off('game:ended', handleGameEnded);
    };
  }, [socket]);

  // Host Action handlers
  const handleStartQuestion = useCallback((cb) => {
    if (!pin) {
      if (typeof cb === 'function') cb();
      return;
    }
    socket.emit('host:start-question', { pin }, (res) => {
      if (typeof cb === 'function') cb();
      if (!res.ok) alert(res.error?.message || 'Cannot start question');
    });
  }, [socket, pin]);

  const handleEndQuestionEarly = useCallback((cb) => {
    if (!pin) {
      if (typeof cb === 'function') cb();
      return;
    }
    socket.emit('host:end-question', { pin }, (res) => {
      if (typeof cb === 'function') cb();
      if (!res.ok) alert(res.error?.message || 'Cannot end question early');
    });
  }, [socket, pin]);

  const handleStartDiscussion = useCallback((seconds = null, cb) => {
    if (!pin) {
      if (typeof cb === 'function') cb();
      return;
    }
    socket.emit('host:start-discussion', { pin, seconds: seconds || 60 }, (res) => {
      if (typeof cb === 'function') cb();
      if (!res.ok) alert(res.error?.message || 'Cannot start discussion');
    });
  }, [socket, pin]);

  const handleSkipDiscussion = useCallback((cb) => {
    if (!pin) {
      if (typeof cb === 'function') cb();
      return;
    }
    socket.emit('host:skip-discussion', { pin }, (res) => {
      if (typeof cb === 'function') cb();
      if (!res.ok) alert(res.error?.message || 'Cannot advance discussion');
    });
  }, [socket, pin]);

  const handleShowLeaderboard = useCallback((cb) => {
    if (!pin) {
      if (typeof cb === 'function') cb();
      return;
    }
    socket.emit('host:show-leaderboard', { pin }, (res) => {
      if (typeof cb === 'function') cb();
      if (!res.ok) alert(res.error?.message || 'Cannot show leaderboard');
    });
  }, [socket, pin]);

  const handleEndGame = useCallback((cb) => {
    if (!pin) {
      if (typeof cb === 'function') cb();
      return;
    }
    socket.emit('host:end-game', { pin }, (res) => {
      if (typeof cb === 'function') cb();
      if (!res.ok) alert(res.error?.message || 'Cannot end game');
    });
  }, [socket, pin]);

  const hasBetweenQuestionLeaderboard = Boolean(settings?.leaderboardBetweenQuestions);

  const handlePrimaryAction = useCallback(() => {
    const now = Date.now();
    if (now - lastActionClickRef.current < 400 || isActionLoading) {
      return;
    }
    lastActionClickRef.current = now;
    setIsActionLoading(true);

    const finish = () => {
      setIsActionLoading(false);
    };

    const connectedPlayersCount = players.filter((p) => p.connected && !p.left).length;

    if (status === 'LOBBY') {
      if (connectedPlayersCount === 0) {
        finish();
        return;
      }
      handleStartQuestion(finish);
    } else if (status === 'QUESTION_ACTIVE' || status === 'REVOTE') {
      handleEndQuestionEarly(finish);
    } else if (status === 'DISCUSSION') {
      handleSkipDiscussion(finish);
    } else if (status === 'QUESTION_REVEAL') {
      if (hasBetweenQuestionLeaderboard) {
        handleShowLeaderboard(finish);
      } else if (currentQuestionIndex + 1 < totalQuestions) {
        handleStartQuestion(finish);
      } else {
        handleEndGame(finish);
      }
    } else if (status === 'LEADERBOARD') {
      if (currentQuestionIndex + 1 < totalQuestions) {
        handleStartQuestion(finish);
      } else {
        handleEndGame(finish);
      }
    } else {
      finish();
    }
  }, [
    status,
    players,
    currentQuestionIndex,
    totalQuestions,
    isActionLoading,
    hasBetweenQuestionLeaderboard,
    handleStartQuestion,
    handleEndQuestionEarly,
    handleSkipDiscussion,
    handleShowLeaderboard,
    handleEndGame
  ]);

  const getPrimaryActionLabel = useCallback(() => {
    switch (status) {
      case 'LOBBY':
        return 'Start game';
      case 'QUESTION_ACTIVE':
      case 'REVOTE':
        return 'End question';
      case 'DISCUSSION':
        return 'Skip to re-vote';
      case 'QUESTION_REVEAL':
        if (hasBetweenQuestionLeaderboard) {
          return 'Leaderboard →';
        }
        return currentQuestionIndex + 1 < totalQuestions ? 'Next question →' : 'Finish';
      case 'LEADERBOARD':
        return currentQuestionIndex + 1 < totalQuestions ? 'Next question →' : 'Finish';
      default:
        return 'Continue';
    }
  }, [status, currentQuestionIndex, totalQuestions, hasBetweenQuestionLeaderboard]);

  const handleStartRetest = useCallback(() => {
    if (!pin || selectedRetestIndexes.length === 0 || isRetestLoading) return;
    setIsRetestLoading(true);
    setRetestError(null);
    socket.emit('host:start-retest', { pin, questionIndexes: selectedRetestIndexes }, (res) => {
      setIsRetestLoading(false);
      if (res?.ok) {
        setShowRetestModal(false);
      } else {
        setRetestError(res?.error?.message || 'Failed to start retest round');
      }
    });
  }, [socket, pin, selectedRetestIndexes, isRetestLoading]);

  const handleCloseRoom = useCallback(() => {
    if (!socket || !pin) return;
    socket.emit('host:close-room', { pin }, (res) => {
      if (res?.ok) {
        sessionStorage.removeItem(`reviselive:host:${pin}`);
        navigate('/host');
      }
    });
  }, [socket, pin, navigate]);

  const handleToggleLock = () => {
    const nextLocked = !locked;
    socket.emit('host:lock-room', { pin, locked: nextLocked }, (res) => {
      if (res.ok) setLocked(nextLocked);
    });
  };

  const handleUpdateSettings = useCallback((newSettings) => {
    if (!socket || !pin) return;
    socket.emit('host:update-settings', { pin, settings: newSettings }, (res) => {
      if (res?.ok && res.data?.settings) {
        setSettings(res.data.settings);
      }
    });
  }, [socket, pin]);

  const handleKickPlayer = (playerId) => {
    socket.emit('host:kick-player', { pin, playerId });
  };

  // Keyboard navigation on teacher console (Space = advance, E = end question, L = leaderboard)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat) return;

      const target = e.target;
      const tagName = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';
      if (isEditable) return;

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();

        // Minimum dwell: ignore Space for 1000 ms after entering QUESTION_REVEAL
        if (status === 'QUESTION_REVEAL') {
          if (Date.now() - revealEnteredAtRef.current < 1000) {
            return;
          }
        }

        handlePrimaryAction();
      } else if (e.key === 'e' || e.key === 'E') {
        if (status === 'QUESTION_ACTIVE' || status === 'REVOTE') {
          e.preventDefault();
          handlePrimaryAction();
        }
      } else if (e.key === 'l' || e.key === 'L') {
        if (status === 'QUESTION_REVEAL' && hasBetweenQuestionLeaderboard) {
          e.preventDefault();
          handlePrimaryAction();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, hasBetweenQuestionLeaderboard, handlePrimaryAction]);

  const connectedCount = players.filter((p) => p.connected).length;
  const displayUrl = `${window.location.origin}/display/${pin}${displayToken ? `?token=${displayToken}` : ''}`;

  const copyDisplayLink = () => {
    navigator.clipboard.writeText(displayUrl);
    setCopiedDisplayLink(true);
    setTimeout(() => setCopiedDisplayLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between selection:bg-accent selection:text-accent-foreground">
      <ConnectionBanner />

      {/* Top Teacher Console Header */}
      <header className="border-b border-border bg-surface px-6 py-3 flex items-center justify-between z-30 sticky top-0">
        <div className="flex items-center space-x-3">
          <Link
            to="/host"
            className="text-xs font-semibold text-text-muted hover:text-text px-3 py-1.5 rounded-[var(--radius-sm,4px)] border border-border bg-surface hover:bg-bg-subtle transition"
          >
            ← Exit Console
          </Link>
          <span className="text-sm font-semibold text-text truncate max-w-[200px] md:max-w-xs">
            {quizTitle || 'Live Revision Quiz'}
          </span>
          {currentRound === 'retest' && (
            <span className="px-2 py-0.5 rounded-[var(--radius-sm,4px)] text-[10px] font-bold uppercase tracking-wider bg-bg-subtle text-text border border-border">
              Retest Round
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Present Here Toggle Mode */}
          {pin && (
            <button
              type="button"
              onClick={() => setPresentMode((p) => !p)}
              className={`px-3 py-1.5 rounded-[var(--radius-sm,4px)] text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                presentMode
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'bg-surface hover:bg-bg-subtle text-text border-border'
              }`}
              title="Toggle Present Here mode"
            >
              <Tv className="w-4 h-4 text-text-muted" />
              <span className="hidden sm:inline">{presentMode ? 'Presenting' : 'Present Here'}</span>
            </button>
          )}

          {/* Projector Link Button (C5) */}
          {pin && (
            <button
              type="button"
              onClick={() => setShowDisplayModal(true)}
              className="px-3 py-1.5 bg-surface hover:bg-bg-subtle text-text font-semibold rounded-[var(--radius-sm,4px)] text-xs flex items-center gap-1.5 border border-border transition cursor-pointer"
            >
              <Tv className="w-4 h-4 text-text-muted" />
              <span className="hidden sm:inline">Projector View</span>
            </button>
          )}

          {/* PIN Badge */}
          {pin && (
            <div className="flex items-center gap-2 bg-bg-subtle px-3 py-1.5 rounded-[var(--radius-sm,4px)] border border-border font-mono">
              <span className="text-xs uppercase text-text-muted font-bold">PIN</span>
              <span className="text-base font-bold text-accent tracking-wider">{pin}</span>
            </div>
          )}

          {/* Connected Player Counter */}
          <div className="flex items-center gap-1.5 text-xs font-semibold bg-bg-subtle px-3 py-1.5 rounded-[var(--radius-sm,4px)] border border-border text-text">
            <Users className="w-4 h-4 text-text-muted" />
            <span>{connectedCount}</span>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </header>

      {/* Main Orchestrator Screen */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-7xl mx-auto w-full text-center">
        {error ? (
          <div className="p-6 bg-surface border border-danger/40 rounded-[var(--radius-md,8px)] text-danger max-w-md flex flex-col items-center gap-3 shadow-xs">
            <AlertCircle className="w-8 h-8 text-danger" />
            <p className="text-base font-bold">{error}</p>
            <button
              onClick={() => navigate('/host')}
              className="mt-2 px-4 py-2 bg-surface hover:bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-xs font-semibold text-text transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        ) : !pin ? (
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <h2 className="text-xl font-bold text-text">Initializing live game room...</h2>
          </div>
        ) : status === 'LOBBY' ? (
          /* ==========================================
             1. LOBBY SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-4xl">
            <QRJoinCard pin={pin} />

            {/* Controls Bar */}
            <div className="my-8 flex items-center justify-center gap-4 w-full flex-wrap">
              <button
                type="button"
                onClick={handleToggleLock}
                className={`px-4 py-2 rounded-[var(--radius-sm,4px)] text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                  locked
                    ? 'bg-danger/10 border-danger/30 text-danger'
                    : 'bg-surface border-border text-text hover:bg-bg-subtle'
                }`}
              >
                {locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{locked ? 'Room Locked' : 'Lock Room'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowGameSetupModal(true)}
                aria-label="Game Setup"
                className="px-4 py-2 rounded-[var(--radius-sm,4px)] text-xs font-bold flex items-center gap-2 border bg-surface border-border text-text hover:bg-bg-subtle transition cursor-pointer"
                title="Configure live game rules and display options"
              >
                <Sliders className="w-4 h-4 text-text-muted" />
                <span>Game Setup</span>
              </button>
            </div>

            {/* Players Joined List */}
            <PlayerList players={players} onKickPlayer={handleKickPlayer} />
          </div>
        ) : status === 'QUESTION_ACTIVE' ? (
          /* ==========================================
             2. ACTIVE QUESTION SCREEN (Teacher Console)
             ========================================== */
          <div className="w-full flex flex-col items-center">
            <div className="flex items-center justify-between w-full max-w-5xl mb-6">
              <span className="text-xs uppercase font-extrabold tracking-widest text-text-muted bg-bg-subtle px-3 py-1.5 rounded-[var(--radius-sm,4px)] border border-border">
                {currentRound === 'retest' ? 'Retest Question' : 'Question'} {currentQuestionIndex + 1} of {totalQuestions}
              </span>

              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold bg-surface px-4 py-2 rounded-[var(--radius-sm,4px)] border border-border text-text-muted">
                  Answered: <strong className="text-text text-base font-bold">{answeredCount}</strong> / {connectedCount}
                </div>

                {/* Peer Instruction shortcut button */}
                <button
                  type="button"
                  onClick={() => handleStartDiscussion()}
                  className={`px-3.5 py-2 text-xs font-bold rounded-[var(--radius-sm,4px)] flex items-center gap-1.5 transition cursor-pointer border ${
                    peerSuggested
                      ? 'animate-pulse bg-warning/15 hover:bg-warning/25 text-warning border-warning'
                      : 'bg-surface hover:bg-bg-subtle text-text border-border'
                  }`}
                  title={peerSuggested ? 'Peer instruction suggested (30–70% accuracy)!' : 'Pause and start Peer Instruction discussion'}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{peerSuggested ? 'Discuss (Recommended)' : 'Discuss'}</span>
                </button>

                {/* End Question Early Button */}
                <button
                  type="button"
                  onClick={handleEndQuestionEarly}
                  className="px-4 py-2 bg-surface hover:bg-bg-subtle text-text text-xs font-semibold rounded-[var(--radius-sm,4px)] flex items-center gap-1.5 border border-border transition cursor-pointer"
                >
                  <FastForward className="w-4 h-4" />
                  <span>End Question (E)</span>
                </button>
              </div>
            </div>

            {/* Question Text & Timer */}
            <div className="w-full max-w-5xl mb-6 flex items-center justify-between gap-6 text-left">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text leading-snug flex-1">
                {currentQuestion?.questionText}
              </h2>
              <CountdownTimer
                secondsLeft={questionSecondsLeft}
                totalSeconds={currentQuestion?.timeLimit || 20}
              />
            </div>

            {/* Private Teacher Preview & Live Histogram (C5) */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-left">
              {/* Private Answer & Anchor Preview */}
              <div className="md:col-span-2 p-4 bg-bg-subtle border border-border rounded-[var(--radius-md,8px)] text-xs">
                <div className="flex items-center gap-2 text-text-muted font-bold uppercase text-[10px] tracking-wider mb-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span>Teacher Preview (Hidden from Projector &amp; Phones)</span>
                </div>
                <div className="font-semibold text-text mb-1">
                  Correct Answer: <strong className="text-success font-bold">{previewData?.correctIndex !== undefined ? currentQuestion?.options[previewData.correctIndex] : 'Loading...'}</strong>
                </div>
                <p className="text-text-muted italic">
                  Concept Anchor: {previewData?.explanation || currentQuestion?.topicTag}
                </p>
              </div>

              {/* Private Live Histogram */}
              <div className="w-full">
                <AnswerDistributionChart
                  counts={liveHistogram}
                  mode="live"
                  compact={true}
                />
              </div>
            </div>

            {/* Answer Cards Stack */}
            <div className="flex flex-col gap-3 w-full max-w-5xl">
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

            {/* Private "May Need a Nudge" Alert */}
            {nudgeList.length > 0 && (
              <div className="mt-4 p-3 bg-warning/10 border border-warning/30 rounded-[var(--radius-sm,4px)] text-text text-xs text-left max-w-5xl w-full flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                <span>
                  <strong>Classroom Nudge:</strong> {nudgeList.map((n) => `${n.name} (${n.reason})`).join(', ')}
                </span>
              </div>
            )}
          </div>
        ) : status === 'DISCUSSION' ? (
          /* ==========================================
             2B. PEER INSTRUCTION DISCUSSION SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl">
            <div className="flex items-center justify-between w-full mb-6">
              <span className="text-xs uppercase font-extrabold tracking-widest text-text-muted bg-bg-subtle px-4 py-1.5 rounded-[var(--radius-sm,4px)] border border-border">
                Peer Instruction Active • Convince a Neighbour
              </span>
              <div className="flex items-center gap-4">
                <CountdownTimer
                  secondsLeft={discussionSecondsLeft}
                  totalSeconds={discussionData?.seconds || 60}
                />
                <button
                  type="button"
                  onClick={handleSkipDiscussion}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-foreground font-semibold rounded-[var(--radius-sm,4px)] text-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <span>End Discussion &amp; Start Revote</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-text mb-6 text-left w-full">
              {discussionData?.questionText}
            </h2>

            {/* Unrevealed Answer Distribution Chart */}
            <div className="w-full mb-6">
              <AnswerDistributionChart
                counts={discussionData?.distribution || [0, 0, 0, 0]}
                mode="live"
              />
            </div>
          </div>
        ) : status === 'REVOTE' ? (
          /* ==========================================
             2C. RE-VOTE SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl">
            <div className="flex items-center justify-between w-full mb-6">
              <span className="text-xs uppercase font-extrabold tracking-widest text-text-muted bg-bg-subtle px-4 py-1.5 rounded-[var(--radius-sm,4px)] border border-border">
                Re-vote Active • Students are changing/locking answers
              </span>
              <CountdownTimer
                secondsLeft={revoteSecondsLeft}
                totalSeconds={revoteData?.seconds || 15}
              />
            </div>

            <h2 className="text-3xl font-bold text-text mb-6 text-left w-full">
              {revoteData?.questionText}
            </h2>

            <div className="flex flex-col gap-3 w-full max-w-5xl">
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
            <div className="flex items-center justify-between w-full mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-text text-left leading-snug flex-1 mr-4">
                {currentQuestion?.questionText}
              </h2>

              <div className="flex items-center gap-3">
                {hasBetweenQuestionLeaderboard && (
                  <button
                    type="button"
                    onClick={handleShowLeaderboard}
                    className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground font-bold rounded-[var(--radius-sm,4px)] text-sm flex items-center gap-2 transition shrink-0 cursor-pointer"
                  >
                    <span>Show Leaderboard (L)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Answer Tiles Vertical Stack */}
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

            {/* Top Distractor Misconception Banner (C1) */}
            {revealData?.topDistractorRationale && (
              <div className="w-full p-4 mb-6 rounded-[var(--radius-md,8px)] bg-warning/10 border border-warning/30 text-text text-left flex items-start gap-3">
                <HelpCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs uppercase font-bold text-warning block mb-0.5">
                    Classroom Misconception Rationale
                  </span>
                  <p className="text-sm font-medium text-text">
                    {revealData.topDistractorRationale}
                  </p>
                </div>
              </div>
            )}

            {/* Confident Misconception Alert (C2) */}
            {revealData?.confidentWrongCount > 0 && (
              <div className="w-full p-3.5 mb-6 rounded-[var(--radius-md,8px)] bg-danger/10 border border-danger/30 text-danger text-left flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-danger shrink-0" />
                <span className="text-xs font-bold">
                  {revealData.confidentWrongCount} student{revealData.confidentWrongCount > 1 ? 's were' : ' was'} Certain and wrong on this question! Re-teach priority!
                </span>
              </div>
            )}

            {/* Peer Shift Visualization (C3) */}
            {revealData?.peerShift && (
              <div className="w-full p-4 mb-6 rounded-[var(--radius-md,8px)] bg-bg-subtle border border-border text-left">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-text-muted uppercase tracking-wider">
                  <ArrowRightLeft className="w-4 h-4 text-text-muted" />
                  <span>Peer Discussion Shift</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-surface p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-black text-text">{revealData.peerShift.wrongToRight || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-bold">Wrong → Right</span>
                  </div>
                  <div className="bg-surface p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-black text-text">{revealData.peerShift.rightToWrong || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-bold">Right → Wrong</span>
                  </div>
                  <div className="bg-surface p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-black text-text">{revealData.peerShift.rightToRight || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-bold">Right → Right</span>
                  </div>
                  <div className="bg-surface p-2.5 rounded-[var(--radius-sm,4px)] border border-border">
                    <span className="text-lg font-black text-text">{revealData.peerShift.wrongToWrong || 0}</span>
                    <span className="block text-[10px] text-text-muted uppercase font-bold">Wrong → Wrong</span>
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
          <div className="w-full flex flex-col items-center max-w-4xl pb-32" data-testid="host-leaderboard-container">
            <Leaderboard topPlayers={leaderboardData} />
          </div>
        ) : status === 'FINISHED' ? (
          /* ==========================================
             5. FINISHED PODIUM & BLINDSPOT RADAR SCREEN
             ========================================== */
          <div className="w-full flex flex-col items-center max-w-5xl space-y-8">
            <div className="text-center">
              <span className="text-xs uppercase font-extrabold tracking-widest text-text-muted mb-1 block">
                Session Complete
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-text">
                Final Results &amp; Podium
              </h2>
            </div>

            <Podium podium={endData?.podium || []} />
            <BlindspotRadar report={endData?.blindspotReport} />

            {/* Action Bar: Retest Round, CSV, Full Report */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              {/* Retest Round Button */}
              {endData?.retestCompleted || endData?.retest ? (
                <button
                  type="button"
                  onClick={() => setShowRetestResultsModal(true)}
                  className="px-5 py-2.5 bg-surface hover:bg-bg-subtle text-text border border-border font-bold rounded-[var(--radius-sm,4px)] text-sm flex items-center gap-2 transition cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>Retest complete (view results)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRetestError(null);
                    setShowRetestModal(true);
                  }}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground font-bold rounded-[var(--radius-sm,4px)] text-sm flex items-center gap-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Re-teach, then Retest</span>
                </button>
              )}

              {endData?.sessionId && (
                <>
                  <a
                    href={`/api/sessions/${endData.sessionId}/export.csv`}
                    download
                    className="px-4 py-2.5 bg-surface hover:bg-bg-subtle text-text border border-border font-bold rounded-[var(--radius-sm,4px)] text-sm flex items-center gap-2 transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download CSV Results</span>
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setDownloadingClassPdf(true);
                        const res = await sessionApi.downloadClassPdf(endData.sessionId);
                        if (!res.ok) alert(res.error || 'Failed to download PDF');
                      } finally {
                        setDownloadingClassPdf(false);
                      }
                    }}
                    disabled={downloadingClassPdf}
                    className="px-4 py-2.5 bg-surface hover:bg-bg-subtle text-text border border-border font-bold rounded-[var(--radius-sm,4px)] text-sm flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                  >
                    {downloadingClassPdf ? (
                      <Loader2 className="w-4 h-4 animate-spin text-text" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    <span>Export Class PDF</span>
                  </button>

                  <Link
                    to={`/host/sessions/${endData.sessionId}`}
                    className="px-4 py-2.5 bg-accent hover:bg-accent-hover text-accent-foreground font-bold rounded-[var(--radius-sm,4px)] text-sm flex items-center gap-2 transition"
                  >
                    <FileText className="w-4 h-4" />
                    <span>View Complete Report</span>
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => navigate('/host')}
                className="px-4 py-2.5 bg-surface border border-border hover:bg-bg-subtle text-text font-semibold rounded-[var(--radius-sm,4px)] text-sm transition cursor-pointer"
              >
                Back to Dashboard
              </button>

              <button
                type="button"
                onClick={handleCloseRoom}
                className="px-4 py-2.5 bg-surface border border-border hover:bg-danger/10 text-danger font-semibold rounded-[var(--radius-sm,4px)] text-sm transition cursor-pointer"
              >
                Close room
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer controls tip */}
      <footer className="border-t border-border py-3 px-6 text-center text-xs text-text-muted flex items-center justify-between bg-surface">
        <span>Teacher Console • ReviseLive</span>
        <span className="hidden md:inline">
          Shortcuts: <kbd className="px-1.5 py-0.5 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-text font-mono text-[11px]">Space</kbd> Advance • <kbd className="px-1.5 py-0.5 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-text font-mono text-[11px]">E</kbd> End Question{hasBetweenQuestionLeaderboard ? <> • <kbd className="px-1.5 py-0.5 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-text font-mono text-[11px]">L</kbd> Leaderboard</> : null}
        </span>
      </footer>

      {/* Projector Display Modal (C5) */}
      {showDisplayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-[var(--radius-lg,8px)] p-6 max-w-md w-full shadow-lg text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-text font-bold text-sm">
                <Tv className="w-5 h-5 text-accent" />
                <span>Classroom Projector Display</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDisplayModal(false)}
                className="text-text-muted hover:text-text text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Open this link on the classroom computer connected to the projector or TV. It is read-only, has no teacher controls, and hides sensitive information.
            </p>

            <div className="p-3 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] flex items-center justify-between text-xs font-mono text-accent mb-4 truncate">
              <span className="truncate mr-2">{displayUrl}</span>
              <button
                type="button"
                onClick={copyDisplayLink}
                className="p-1.5 rounded-[var(--radius-sm,4px)] bg-surface hover:bg-bg-subtle border border-border text-text shrink-0 cursor-pointer"
                title="Copy link"
              >
                {copiedDisplayLink ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={displayUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 bg-accent hover:bg-accent-hover text-accent-foreground font-semibold rounded-[var(--radius-sm,4px)] text-xs text-center transition"
              >
                Open in New Tab
              </a>
              <button
                type="button"
                onClick={() => setShowDisplayModal(false)}
                className="px-4 py-2 bg-surface hover:bg-bg-subtle border border-border text-text font-semibold rounded-[var(--radius-sm,4px)] text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retest Selection Modal */}
      {showRetestModal && (() => {
        const allQuestions = endData?.blindspotReport?.questionAccuracy || [];
        const flaggedQuestions = allQuestions.filter((q) => (q.accuracy ?? 1) < 0.5);
        const hasFlagged = flaggedQuestions.length > 0;
        const questionsToDisplay = hasFlagged && !showAllQuestionsInRetest ? flaggedQuestions : allQuestions;

        return (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface border border-border rounded-[var(--radius-lg,8px)] p-6 max-w-lg w-full shadow-lg text-left max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2 text-text font-bold text-sm">
                  <RotateCcw className="w-5 h-5 text-accent" />
                  <span>Re-teach, then Retest</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRetestModal(false)}
                  disabled={isRetestLoading}
                  className="text-text-muted hover:text-text text-xs font-bold cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <p className="text-xs text-text-muted mb-3 shrink-0">
                Re-teach weak concepts to the class, then test understanding with reshuffled options. Retest scores are tracked separately and do not alter the main podium!
              </p>

              {retestError && (
                <div role="alert" className="p-3 bg-danger/10 border border-danger/30 rounded-[var(--radius-sm,4px)] text-danger text-xs flex items-center gap-2 mb-3 shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{retestError}</span>
                </div>
              )}

              {!hasFlagged && (
                <div className="p-3 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-text text-xs mb-3 shrink-0">
                  Nothing fell below 50% accuracy! You can pick any questions manually below to review.
                </div>
              )}

              <div className="flex items-center justify-between mb-2 shrink-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Select Questions ({selectedRetestIndexes.length} selected):
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedRetestIndexes(questionsToDisplay.map((q) => q.questionIndex))}
                    className="text-accent hover:underline font-semibold cursor-pointer"
                  >
                    Select all
                  </button>
                  <span className="text-border-strong">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRetestIndexes([])}
                    className="text-text-muted hover:text-text font-semibold cursor-pointer"
                  >
                    Select none
                  </button>
                  {hasFlagged && (
                    <>
                      <span className="text-border-strong">•</span>
                      <button
                        type="button"
                        onClick={() => setShowAllQuestionsInRetest((prev) => !prev)}
                        className="text-accent hover:underline font-semibold cursor-pointer"
                      >
                        {showAllQuestionsInRetest ? 'Flagged only' : 'All questions'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-y-auto space-y-2 mb-6 pr-1 flex-1">
                {questionsToDisplay.map((q) => {
                  const isSelected = selectedRetestIndexes.includes(q.questionIndex);
                  const accPct = Math.round((q.accuracy ?? 0) * 100);
                  return (
                    <label
                      key={q.questionIndex}
                      className={`flex flex-col p-3 rounded-[var(--radius-sm,4px)] border cursor-pointer text-xs transition ${
                        isSelected
                          ? 'bg-accent/10 border-accent text-text'
                          : 'bg-surface border-border text-text hover:bg-bg-subtle'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRetestIndexes((prev) => [...prev, q.questionIndex]);
                              } else {
                                setSelectedRetestIndexes((prev) => prev.filter((i) => i !== q.questionIndex));
                              }
                            }}
                            className="w-4 h-4 rounded text-accent accent-accent shrink-0"
                          />
                          <span className="truncate font-medium">{q.questionText}</span>
                        </div>
                        <span className={`font-mono text-xs font-bold shrink-0 ${accPct < 50 ? 'text-danger' : 'text-success'}`}>
                          {accPct}% acc
                        </span>
                      </div>
                      {q.topDistractorRationale && (
                        <div className="mt-1 pl-6 text-[11px] text-text-muted line-clamp-1">
                          Misconception: {q.topDistractorRationale}
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRetestModal(false)}
                  disabled={isRetestLoading}
                  className="px-4 py-2 bg-surface hover:bg-bg-subtle disabled:opacity-50 border border-border text-text font-semibold rounded-[var(--radius-sm,4px)] text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedRetestIndexes.length === 0 || isRetestLoading}
                  onClick={handleStartRetest}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-accent-foreground font-bold rounded-[var(--radius-sm,4px)] text-xs flex items-center gap-2 transition cursor-pointer"
                >
                  {isRetestLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Starting retest...</span>
                    </>
                  ) : (
                    <>
                      <span>Start retest ({selectedRetestIndexes.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Retest Results Modal */}
      {showRetestResultsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-[var(--radius-lg,8px)] p-6 max-w-lg w-full shadow-lg text-left max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4 shrink-0">
              <div className="flex items-center gap-2 text-text font-bold text-sm">
                <CheckCircle className="w-5 h-5 text-success" />
                <span>Retest Round Results</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRetestResultsModal(false)}
                className="text-text-muted hover:text-text text-xs font-bold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {endData?.retest?.headline && (
                <div className="p-3.5 bg-success/10 border border-success/30 rounded-[var(--radius-md,8px)] text-text text-xs font-semibold leading-relaxed">
                  {endData.retest.headline}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-4 bg-bg-subtle border border-border rounded-[var(--radius-md,8px)] text-center">
                  <span className="text-text-muted block mb-0.5">Before Accuracy</span>
                  <strong className="text-danger text-xl font-mono font-bold">
                    {Math.round((endData?.retest?.beforeAccuracy || 0) * 100)}%
                  </strong>
                </div>
                <div className="p-4 bg-bg-subtle border border-border rounded-[var(--radius-md,8px)] text-center">
                  <span className="text-text-muted block mb-0.5">After Retest</span>
                  <strong className="text-success text-xl font-mono font-bold">
                    {Math.round((endData?.retest?.afterAccuracy || 0) * 100)}%
                  </strong>
                </div>
              </div>

              {Array.isArray(endData?.retest?.perQuestion) && endData.retest.perQuestion.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                    Before vs. After per Question:
                  </span>
                  {endData.retest.perQuestion.map((q, idx) => (
                    <div key={idx} className="p-3 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-text line-clamp-2">{q.questionText}</span>
                        <span className={`font-mono text-xs font-bold shrink-0 ${q.improvementPct >= 0 ? 'text-success' : 'text-danger'}`}>
                          {q.improvementPct >= 0 ? `+${q.improvementPct}%` : `${q.improvementPct}%`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-text-muted">
                        <span>Before: {Math.round(q.beforeAccuracy * 100)}%</span>
                        <span>→</span>
                        <span>After: {Math.round(q.afterAccuracy * 100)}%</span>
                        {q.topicTag && <span className="ml-auto text-text-muted font-mono text-[10px]">{q.topicTag}</span>}
                      </div>
                      {q.topMisconception && (
                        <p className="text-[10px] text-text-muted pt-0.5">
                          Addressed: {q.topMisconception}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {Array.isArray(endData?.retest?.perTopic) && endData.retest.perTopic.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block">
                    Improvement per Topic:
                  </span>
                  {endData.retest.perTopic.map((t, idx) => (
                    <div key={idx} className="p-3 bg-bg-subtle border border-border rounded-[var(--radius-sm,4px)] text-xs flex items-center justify-between">
                      <span className="font-medium text-text">{t.topicTag}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted font-mono text-[11px]">
                          {Math.round(t.beforeAccuracy * 100)}% → {Math.round(t.afterAccuracy * 100)}%
                        </span>
                        <span className={`font-mono text-xs font-bold ${t.improvementPct >= 0 ? 'text-success' : 'text-danger'}`}>
                          {t.improvementPct >= 0 ? `+${t.improvementPct}%` : `${t.improvementPct}%`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-border flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowRetestResultsModal(false)}
                className="px-5 py-2 bg-surface hover:bg-bg-subtle border border-border text-text font-semibold rounded-[var(--radius-sm,4px)] text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Setup Modal */}
      {showGameSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-[var(--radius-lg,8px)] p-6 max-w-lg w-full shadow-lg text-left">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[var(--radius-sm,4px)] bg-accent/10 text-accent flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-text">Game Setup</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGameSetupModal(false)}
                className="p-1.5 rounded-[var(--radius-sm,4px)] text-text-muted hover:text-text hover:bg-bg-subtle transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5 text-sm">
              {/* Phone Option Text Setting */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  Student Phone Options
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSettings({
                        ...settings,
                        phoneOptionText: 'full'
                      })
                    }
                    className={`p-3 rounded-[var(--radius-md,8px)] border text-left transition flex flex-col gap-1 cursor-pointer ${
                      settings?.phoneOptionText !== 'letters'
                        ? 'bg-accent/10 border-accent text-text shadow-xs'
                        : 'bg-surface border-border text-text-muted hover:border-border-strong'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center justify-between">
                      Full Text (Default)
                      {settings?.phoneOptionText !== 'letters' && <Check className="w-3.5 h-3.5 text-accent" />}
                    </span>
                    <span className="text-[11px] text-text-muted leading-snug">
                      Question and all option texts rendered on student phones
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateSettings({
                        ...settings,
                        phoneOptionText: 'letters'
                      })
                    }
                    className={`p-3 rounded-[var(--radius-md,8px)] border text-left transition flex flex-col gap-1 cursor-pointer ${
                      settings?.phoneOptionText === 'letters'
                        ? 'bg-accent/10 border-accent text-text shadow-xs'
                        : 'bg-surface border-border text-text-muted hover:border-border-strong'
                    }`}
                  >
                    <span className="font-bold text-xs flex items-center justify-between">
                      Letters Only
                      {settings?.phoneOptionText === 'letters' && <Check className="w-3.5 h-3.5 text-accent" />}
                    </span>
                    <span className="text-[11px] text-text-muted leading-snug">
                      Shapes and letters only (students look up at the projector)
                    </span>
                  </button>
                </div>
              </div>

              {/* What students see at the end (finalLeaderboard) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
                  What students see at the end
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'full', label: 'Full', desc: 'All ranked players' },
                    { id: 'top10', label: 'Top 10', desc: 'Top 10 + own rank' },
                    { id: 'self', label: 'Self only', desc: 'Own rank only' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        handleUpdateSettings({
                          ...settings,
                          finalLeaderboard: mode.id
                        })
                      }
                      className={`p-2.5 rounded-[var(--radius-md,8px)] border text-left transition flex flex-col gap-0.5 cursor-pointer ${
                        (settings?.finalLeaderboard || 'full') === mode.id
                          ? 'bg-accent/10 border-accent text-text shadow-xs'
                          : 'bg-surface border-border text-text-muted hover:border-border-strong'
                      }`}
                    >
                      <span className="font-bold text-xs flex items-center justify-between">
                        {mode.label}
                        {(settings?.finalLeaderboard || 'full') === mode.id && (
                          <Check className="w-3 h-3 text-accent" />
                        )}
                      </span>
                      <span className="text-[10px] text-text-muted">{mode.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <button
                type="button"
                onClick={() => setShowGameSetupModal(false)}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-accent-foreground font-bold rounded-[var(--radius-sm,4px)] text-xs transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Docked Primary Action Button (Bottom-Right) - only in LOBBY, QUESTION_REVEAL, LEADERBOARD */}
      {pin && (status === 'LOBBY' || status === 'QUESTION_REVEAL' || status === 'LEADERBOARD') && (
        <button
          type="button"
          data-testid="host-primary-action-button"
          onClick={handlePrimaryAction}
          disabled={isActionLoading || (status === 'LOBBY' && connectedCount === 0)}
          style={{
            right: 'max(24px, env(safe-area-inset-right, 24px))',
            bottom: 'max(24px, env(safe-area-inset-bottom, 24px))'
          }}
          className={`fixed z-40 px-6 py-3.5 rounded-[var(--radius-md,8px)] font-bold text-sm md:text-base flex items-center gap-3 shadow-md transition-all duration-150 cursor-pointer ${
            presentMode && isInactive ? 'opacity-30' : 'opacity-100 hover:brightness-105 active:brightness-95'
          } bg-accent text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          <span>{getPrimaryActionLabel()}</span>
          <kbd className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-[var(--radius-sm,4px)] bg-black/20 text-white border border-white/20">
            Space
          </kbd>
        </button>
      )}
    </div>
  );
}
