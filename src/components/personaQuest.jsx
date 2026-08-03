import React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { ArrowLeft, Check, Share2, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import { RitualStarfield, RitualSigil, SoulCard, SoulStarMap } from './soulVisuals.jsx';

/* ============================================================
   灵魂仪式（全屏）
   summon → quiz → weaving → reveal
   题目由后端按用户真实数据现场生成，答案作为最高权重证据回灌。
   ============================================================ */

const WEAVING_LINES = [
  '正在把你按下去的那几张牌摊开…',
  '在你的歌单里找矛盾点…',
  '把评论里的语气和选择对齐…',
  '给情绪光谱调色…',
  '正在写那句你不太想承认的话…',
  '牌面重排完成，准备翻面。'
];

/* --------------------------------- 局部原子 --------------------------------- */

function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={[
            'h-1.5 rounded-full transition-all duration-500 ease-soft',
            index < current ? 'w-6 bg-accent-sky/80' : index === current ? 'w-8 bg-paper/85' : 'w-1.5 bg-white/20'
          ].join(' ')}
        />
      ))}
    </div>
  );
}

function ChoiceCard({ option, picked, disabled, accent, onPick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(option)}
      style={{ '--pick': accent }}
      className={[
        'ritual-choice group flex min-h-[112px] flex-1 flex-col items-start gap-2 p-5 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/70',
        picked ? 'ritual-choice--picked' : '',
        disabled && !picked ? 'opacity-45' : ''
      ].join(' ')}
    >
      <span
        className="text-xl leading-none transition-transform duration-300 ease-spring group-hover:scale-110"
        style={{ color: accent }}
        aria-hidden="true"
      >
        {option.glyph}
      </span>
      <strong className="relative text-[0.95rem] font-bold leading-snug text-paper">{option.label}</strong>
      {option.sub ? (
        <span className="relative text-[0.78rem] leading-relaxed text-paper-dim">{option.sub}</span>
      ) : null}
    </button>
  );
}

/* --------------------------------- 主组件 --------------------------------- */

export function PersonaQuest({
  onSubmit,
  onRetryQuiz,
  onViewReport,
  onOpenShare,
  report,
  userName = ''
}) {
  const phase = useAppStore((s) => s.ritualPhase);
  const setPhase = useAppStore((s) => s.setRitualPhase);
  const quiz = useAppStore((s) => s.ritualQuiz);
  const step = useAppStore((s) => s.ritualStep);
  const setStep = useAppStore((s) => s.setRitualStep);
  const answers = useAppStore((s) => s.ritualAnswers);
  const setAnswers = useAppStore((s) => s.setRitualAnswers);
  const error = useAppStore((s) => s.ritualError);
  const resetRitual = useAppStore((s) => s.resetRitual);

  const [picked, setPicked] = useState(null);
  const [exiting, setExiting] = useState(false);
  const [dial, setDial] = useState(50);
  const [word, setWord] = useState('');
  const [weaveIndex, setWeaveIndex] = useState(0);
  const timers = useRef([]);

  const open = phase !== 'idle';
  const questions = useMemo(() => (Array.isArray(quiz?.questions) ? quiz.questions : []), [quiz]);
  const question = questions[step] || null;
  const palette = report?.soulCard?.palette || ['#6fc7ff', '#bf5af2', '#ff7da8'];

  const pushTimer = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  };

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  // 切题时重置局部输入态
  useEffect(() => {
    setPicked(null);
    setExiting(false);
    setDial(Number.isFinite(question?.defaultValue) ? question.defaultValue : 50);
    setWord('');
  }, [step, question?.id, question?.defaultValue]);

  // 编织阶段的文案轮播
  useEffect(() => {
    if (phase !== 'weaving') return undefined;
    setWeaveIndex(0);
    const id = setInterval(() => {
      setWeaveIndex((current) => Math.min(current + 1, WEAVING_LINES.length - 1));
    }, 4200);
    return () => clearInterval(id);
  }, [phase]);

  // 锁滚动 + ESC 关闭
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape' && phase !== 'weaving') resetRitual();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, phase, resetRitual]);

  if (!open) return null;

  const commitAnswer = (payload) => {
    const next = [...answers.filter((item) => item.id !== question.id), { ...payload, id: question.id }];
    setAnswers(next);
    setExiting(true);
    pushTimer(() => {
      if (step + 1 < questions.length) {
        setStep(step + 1);
      } else {
        onSubmit?.(next);
      }
    }, 280);
  };

  const handlePick = (option) => {
    if (picked || exiting) return;
    setPicked(option.id);
    pushTimer(() => commitAnswer({
      probe: question.probe,
      prompt: question.prompt,
      answerLabel: option.label,
      answerSub: option.sub || ''
    }), 380);
  };

  const handleDial = () => {
    if (exiting) return;
    const leaning = dial >= 62 ? question.rightLabel : dial <= 38 ? question.leftLabel : '两边都想要';
    commitAnswer({
      probe: question.probe,
      prompt: question.prompt,
      answerLabel: `${leaning}（${dial}/100，左「${question.leftLabel}」右「${question.rightLabel}」）`,
      answerSub: ''
    });
  };

  const handleWord = () => {
    const text = word.trim();
    if (!text || exiting) return;
    commitAnswer({ probe: question.probe, prompt: question.prompt, answerLabel: text, answerSub: '' });
  };

  const goBack = () => {
    if (step <= 0 || exiting) return;
    setAnswers(answers.slice(0, -1));
    setStep(step - 1);
  };

  const skipRest = () => onSubmit?.(answers);

  return (
    <div className="ritual-veil" role="dialog" aria-modal="true" aria-label="音乐灵魂仪式">
      <RitualStarfield seed={userName || 'soul'} count={70} />

      {/* 关闭 */}
      {phase !== 'weaving' ? (
        <button
          type="button"
          onClick={resetRitual}
          className="absolute right-5 top-5 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/[0.04] text-paper-dim transition-all duration-200 hover:border-white/25 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
          aria-label="退出仪式"
        >
          <X size={17} aria-hidden="true" />
        </button>
      ) : null}

      {/* ------------------------------ 召唤中 ------------------------------ */}
      {phase === 'summon' ? (
        <div className="ritual-stage ritual-slide-enter text-center">
          <RitualSigil colors={[palette[0], palette[1]]} />
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tight text-paper sm:text-3xl">正在为你现场出题</h2>
            <p className="mx-auto max-w-[46ch] text-[0.88rem] leading-relaxed text-paper-dim">
              AI 已经翻完你的歌单。接下来这几张牌，是它看不懂的部分——只有你自己知道答案。
            </p>
          </div>
          <div className="ritual-weave"><i className="ritual-weave-bar block" /></div>
          {error ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-[0.82rem] text-accent-red">{error}</p>
              <button type="button" className="ac-btn" onClick={onRetryQuiz}>重新召唤</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ------------------------------- 答题 ------------------------------- */}
      {phase === 'quiz' && question ? (
        <div className="ritual-stage">
          {/* 顶部：进度 + 探测维度 */}
          <div className="flex w-full items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  className="grid h-9 w-9 place-items-center rounded-full border border-white/12 text-paper-dim transition-colors hover:border-white/25 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
                  aria-label="上一题"
                >
                  <ArrowLeft size={15} aria-hidden="true" />
                </button>
              ) : null}
              <ProgressDots total={questions.length} current={step} />
            </div>
            <span className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-paper-faint">
              {question.probe}
            </span>
          </div>

          <div
            key={question.id}
            className={`flex w-full flex-col items-center gap-7 ${exiting ? 'ritual-slide-exit' : 'ritual-slide-enter'}`}
          >
            <div className="space-y-2.5 text-center">
              <h2 className="mx-auto max-w-[24ch] text-2xl font-black leading-tight tracking-tight text-paper sm:text-[2rem]">
                {question.prompt}
              </h2>
              {question.hint ? (
                <p className="text-[0.8rem] text-paper-faint">{question.hint}</p>
              ) : null}
            </div>

            {/* 二选一 / 多选一 */}
            {(question.kind === 'pair' || question.kind === 'choice') && question.options?.length ? (
              <div
                className={[
                  'grid w-full gap-3.5',
                  question.options.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'
                ].join(' ')}
              >
                {question.options.map((option, index) => (
                  <ChoiceCard
                    key={option.id}
                    option={option}
                    picked={picked === option.id}
                    disabled={Boolean(picked)}
                    accent={palette[index % palette.length]}
                    onPick={handlePick}
                  />
                ))}
              </div>
            ) : null}

            {/* 滑块 */}
            {question.kind === 'dial' ? (
              <div className="w-full max-w-[560px] space-y-6">
                <div className="flex items-center justify-between gap-4 text-[0.8rem] font-semibold">
                  <span className={dial <= 38 ? 'text-paper' : 'text-paper-faint'}>{question.leftLabel}</span>
                  <span
                    className="rounded-full px-3 py-1 text-[0.9rem] font-black tabular-nums"
                    style={{ background: `${palette[0]}22`, color: palette[0] }}
                  >
                    {dial}
                  </span>
                  <span className={dial >= 62 ? 'text-paper' : 'text-paper-faint'}>{question.rightLabel}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={dial}
                  onChange={(event) => setDial(Number(event.target.value))}
                  className="ac-range w-full"
                  aria-label={question.prompt}
                />
                <button type="button" className="ac-btn ac-btn-primary w-full justify-center" onClick={handleDial}>
                  <Check size={15} aria-hidden="true" /> 就这个位置
                </button>
              </div>
            ) : null}

            {/* 写一个词 */}
            {question.kind === 'word' ? (
              <div className="w-full max-w-[520px] space-y-4">
                <input
                  className="ac-input w-full text-center text-lg"
                  value={word}
                  maxLength={16}
                  autoFocus
                  placeholder={question.placeholder}
                  onChange={(event) => setWord(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleWord();
                    }
                  }}
                  aria-label={question.prompt}
                />
                <button
                  type="button"
                  className="ac-btn ac-btn-primary w-full justify-center"
                  onClick={handleWord}
                  disabled={!word.trim()}
                >
                  <Check size={15} aria-hidden="true" /> 落笔
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={skipRest}
            className="text-[0.76rem] text-paper-faint underline-offset-4 transition-colors hover:text-paper-dim hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
          >
            跳过剩下的，直接翻牌
          </button>
        </div>
      ) : null}

      {/* ------------------------------ 编织中 ------------------------------ */}
      {phase === 'weaving' ? (
        <div className="ritual-stage ritual-slide-enter text-center">
          <RitualSigil colors={[palette[0], palette[1]]} />
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tight text-paper sm:text-3xl">
              {quiz?.outro || '牌面正在重排'}
            </h2>
            <p key={weaveIndex} className="animate-fade-in text-[0.88rem] text-paper-dim">
              {WEAVING_LINES[weaveIndex]}
            </p>
          </div>
          <div className="ritual-weave"><i className="ritual-weave-bar block" /></div>
          {answers.length ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {answers.map((item) => (
                <span
                  key={item.id}
                  className="max-w-[220px] truncate rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.72rem] text-paper-faint"
                >
                  {item.answerLabel}
                </span>
              ))}
            </div>
          ) : null}
          <p className="text-[0.74rem] text-paper-faint">这一步会慢一点，它在认真读你的答案。</p>
        </div>
      ) : null}

      {/* ------------------------------- 翻牌 ------------------------------- */}
      {phase === 'reveal' && report ? (
        <div className="ritual-stage max-h-[100dvh] overflow-y-auto py-10">
          <div className="ac-scroll grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="animate-fade-in">
              <SoulStarMap report={report} />
              <p className="mt-2 text-center text-[0.72rem] uppercase tracking-[0.2em] text-paper-faint">
                soul coordinates
              </p>
            </div>
            <SoulCard card={report.soulCard} userName={userName} flip />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="ac-btn ac-btn-primary" onClick={onViewReport}>
              <Sparkles size={15} aria-hidden="true" /> 看完整侧写
            </button>
            <button type="button" className="ac-btn" onClick={onOpenShare}>
              <Share2 size={15} aria-hidden="true" /> 生成分享卡
            </button>
          </div>
          {report.the_roast ? (
            <p className="mx-auto max-w-[52ch] text-center text-[0.82rem] leading-relaxed text-paper-dim">
              {report.the_roast}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
