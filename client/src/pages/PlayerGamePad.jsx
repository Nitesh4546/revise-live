import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext.jsx';
import { useWakeLock } from '../hooks/useWakeLock.js';
import { useCountdown } from '../hooks/useCountdown.js';
import CountdownTimer from '../components/CountdownTimer.jsx';
import { TILE_CONFIG } from '../components/AnswerTile.jsx';
import Bar from '../components/ui/Bar.jsx';
import ConnectionBanner from '../components/ConnectionBanner.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import {
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  Clock,
  Users,
  ArrowLeft,
  Check,
  AlertTriangle,
  Radio
} from 'lucide-react';
import FinalLeaderboard from '../components/FinalLeaderboard.jsx';

export default function PlayerGamePad() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { socket, connected } = useSocket();

  // Wake lock keeps mobile screen awake during class session
  useWakeLock(true);

  const urlPin = searchParams.get('pin') || '';

  // Retrieve player session scoped by PIN
  const [playerSession] = useState(() => {
    if (urlPin) {
      const raw = localStorage.getItem(`reviselive:player:${urlPin}`);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
    }
    // Fallback: search for any stored reviselive:player:*
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reviselive:player:')) {
        try {
          return JSON.parse(localStorage.getItem(key));
        } catch {}
      }
    }
    return null;
  });

  const pin = urlPin || playerSession?.pin || '';
  const playerId = playerSession?.playerId || '';
  const reconnectToken = playerSession?.reconnectToken || '';
  const [name, setName] = useState(() => playerSession?.name || 'Student');

  const [status, setStatus] = useState('LOBBY'); // LOBBY, QUESTION_ACTIVE, DISCUSSION, REVOTE, QUESTION_REVEAL, LEADERBOARD, FINISHED
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isLockedIn, setIsLockedIn] = useState(false);
  const [confidence, setConfidence] = useState(null); // 1: Guessing, 2: Fairly sure, 3: Certain
  const [revealData, setRevealData] = useState(null);

  // Discussion & Revote state (C3)
  const [discussionData, setDiscussionData] = useState(null);
  const [revoteData, setRevoteData] = useState(null);
  const [revoteSelected, setRevoteSelected] = useState(null);
  const [revoteLocked, setRevoteLocked] = useState(false);

  // Result state
  const [resultData, setResultData] = useState(null);

  // Leaderboard personal state
  const [personalRank, setPersonalRank] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Finished state & Receipt (C6)
  const [finalData, setFinalData] = useState(null);
  const [receiptToken, setReceiptToken] = useState(() => localStorage.getItem('reviselive:lastReceipt') || null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [exitReason, setExitReason] = useState(null); // 'kicked' | 'room_closed'
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Cached final leaderboard data (F2)
  const [finalLeaderboardData, setFinalLeaderboardData] = useState(() => {
    if (urlPin) {
      const raw = localStorage.getItem(`reviselive:final:${urlPin}`);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reviselive:final:')) {
        try {
          return JSON.parse(localStorage.getItem(key));
        } catch {}
      }
    }
    return null;
  });

  // Display option controls (phoneOptionText)
  const [phoneOptionText, setPhoneOptionText] = useState('full'); // 'full' | 'letters'

  // Question metadata
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [totalQCount, setTotalQCount] = useState(1);
  const [timeLimit, setTimeLimit] = useState(20);
  const [discussionTimeLimit, setDiscussionTimeLimit] = useState(60);
  const activeTimeLimit = status === 'DISCUSSION' ? discussionTimeLimit : timeLimit;

  // Countdown timers
  const { secondsLeft: questionSecondsLeft } = useCountdown(
    currentQuestion?.endsAt,
    currentQuestion?.serverNow,
    currentQuestion?.timeLimit || timeLimit || 20
  );
  const { secondsLeft: discussionSecondsLeft } = useCountdown(
    discussionData?.endsAt,
    discussionData?.serverNow,
    discussionData?.seconds || discussionTimeLimit || 60
  );
  const { secondsLeft: revoteSecondsLeft } = useCountdown(
    revoteData?.endsAt,
    revoteData?.serverNow,
    revoteData?.seconds || 15
  );

  const secondsLeft =
    status === 'DISCUSSION'
      ? discussionSecondsLeft
      : status === 'REVOTE'
      ? revoteSecondsLeft
      : questionSecondsLeft;

  const clearSession = () => {
    if (pin) {
      localStorage.removeItem(`reviselive:player:${pin}`);
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reviselive:player:')) {
        localStorage.removeItem(key);
      }
    }
  };

  // Reconnection logic
  useEffect(() => {
    if (!socket) return;

    if (finalLeaderboardData && !playerSession) {
      setStatus('FINISHED');
      return;
    }

    if (!pin || !playerId) {
      if (finalLeaderboardData) {
        setStatus('FINISHED');
      } else {
        navigate('/join');
      }
      return;
    }

    if (connected && reconnectToken) {
      socket.emit('player:reconnect', { pin, playerId, reconnectToken }, (res) => {
        if (!res?.ok) {
          console.warn('Player reconnection failed:', res?.error?.message);
        } else if (res.data?.state) {
          const s = res.data.state;
          if (s.name) setName(s.name);
          if (typeof s.score === 'number') setScore(s.score);
          if (typeof s.streak === 'number') setStreak(s.streak);

          if (s.status === 'QUESTION_ACTIVE' && s.question) {
            const endsAt = s.endsAt || Date.now() + (s.secondsLeft || s.timeLimit || 20) * 1000;
            const serverNow = s.serverNow || Date.now();
            setCurrentQuestion({
              ...s.question,
              endsAt,
              serverNow,
              timeLimit: s.timeLimit || 20
            });
            setCurrentQIndex(s.questionIndex || 0);
            setTotalQCount(s.totalQuestions || 1);
            setTimeLimit(s.timeLimit || 20);
            setPhoneOptionText(s.phoneOptionText || 'full');
            if (s.alreadyAnswered) {
              setSelectedAnswer(s.selectedAnswer);
              setIsLockedIn(true);
            } else {
              setSelectedAnswer(null);
              setIsLockedIn(false);
            }
            setStatus('QUESTION_ACTIVE');
          } else if (s.status === 'FINISHED') {
            setStatus('FINISHED');
            if (s.finalLeaderboard) {
              setFinalLeaderboardData({
                leaderboard: s.finalLeaderboard,
                you: s.you,
                totalPlayers: s.totalPlayers,
                receiptToken: s.receiptToken
              });
            }
          }
        }
      });
    }
  }, [connected, socket, pin, playerId, reconnectToken, navigate, finalLeaderboardData, playerSession]);

  // Back-button guard (popstate trap)
  useEffect(() => {
    window.history.pushState({ page: 'gamepad' }, '');

    const handlePopState = (e) => {
      e.preventDefault();
      window.history.pushState({ page: 'gamepad' }, '');
      setShowLeaveDialog(true);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleQuestionStart = (data) => {
      const endsAt = data.endsAt || Date.now() + (data.timeLimit || 20) * 1000;
      const serverNow = data.serverNow || Date.now();
      setCurrentQuestion({
        questionText: data.questionText,
        options: data.options,
        topicTag: data.topicTag,
        round: data.round || 'main',
        endsAt,
        serverNow,
        timeLimit: data.timeLimit || 20
      });
      setCurrentQIndex(data.questionIndex ?? 0);
      setTotalQCount(data.totalQuestions ?? 1);
      setTimeLimit(data.timeLimit ?? 20);
      setPhoneOptionText(data.phoneOptionText || 'full');

      setSelectedAnswer(null);
      setIsLockedIn(false);
      setConfidence(null);
      setRevealData(null);
      setResultData(null);
      setDiscussionData(null);
      setRevoteData(null);
      setRevoteSelected(null);
      setRevoteLocked(false);

      setStatus('QUESTION_ACTIVE');
    };

    const handleDiscussionStart = (data) => {
      const endsAt = data.endsAt || Date.now() + (data.timeLimit || data.seconds || 60) * 1000;
      const serverNow = data.serverNow || Date.now();
      setDiscussionData({
        ...data,
        endsAt,
        serverNow,
        seconds: data.timeLimit || data.seconds || 60
      });
      setDiscussionTimeLimit(data.timeLimit || data.seconds || 60);
      setStatus('DISCUSSION');
    };

    const handleRevoteStart = (data) => {
      const endsAt = data.endsAt || Date.now() + (data.timeLimit || data.seconds || 15) * 1000;
      const serverNow = data.serverNow || Date.now();
      setRevoteData({
        ...data,
        endsAt,
        serverNow,
        seconds: data.timeLimit || data.seconds || 15
      });
      setTimeLimit(data.timeLimit ?? 15);
      setRevoteSelected(null);
      setRevoteLocked(false);
      setStatus('REVOTE');
    };

    const handleQuestionReveal = (data) => {
      setRevealData(data);
      setStatus('QUESTION_REVEAL');
    };

    const handlePlayerResult = (data) => {
      setResultData(data);
      if (typeof data.totalScore === 'number') setScore(data.totalScore);
      if (typeof data.streak === 'number') setStreak(data.streak);
      if (typeof data.rank === 'number') setPersonalRank(data.rank);
      setStatus('QUESTION_REVEAL');
    };

    const handleLeaderboardUpdate = (data) => {
      if (data.you) {
        if (typeof data.you.rank === 'number') setPersonalRank(data.you.rank);
        if (typeof data.you.score === 'number') setScore(data.you.score);
        if (typeof data.you.streak === 'number') setStreak(data.you.streak);
      }
      setStatus('LEADERBOARD');
    };

    const handleGameEnded = (data) => {
      setFinalData(data);
      if (data.receiptToken) {
        setReceiptToken(data.receiptToken);
        localStorage.setItem('reviselive:lastReceipt', data.receiptToken);
      }
      if (data.finalLeaderboard) {
        const cachedPayload = {
          leaderboard: data.finalLeaderboard,
          you: data.you || { rank: data.rank, score: data.score },
          totalPlayers: data.totalPlayers || data.finalLeaderboard.length,
          receiptToken: data.receiptToken,
          retestData: data.retestData
        };
        setFinalLeaderboardData(cachedPayload);
        if (pin) {
          localStorage.setItem(`reviselive:final:${pin}`, JSON.stringify(cachedPayload));
        }
      }
      setStatus('FINISHED');
    };

    const handleRetestStart = () => {
      setStatus('QUESTION_ACTIVE');
    };

    const handleKicked = () => {
      setExitReason('kicked');
      clearSession();
    };

    const handleRoomClosed = () => {
      setExitReason('room_closed');
      clearSession();
    };

    socket.on('game:question-start', handleQuestionStart);
    socket.on('game:discussion-start', handleDiscussionStart);
    socket.on('game:revote-start', handleRevoteStart);
    socket.on('game:question-reveal', handleQuestionReveal);
    socket.on('player:result', handlePlayerResult);
    socket.on('game:leaderboard-update', handleLeaderboardUpdate);
    socket.on('game:ended', handleGameEnded);
    socket.on('player:game-ended', handleGameEnded);
    socket.on('game:retest-start', handleRetestStart);
    socket.on('player:kicked', handleKicked);
    socket.on('room:closed', handleRoomClosed);

    return () => {
      socket.off('game:question-start', handleQuestionStart);
      socket.off('game:discussion-start', handleDiscussionStart);
      socket.off('game:revote-start', handleRevoteStart);
      socket.off('game:question-reveal', handleQuestionReveal);
      socket.off('player:result', handlePlayerResult);
      socket.off('game:leaderboard-update', handleLeaderboardUpdate);
      socket.off('game:ended', handleGameEnded);
      socket.off('player:game-ended', handleGameEnded);
      socket.off('game:retest-start', handleRetestStart);
      socket.off('player:kicked', handleKicked);
      socket.off('room:closed', handleRoomClosed);
    };
  }, [socket, navigate, pin]);

  // Submit Answer
  const handleSelectAnswer = (index) => {
    if (isLockedIn || status !== 'QUESTION_ACTIVE') return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch {}
    }

    setSelectedAnswer(index);
    setIsLockedIn(true);

    socket.emit('player:submit-answer', { pin, selectedIndex: index }, (res) => {
      if (!res.ok) {
        alert(res.error?.message || 'Answer submission failed.');
      }
    });
  };

  // Set confidence calibration level 1-3 (C2)
  const handleSetConfidence = (level) => {
    if (confidence !== null || !pin) return;
    setConfidence(level);
    socket.emit('player:set-confidence', { pin, level }, (res) => {
      if (!res?.ok) console.error('Failed to set confidence');
    });
  };

  // Submit revote answer during Peer Instruction (C3)
  const handleSelectRevote = (index) => {
    if (revoteLocked || status !== 'REVOTE' || !pin) return;
    setRevoteSelected(index);
    setRevoteLocked(true);
    socket.emit('player:submit-revote', { pin, selectedIndex: index }, (res) => {
      if (!res?.ok) console.error('Failed to submit revote');
    });
  };

  const handleCopyReceiptLink = () => {
    if (!receiptToken) return;
    const url = `${window.location.origin}/r/${receiptToken}`;
    navigator.clipboard.writeText(url);
    setCopiedReceipt(true);
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const confirmLeaveGame = () => {
    if (socket && pin) {
      socket.emit('player:leave', { pin, playerId });
    }
    clearSession();
    setShowLeaveDialog(false);
    navigate('/');
  };

  const handleExitToHome = () => {
    clearSession();
    navigate('/');
  };

  if (status === 'FINISHED' && !exitReason) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col justify-start touch-action-manipulation select-none">
        <ConnectionBanner />
        <FinalLeaderboard
          pin={pin}
          you={finalLeaderboardData?.you || finalData || { rank: personalRank, score }}
          totalPlayers={finalLeaderboardData?.totalPlayers || 1}
          leaderboard={finalLeaderboardData?.leaderboard || []}
          receiptToken={finalLeaderboardData?.receiptToken || receiptToken}
          retestData={finalLeaderboardData?.retestData}
          onExit={handleExitToHome}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between touch-action-manipulation select-none">
      <ConnectionBanner />

      {/* Top Mobile Bar - Pinned Header */}
      <header className="px-3 sm:px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2 shrink-0">
          {!exitReason && (
            <button
              type="button"
              onClick={() => setShowLeaveDialog(true)}
              aria-label="Leave game"
              title="Leave game"
              className="p-1.5 rounded bg-bg-subtle hover:bg-danger/10 text-text-muted hover:text-danger border border-border transition cursor-pointer flex items-center gap-1 text-xs font-semibold min-h-[36px] min-w-[36px]"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden xs:inline">Leave</span>
            </button>
          )}
          <span className="font-semibold text-sm text-text truncate max-w-[90px] sm:max-w-[130px]">
            {name}
          </span>
          {streak > 1 && (
            <span className="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30 text-[10px] font-bold flex items-center gap-0.5">
              <Flame className="w-3 h-3 fill-current" />
              {streak}
            </span>
          )}
        </div>

        {/* Center: Question Progress */}
        {['QUESTION_ACTIVE', 'DISCUSSION', 'REVOTE', 'QUESTION_REVEAL'].includes(status) && (
          <div className="flex flex-col items-center px-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-accent font-mono">
              {currentQuestion?.round === 'retest' ? 'Retest Q' : 'Q'}{' '}
              {Number(currentQIndex) + 1} of {totalQCount}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {['QUESTION_ACTIVE', 'DISCUSSION', 'REVOTE'].includes(status) && (
            <CountdownTimer
              secondsLeft={secondsLeft}
              totalSeconds={activeTimeLimit}
              size={36}
            />
          )}
          <span className="text-xs font-semibold text-text-muted font-mono">
            {score.toLocaleString()} pts
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Mobile Display */}
      <main className="flex-1 flex flex-col p-3 sm:p-4 w-full max-w-md mx-auto justify-start overflow-y-auto overflow-x-hidden">
        {exitReason ? (
          <div className="py-8 max-w-sm mx-auto text-center w-full my-auto">
            <div className="bg-surface border border-border rounded-lg p-6 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-danger/15 text-danger flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-text mb-2">
                {exitReason === 'kicked' ? 'Removed from Game' : 'Session Ended'}
              </h2>
              <p className="text-xs text-text-muted mb-6 leading-relaxed">
                {exitReason === 'kicked'
                  ? 'You were removed from this session by the host.'
                  : 'The teacher has closed or concluded this session.'}
              </p>

              {receiptToken && (
                <div className="p-4 mb-6 bg-accent/10 border border-accent/20 rounded text-left">
                  <span className="text-[10px] uppercase font-bold text-accent block mb-1">
                    Your Revision Receipt
                  </span>
                  <div className="flex gap-2">
                    <Link
                      to={`/r/${receiptToken}`}
                      className="flex-1 py-2 bg-accent hover:bg-accent/90 text-accent-fg font-semibold rounded text-xs text-center transition"
                    >
                      Open Receipt
                    </Link>
                    <button
                      type="button"
                      onClick={handleCopyReceiptLink}
                      className="px-3 py-2 bg-bg-subtle hover:bg-surface border border-border text-text text-xs font-semibold rounded transition cursor-pointer"
                    >
                      {copiedReceipt ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    navigate('/join');
                  }}
                  className="flex-1 py-2.5 bg-accent hover:bg-accent/90 text-accent-fg font-semibold rounded text-xs transition cursor-pointer"
                >
                  Join Another Game
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSession();
                    navigate('/');
                  }}
                  className="flex-1 py-2.5 bg-bg-subtle hover:bg-surface border border-border text-text font-semibold rounded text-xs transition cursor-pointer"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        ) : status === 'LOBBY' ? (
          /* ==========================================
             1. WAITING LOBBY
             ========================================== */
          <div className="text-center py-12 my-auto">
            <div className="w-16 h-16 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-4 text-accent">
              <Radio className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text mb-2">You&apos;re in!</h1>
            <p className="text-text-muted text-sm mb-6 max-w-xs mx-auto">
              See your nickname on the screen? Hang tight, the quiz is about to start.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded bg-bg-subtle border border-border text-xs font-mono text-text">
              <span className="text-text-muted">PIN:</span>
              <strong className="text-accent text-base tracking-wider">{pin}</strong>
            </div>
          </div>
        ) : status === 'QUESTION_ACTIVE' ? (
          /* ==========================================
             2. ACTIVE QUESTION SCREEN (Readable Cards)
             ========================================== */
          <div className="flex-1 flex flex-col justify-between py-1 w-full gap-3">
            {/* Question Card */}
            <div className="w-full bg-surface border border-border rounded-lg p-4 shadow-sm text-left">
              {currentQuestion?.topicTag && (
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded mb-2">
                  {currentQuestion.topicTag}
                </span>
              )}
              <h2 className="text-base sm:text-lg font-bold text-text leading-snug break-words whitespace-normal font-sans">
                {currentQuestion?.questionText}
              </h2>
            </div>

            {/* 4 Stacked Option Cards */}
            <div className="flex flex-col gap-2 w-full">
              {TILE_CONFIG.map((tile, idx) => {
                const Shape = tile.ShapeIcon;
                const optText = currentQuestion?.options?.[idx] || '';
                const isSelected = selectedAnswer === idx;
                const isLocked = isLockedIn;

                let cardClasses = `${tile.bgColor} ${tile.textColor}`;
                if (isLocked) {
                  if (isSelected) {
                    cardClasses += ' ring-4 ring-white shadow-lg';
                  } else {
                    cardClasses = 'bg-surface border-border text-text-muted opacity-30';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSelectAnswer(idx)}
                    aria-label={`Option ${tile.letter} (${tile.shapeName})${phoneOptionText !== 'letters' && optText ? ': ' + optText : ''}`}
                    className={`w-full min-h-[56px] rounded-lg p-3 flex items-center gap-3 transition-all duration-150 select-none border text-left ${cardClasses} ${
                      !isLocked ? `${tile.hoverBg} ${tile.activeBg} active:scale-[0.99] cursor-pointer` : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold shadow-sm ${tile.letterChipBg}`}>
                        {tile.letter}
                      </span>
                      <span className={`w-4 h-4 flex items-center justify-center ${tile.shapeFill}`}>
                        <Shape className="w-4 h-4" />
                      </span>
                    </div>
                    {phoneOptionText !== 'letters' && (
                      <span className="font-medium text-sm sm:text-base text-left flex-1 break-words whitespace-normal leading-snug">
                        {optText}
                      </span>
                    )}
                    {isSelected && isLocked && (
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-white flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Locked in</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Confidence Calibration Bar */}
            {isLockedIn && (
              <div className="sticky bottom-0 z-20 w-full pt-2 pb-safe bg-surface/95 backdrop-blur-sm border-t border-border mt-auto">
                <div className="bg-bg-subtle border border-border rounded-lg p-3">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2 text-center">
                    {confidence === null ? 'How confident are you in this answer?' : 'Confidence recorded!'}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={confidence !== null}
                      onClick={() => handleSetConfidence(1)}
                      className={`min-h-[44px] py-2 px-1 rounded text-xs font-semibold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        confidence === 1
                          ? 'bg-warning text-warning-fg ring-2 ring-warning'
                          : confidence !== null
                          ? 'opacity-40 bg-surface text-text-muted'
                          : 'bg-surface hover:bg-surface/80 text-text border border-border'
                      }`}
                    >
                      <span>🎲 Guessing</span>
                    </button>
                    <button
                      type="button"
                      disabled={confidence !== null}
                      onClick={() => handleSetConfidence(2)}
                      className={`min-h-[44px] py-2 px-1 rounded text-xs font-semibold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        confidence === 2
                          ? 'bg-accent text-accent-fg ring-2 ring-accent'
                          : confidence !== null
                          ? 'opacity-40 bg-surface text-text-muted'
                          : 'bg-surface hover:bg-surface/80 text-text border border-border'
                      }`}
                    >
                      <span>👍 Fairly sure</span>
                    </button>
                    <button
                      type="button"
                      disabled={confidence !== null}
                      onClick={() => handleSetConfidence(3)}
                      className={`min-h-[44px] py-2 px-1 rounded text-xs font-semibold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        confidence === 3
                          ? 'bg-success text-success-fg ring-2 ring-success'
                          : confidence !== null
                          ? 'opacity-40 bg-surface text-text-muted'
                          : 'bg-surface hover:bg-surface/80 text-text border border-border'
                      }`}
                    >
                      <span>🎯 Certain</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : status === 'DISCUSSION' ? (
          /* ==========================================
             2B. PEER INSTRUCTION DISCUSSION (C3)
             ========================================== */
          <div className="flex-1 flex flex-col py-1 w-full gap-3">
            <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-accent text-xs font-bold uppercase tracking-wider mb-1">
                <Users className="w-4 h-4" />
                <span>Peer Instruction</span>
              </div>
              <h3 className="text-sm font-bold text-text mb-0.5">Convince a Neighbour!</h3>
              <p className="text-xs text-text-muted">
                Turn to someone who chose differently. Explain your reasoning and listen to theirs!
              </p>
            </div>

            {/* Question Card */}
            <div className="w-full bg-surface border border-border rounded-lg p-4 shadow-sm text-left">
              <h2 className="text-base sm:text-lg font-bold text-text leading-snug break-words whitespace-normal">
                {discussionData?.questionText || currentQuestion?.questionText}
              </h2>
            </div>

            {/* 4 Stacked Option Cards with Distribution */}
            <div className="flex flex-col gap-2 w-full">
              {TILE_CONFIG.map((tile, idx) => {
                const Shape = tile.ShapeIcon;
                const optText = (discussionData?.options || currentQuestion?.options)?.[idx] || '';
                const count = discussionData?.distribution?.[idx] || 0;
                const total = (discussionData?.distribution || []).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                const wasMyChoice = selectedAnswer === idx;

                return (
                  <div
                    key={idx}
                    className={`w-full min-h-[56px] rounded-lg p-3 flex flex-col gap-2 border select-none ${
                      tile.bgColor
                    } ${tile.textColor} ${wasMyChoice ? 'ring-2 ring-white shadow-md' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold shadow-sm ${tile.letterChipBg}`}>
                          {tile.letter}
                        </span>
                        <Shape className="w-4 h-4 shrink-0" />
                      </div>
                      {phoneOptionText !== 'letters' && (
                        <span className="font-medium text-sm sm:text-base text-left flex-1 break-words whitespace-normal leading-snug">
                          {optText}
                        </span>
                      )}
                      {wasMyChoice && (
                        <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-white">
                          Your answer
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold shrink-0">
                        {pct}%
                      </span>
                    </div>

                    <Bar
                      value={count}
                      max={total}
                      orientation="horizontal"
                      color="bg-white/80"
                      trackClassName="w-full h-1.5 rounded-full bg-black/20"
                      fillClassName="rounded-full"
                      showTrackBorder={false}
                    />
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-muted text-center animate-pulse mt-1">Re-vote starting shortly...</p>
          </div>
        ) : status === 'REVOTE' ? (
          /* ==========================================
             2C. RE-VOTE PHASE (C3)
             ========================================== */
          <div className="flex-1 flex flex-col justify-between py-1 w-full gap-3">
            <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-center">
              <span className="text-[11px] font-bold uppercase tracking-widest text-success">
                Re-vote Phase
              </span>
              <p className="text-xs text-text-muted mt-0.5">
                {revoteLocked ? 'Revote submitted! Waiting for reveal...' : 'Did discussion change your mind? Confirm or switch!'}
              </p>
            </div>

            {/* Question Card */}
            <div className="w-full bg-surface border border-border rounded-lg p-4 shadow-sm text-left">
              <h2 className="text-base sm:text-lg font-bold text-text leading-snug break-words whitespace-normal">
                {revoteData?.questionText || currentQuestion?.questionText}
              </h2>
            </div>

            {/* 4 Stacked Option Cards for Revote */}
            <div className="flex flex-col gap-2 w-full">
              {TILE_CONFIG.map((tile, idx) => {
                const Shape = tile.ShapeIcon;
                const optText = (revoteData?.options || currentQuestion?.options)?.[idx] || '';
                const isSelected = revoteSelected === idx;
                const isLocked = revoteLocked;

                let cardClasses = `${tile.bgColor} ${tile.textColor}`;
                if (isLocked) {
                  if (isSelected) {
                    cardClasses += ' ring-4 ring-white shadow-lg';
                  } else {
                    cardClasses = 'bg-surface border-border text-text-muted opacity-30';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isLocked}
                    onClick={() => handleSelectRevote(idx)}
                    aria-label={`Option ${tile.letter} (${tile.shapeName})${phoneOptionText !== 'letters' && optText ? ': ' + optText : ''}`}
                    className={`w-full min-h-[56px] rounded-lg p-3 flex items-center gap-3 transition-all duration-150 select-none border text-left ${cardClasses} ${
                      !isLocked ? `${tile.hoverBg} ${tile.activeBg} active:scale-[0.99] cursor-pointer` : 'cursor-default'
                    }`}
                  >
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold shadow-sm ${tile.letterChipBg}`}>
                        {tile.letter}
                      </span>
                      <span className={`w-4 h-4 flex items-center justify-center ${tile.shapeFill}`}>
                        <Shape className="w-4 h-4" />
                      </span>
                    </div>
                    {phoneOptionText !== 'letters' && (
                      <span className="font-medium text-sm sm:text-base text-left flex-1 break-words whitespace-normal leading-snug">
                        {optText}
                      </span>
                    )}
                    {isSelected && isLocked && (
                      <span className="shrink-0 text-xs font-bold px-2 py-0.5 rounded bg-white/20 text-white flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>Revote locked</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : status === 'QUESTION_REVEAL' ? (
          /* ==========================================
             3. RESULT SCREEN (Readable Cards with Reveal States)
             ========================================== */
          <div className="flex-1 flex flex-col py-1 w-full gap-3 text-left">
            {resultData ? (
              <>
                {/* Result banner */}
                <div
                  className={`rounded-lg p-4 border flex items-center justify-between ${
                    resultData.isCorrect
                      ? 'bg-success/10 border-success/30 text-success'
                      : 'bg-danger/10 border-danger/30 text-danger'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {resultData.isCorrect ? (
                      <div className="w-9 h-9 rounded-full bg-success/20 text-success flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-danger/20 text-danger flex items-center justify-center shrink-0">
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold leading-tight">
                        {resultData.isCorrect ? 'Correct!' : 'Incorrect'}
                      </h3>
                      {resultData.recovered && (
                        <span className="text-[11px] font-semibold text-accent">
                          Recovered! +500 discussion bonus
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base sm:text-lg font-bold font-mono text-text block">
                      +{resultData.pointsAwarded + (resultData.streakBonus || 0)} pts
                    </span>
                    {resultData.streakBonus > 0 && (
                      <span className="text-[10px] font-semibold text-warning">
                        Streak: +{resultData.streakBonus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Card */}
                <div className="w-full bg-surface border border-border rounded-lg p-4 shadow-sm text-left">
                  <h2 className="text-base sm:text-lg font-bold text-text leading-snug break-words whitespace-normal">
                    {currentQuestion?.questionText}
                  </h2>
                </div>

                {/* 4 Stack Option Cards with Reveal States */}
                <div className="flex flex-col gap-2 w-full">
                  {TILE_CONFIG.map((tile, idx) => {
                    const Shape = tile.ShapeIcon;
                    const optText = currentQuestion?.options?.[idx] || '';
                    const isCorrect = revealData?.correctIndex === idx;
                    const wasStudentChoice = resultData.chosenIndex === idx;

                    let cardClasses = 'bg-surface border-border text-text-muted';
                    if (isCorrect) {
                      cardClasses = 'bg-success/15 border-2 border-success text-text shadow-sm';
                    } else if (wasStudentChoice && !isCorrect) {
                      cardClasses = 'bg-danger/15 border-2 border-danger text-text';
                    }

                    return (
                      <div key={idx} className="flex flex-col gap-1 w-full">
                        <div
                          className={`w-full min-h-[56px] rounded-lg p-3 flex items-center gap-3 border select-none ${cardClasses}`}
                        >
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold shadow-sm ${
                                isCorrect ? 'bg-success text-success-fg' : tile.letterChipBg
                              }`}
                            >
                              {tile.letter}
                            </span>
                            <Shape className="w-4 h-4 shrink-0" />
                          </div>

                          {phoneOptionText !== 'letters' && (
                            <span className="font-medium text-sm sm:text-base text-left flex-1 break-words whitespace-normal leading-snug">
                              {optText}
                            </span>
                          )}

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCorrect && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-success/20 text-success border border-success/30">
                                Correct ✓
                              </span>
                            )}
                            {wasStudentChoice && (
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  isCorrect
                                    ? 'bg-success/20 text-success'
                                    : 'bg-danger/20 text-danger border border-danger/30'
                                }`}
                              >
                                Your choice {isCorrect ? '✓' : '✗'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Misconception Rationale right below chosen distractor */}
                        {wasStudentChoice && !isCorrect && resultData.chosenRationale && (
                          <div className="p-3 bg-warning/10 border border-warning/30 text-text rounded text-xs text-left ml-2">
                            <span className="font-bold text-warning block mb-0.5 uppercase text-[10px] tracking-wider">
                              Misconception Insight
                            </span>
                            <p>{resultData.chosenRationale}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Concept Anchor */}
                {(resultData.conceptAnchor || revealData?.explanation) && (
                  <div className="p-4 bg-surface border border-border rounded-lg text-left">
                    <span className="text-[10px] uppercase font-bold text-accent block mb-1">
                      Concept Anchor
                    </span>
                    <p className="text-xs sm:text-sm text-text-muted leading-relaxed break-words">
                      {resultData.conceptAnchor || revealData?.explanation}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 bg-surface border border-border rounded-lg text-center">
                <Clock className="w-8 h-8 text-text-muted animate-spin mx-auto mb-3" />
                <h3 className="text-base sm:text-lg font-bold text-text">Question Ended</h3>
                <p className="text-xs text-text-muted mt-1">Look up at the board for the Concept Anchor explanation!</p>
              </div>
            )}
          </div>
        ) : status === 'LEADERBOARD' ? (
          /* ==========================================
             4. LEADERBOARD SCREEN (PERSONAL RANK)
             ========================================== */
          <div className="text-center py-8">
            <div className="w-full bg-surface border border-border rounded-lg p-6 sm:p-8 shadow-sm">
              <div className="w-12 h-12 rounded-lg bg-accent/15 text-accent flex items-center justify-center mx-auto mb-3">
                <Trophy className="w-6 h-6" />
              </div>
              <span className="text-xs uppercase font-bold text-text-muted tracking-wider">
                Your Standing
              </span>
              <div className="text-4xl sm:text-5xl font-bold text-text font-mono my-2">
                #{personalRank || '—'}
              </div>
              <div className="text-base sm:text-lg font-bold text-accent font-mono mb-4">
                {score.toLocaleString()} points
              </div>
              <p className="text-xs text-text-muted">
                Watch the board to see the top 5! Next question starting soon.
              </p>
            </div>
          </div>
        ) : null}
      </main>

      {/* Confirm Leave Game Dialog */}
      {showLeaveDialog && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg p-6 max-w-sm w-full shadow-lg text-center">
            <div className="w-10 h-10 rounded-full bg-danger/15 text-danger flex items-center justify-center mx-auto mb-3">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-text mb-2">Leave this game?</h3>
            <p className="text-xs text-text-muted leading-relaxed mb-6">
              Your score so far stays on the leaderboard, but you won&apos;t be able to rejoin this seat.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveDialog(false)}
                className="flex-1 py-2.5 bg-bg-subtle hover:bg-surface border border-border text-text font-semibold rounded text-xs transition cursor-pointer"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmLeaveGame}
                className="flex-1 py-2.5 bg-danger hover:bg-danger/90 text-danger-fg font-semibold rounded text-xs transition cursor-pointer"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Footer Status */}
      <footer className="px-4 py-2 bg-surface border-t border-border text-center text-[11px] text-text-muted">
        ReviseLive Mobile Controller
      </footer>
    </div>
  );
}
