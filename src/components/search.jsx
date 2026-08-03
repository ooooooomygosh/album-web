import React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Album, CirclePlus, Disc3, Search, Sparkles, X } from 'lucide-react';
import { statusLabels, cssImageUrl } from '../lib/utils.js';
import { AlbumArt, AddGenerationLoader } from './common.jsx';

/* ------------------------------ 顶栏全局搜索 ------------------------------ */

export function GlobalMusicSearch({
  searchType, setSearchType, runSearch, query, setQuery, artistQuery, setArtistQuery,
  link, setLink, searchStatus, candidates, selectedCandidate, setSelectedCandidate,
  addSelectedToShowroom, isAdding, addPhase, addError
}) {
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState(query || '');
  const [addingElapsed, setAddingElapsed] = useState(0);
  const searchRef = useRef(null);
  const popoverRef = useRef(null);
  const queryInputRef = useRef(null);
  const suppressFocusOpenRef = useRef(false);

  const phaseSteps = [
    ['metadata', '读取资料'],
    ['ai', '生成导览'],
    ['writing', '写入展柜']
  ];
  const activePhaseIndex = addPhase === 'done'
    ? phaseSteps.length
    : Math.max(0, phaseSteps.findIndex(([key]) => key === addPhase));
  const isAddingSelection = Boolean(isAdding && selectedCandidate);
  const activePhaseLabel = phaseSteps[Math.max(0, Math.min(activePhaseIndex, phaseSteps.length - 1))]?.[1] || '整理资料';
  const progressValue = Math.max(18, Math.min(100, Math.round(((Math.min(activePhaseIndex, phaseSteps.length - 1) + 1) / phaseSteps.length) * 100)));
  const activePhaseDetail = {
    metadata: '抓取封面、曲目、发行年份和来源信息。',
    ai: '联网整理资料，用 AI 写成可读的专辑导览。',
    writing: '同步到房间展柜，准备刷新陈列墙。'
  }[addPhase] || '正在把这张唱片整理成房间里的完整条目。';
  const elapsedLabel = `${Math.floor(addingElapsed / 60)}:${String(addingElapsed % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      const insideSearch = searchRef.current?.contains(event.target);
      const insidePopover = popoverRef.current?.contains(event.target);
      if (!insideSearch && !insidePopover) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        queryInputRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!isAddingSelection) {
      setAddingElapsed(0);
      return undefined;
    }
    const startedAt = Date.now();
    setAddingElapsed(0);
    const timer = window.setInterval(() => {
      setAddingElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isAddingSelection, selectedCandidate?.id]);

  const closePopover = () => {
    suppressFocusOpenRef.current = true;
    setOpen(false);
    window.setTimeout(() => { suppressFocusOpenRef.current = false; }, 180);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextQuery = localQuery.trim();
    const nextLink = link.trim();
    if (!nextQuery && !nextLink) {
      setOpen(false);
      setSelectedCandidate(null);
      return;
    }
    setQuery(localQuery);
    setArtistQuery('');
    setOpen(true);
    await runSearch({ query: localQuery, artistQuery: '', link });
  };

  const chooseCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setOpen(true);
  };

  const addAndClose = async () => {
    const added = await addSelectedToShowroom();
    if (added !== false) setOpen(false);
  };

  const submitLink = async (event) => {
    event.preventDefault();
    if (!link.trim()) return;
    setOpen(true);
    await runSearch({ query: '', artistQuery: '', link });
  };

  const updateSearchType = (key) => {
    setSearchType(key);
    setSelectedCandidate(null);
    setOpen(true);
  };

  const statusText = searchStatus === 'idle'
    ? '输入专辑、歌曲、艺人，或用空格组合后按 Enter 搜索。'
    : searchStatus === 'searching'
      ? '正在从曲库里匹配候选…'
      : searchStatus.startsWith('found-')
        ? `找到 ${searchStatus.replace('found-', '')} 个候选。`
        : searchStatus.startsWith('error-')
          ? `搜索失败：${searchStatus.replace('error-', '')}`
          : '';

  const popover = (
    <>
      <div
        className="fixed inset-0 z-[80] animate-fade-in bg-ink-950/55 backdrop-blur-[2px]"
        aria-hidden="true"
        onPointerDown={closePopover}
      />
      <div
        id="global-search-popover"
        role="dialog"
        aria-modal="false"
        aria-label="音乐搜索结果"
        ref={popoverRef}
        className="ac-glass fixed left-1/2 top-[76px] z-[90] w-[min(940px,calc(100vw-24px))] -translate-x-1/2 animate-sheet-in overflow-hidden rounded-xl shadow-card"
      >
        <button
          type="button"
          aria-label="关闭搜索结果"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => { event.stopPropagation(); closePopover(); }}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-paper-dim transition hover:border-white/20 hover:bg-white/[0.12] hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
        >
          <X size={15} aria-hidden="true" />
        </button>

        {isAddingSelection ? (
          <div className="relative overflow-hidden p-6">
            <div
              className="pointer-events-none absolute inset-0 -z-10 scale-110 opacity-25 blur-3xl"
              style={{ backgroundImage: cssImageUrl(selectedCandidate.cover), backgroundSize: 'cover', backgroundPosition: 'center' }}
              aria-hidden="true"
            />
            <div className="grid items-center gap-6 md:grid-cols-[180px_minmax(0,1fr)]">
              <div className="relative mx-auto grid h-[180px] w-[180px] place-items-center" aria-hidden="true">
                <div className="absolute inset-0 animate-slow-spin rounded-full border border-dashed border-white/15" />
                <div className="absolute inset-4 animate-slow-spin rounded-full bg-gradient-to-br from-ink-800 to-ink-950 shadow-soft [animation-duration:6s]" />
                <AlbumArt
                  item={selectedCandidate}
                  size="small"
                  className="relative z-10 h-[104px] w-[104px] rounded-lg shadow-card ring-1 ring-white/15"
                />
                <div className="absolute inset-x-6 top-1/2 h-px animate-pulse bg-accent-sky/60" />
              </div>

              <div aria-live="polite" className="min-w-0 space-y-3">
                <p className="ac-eyebrow">
                  <Sparkles size={13} className="text-accent-gold" aria-hidden="true" /> 正在加入展柜
                </p>
                <h3 className="ac-h3 break-words">{selectedCandidate.title}</h3>
                <p className="ac-muted">
                  {selectedCandidate.artist} · {selectedCandidate.type === 'album'
                    ? `${selectedCandidate.tracks?.length || 0} 首曲目`
                    : selectedCandidate.albumTitle || '单曲'}
                </p>

                <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3.5">
                  <strong className="block text-[0.85rem] font-bold text-paper">{activePhaseLabel}</strong>
                  <span className="mt-0.5 block text-[0.78rem] leading-relaxed text-paper-dim">{activePhaseDetail}</span>
                  <small className="mt-2 block text-[0.7rem] text-paper-faint">已等待 {elapsedLabel} · 通常 1-3 分钟</small>
                </div>

                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressValue}
                  aria-label="添加进度"
                >
                  <i
                    className="block h-full rounded-full bg-gradient-to-r from-accent-sky to-accent-purple transition-[width] duration-700 ease-soft"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {phaseSteps.map(([key, label], index) => (
                    <span
                      key={key}
                      className={[
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold transition-colors',
                        index <= activePhaseIndex
                          ? 'border-accent-sky/35 bg-accent-sky/12 text-accent-sky'
                          : 'border-white/[0.08] bg-white/[0.03] text-paper-faint'
                      ].join(' ')}
                    >
                      <b className="tabular-nums opacity-70">{String(index + 1).padStart(2, '0')}</b>
                      {label}
                    </span>
                  ))}
                </div>

                <p className="text-[0.74rem] leading-relaxed text-paper-faint">
                  正在生成更完整的背景、标签和导览。候选列表已暂时收起，避免添加时误点。
                </p>
                {addError ? <p className="ac-status ac-status-error">{addError}</p> : null}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-4 border-b border-white/[0.07] px-5 py-4 pr-14">
              <form className="min-w-[220px] flex-1" onSubmit={submitLink}>
                <label className="ac-field">
                  <span>分享链接</span>
                  <input
                    className="ac-input"
                    type="url"
                    inputMode="url"
                    name="global-share-link"
                    autoComplete="off"
                    spellCheck={false}
                    value={link}
                    onChange={(event) => setLink(event.target.value)}
                    placeholder="Spotify / Apple / 网易云 / QQ 链接…"
                  />
                </label>
              </form>
              <div className="ac-status min-w-[180px] flex-1 pb-2" aria-live="polite">{statusText}</div>
            </div>

            <div className="grid max-h-[min(62vh,520px)] gap-0 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="ac-scroll max-h-[min(62vh,520px)] overflow-y-auto p-4">
                {searchStatus === 'searching' ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="flex items-center gap-3 rounded-lg border border-white/[0.06] p-2.5">
                        <div className="ac-skeleton h-12 w-12 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <div className="ac-skeleton h-3 w-2/5 rounded-full" />
                          <div className="ac-skeleton h-2.5 w-3/5 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {searchStatus.startsWith('found-') && candidates.length === 0 ? (
                  <p className="ac-empty py-10 text-[0.85rem]">没有找到候选，试试补上艺人名或换成分享链接。</p>
                ) : null}

                <div className="space-y-1.5" role="list" aria-label="候选音乐">
                  {candidates.map((candidate) => {
                    const selected = selectedCandidate?.id === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        role="listitem"
                        aria-pressed={selected}
                        onClick={() => chooseCandidate(candidate)}
                        className={[
                          'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
                          selected
                            ? 'border-accent-sky/40 bg-accent-sky/12'
                            : 'border-transparent hover:border-white/10 hover:bg-white/[0.05]'
                        ].join(' ')}
                      >
                        <AlbumArt item={candidate} size="thumb" className="h-12 w-12 shrink-0 rounded-md" />
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[0.87rem] font-semibold text-paper">{candidate.title}</strong>
                          <small className="block truncate text-[0.73rem] text-paper-dim">
                            {candidate.artist} · {candidate.year || candidate.albumTitle}
                          </small>
                          <small className="block truncate text-[0.68rem] text-paper-faint">
                            {candidate.type === 'album' ? '专辑' : '单曲'} · {candidate.source} · {candidate.match}%
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <aside className="flex flex-col gap-3 border-t border-white/[0.07] p-4 md:border-l md:border-t-0">
                {selectedCandidate ? (
                  <>
                    <AlbumArt item={selectedCandidate} size="small" className="w-full rounded-lg shadow-soft ring-1 ring-white/10" />
                    <div className="min-w-0">
                      <strong className="block break-words text-[0.9rem] font-bold text-paper">{selectedCandidate.title}</strong>
                      <span className="mt-0.5 block text-[0.75rem] text-paper-dim">
                        {selectedCandidate.artist} · {selectedCandidate.type === 'album'
                          ? `${selectedCandidate.tracks?.length || 0} 首曲目`
                          : selectedCandidate.albumTitle}
                      </span>
                    </div>
                    <button type="button" className="ac-btn ac-btn-primary mt-auto w-full justify-center" onClick={addAndClose} disabled={isAdding}>
                      <CirclePlus size={15} aria-hidden="true" />
                      加入展柜
                    </button>
                  </>
                ) : (
                  <div className="ac-empty h-full py-8">
                    <Disc3 size={26} className="text-paper-faint" aria-hidden="true" />
                    <strong className="text-[0.85rem] font-semibold text-paper-dim">选择一个候选</strong>
                    <span className="text-[0.74rem] text-paper-faint">封面、艺人、年份和来源会在这里确认。</span>
                  </div>
                )}
              </aside>
            </div>

            {addError ? <p className="ac-status ac-status-error border-t border-white/[0.07] px-5 py-3">{addError}</p> : null}
          </>
        )}
      </div>
    </>
  );

  return (
    <form className="flex min-w-0 items-center gap-2" role="search" onSubmit={submit} ref={searchRef}>
      <div className="group/field relative flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] pl-3.5 pr-1 transition-colors duration-200 focus-within:border-accent-sky/45 focus-within:bg-white/[0.08] hover:border-white/20">
        <Search size={15} className="shrink-0 text-paper-faint" aria-hidden="true" />
        <input
          type="search"
          name="global-music-search"
          autoComplete="off"
          spellCheck={false}
          ref={queryInputRef}
          value={localQuery}
          onFocus={() => {
            if (suppressFocusOpenRef.current) return;
            setOpen(true);
          }}
          onChange={(event) => {
            setLocalQuery(event.target.value);
            setSelectedCandidate(null);
          }}
          placeholder="专辑 / 艺人 / 歌曲 / 链接…"
          aria-label="快速搜索专辑或歌曲"
          aria-expanded={open}
          aria-controls="global-search-popover"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[0.82rem] text-paper outline-none placeholder:text-paper-faint [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="submit"
          disabled={searchStatus === 'searching'}
          aria-label="搜索音乐"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-sky/18 text-accent-sky transition hover:bg-accent-sky/30 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
        >
          {searchStatus === 'searching'
            ? <Sparkles size={14} className="animate-pulse" aria-hidden="true" />
            : <Search size={14} aria-hidden="true" />}
        </button>
      </div>

      <div className="hidden shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 lg:flex" role="group" aria-label="搜索类型">
        {[['all', '全部'], ['album', '专辑'], ['song', '单曲']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={searchType === key}
            onClick={() => updateSearchType(key)}
            className={[
              'rounded-full px-2.5 py-1 text-[0.72rem] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
              searchType === key ? 'bg-accent-sky/18 text-accent-sky' : 'text-paper-faint hover:text-paper-dim'
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {open && createPortal(popover, document.body)}
    </form>
  );
}

/* -------------------------------- 添加音乐页 -------------------------------- */

export function AddMusic({
  query, setQuery, artistQuery, setArtistQuery, link, setLink, searchType, setSearchType,
  setSearchStatus, setCandidates, resolvedLink, runOnlineSearch, searchStatus, candidates,
  selectedCandidate, setSelectedCandidate, addSelectedToShowroom, backgroundStatus, itemStatus,
  addPhase, addError
}) {
  const selectedType = selectedCandidate?.type === 'album' ? '专辑' : '歌曲';
  const isAdding = backgroundStatus === 'thinking' || itemStatus === 'adding';
  const phaseSteps = [
    ['metadata', '读取 iTunes 元数据'],
    ['ai', '联网检索 + DeepSeek v4 Pro 写长导览'],
    ['writing', '保存高质量导览']
  ];
  const activePhaseIndex = addPhase === 'done'
    ? phaseSteps.length
    : Math.max(0, phaseSteps.findIndex(([key]) => key === addPhase));

  const statusText = [
    searchStatus === 'idle' ? '选择歌曲或专辑类型后搜索。' : '',
    searchStatus === 'searching' ? '正在匹配候选。' : '',
    searchStatus.startsWith('found-') ? `找到 ${searchStatus.replace('found-', '')} 个候选。` : '',
    searchStatus.startsWith('error-') ? searchStatus.replace('error-', '搜索失败：') : '',
    resolvedLink ? ` 链接识别：${resolvedLink.provider}` : ''
  ].filter(Boolean).join('');

  return (
    <div id="composer" className="ac-page animate-fade-in">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="ac-eyebrow"><Search size={13} aria-hidden="true" /> add music</p>
          <h2 className="ac-h1">添加歌曲或专辑</h2>
        </div>
        <button type="button" className="ac-btn ac-btn-primary" onClick={runOnlineSearch}>
          <Search size={16} aria-hidden="true" /> 搜索
        </button>
      </header>

      <div className="flex w-fit items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1" role="group" aria-label="添加类型">
        {[['all', '全部'], ['song', '歌曲'], ['album', '专辑']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={searchType === key}
            onClick={() => {
              setSearchType(key);
              setSearchStatus('idle');
              setCandidates([]);
              setSelectedCandidate(null);
            }}
            className={[
              'rounded-full px-4 py-1.5 text-[0.78rem] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
              searchType === key
                ? 'bg-accent-sky/18 text-accent-sky shadow-soft'
                : 'text-paper-faint hover:text-paper-dim'
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="ac-field">
          <span>歌曲 / 专辑名</span>
          <input className="ac-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="我爱你 / 唱游 / Blonde" />
        </label>
        <label className="ac-field">
          <span>歌手 / 乐队</span>
          <input className="ac-input" value={artistQuery} onChange={(event) => setArtistQuery(event.target.value)} placeholder="李荣浩 / 王菲 / Frank Ocean" />
        </label>
        <label className="ac-field">
          <span>分享链接</span>
          <input className="ac-input" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Spotify / Apple / 网易云 / QQ 链接" />
        </label>
      </div>

      {statusText ? <p className="ac-status" aria-live="polite">{statusText}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="ac-card ac-scroll max-h-[560px] space-y-1.5 overflow-y-auto p-3" aria-label="候选结果">
          {candidates.length ? candidates.map((item) => {
            const selected = selectedCandidate?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setSelectedCandidate(item)}
                className={[
                  'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
                  selected
                    ? 'border-accent-sky/40 bg-accent-sky/12'
                    : 'border-transparent hover:border-white/10 hover:bg-white/[0.05]'
                ].join(' ')}
              >
                <AlbumArt item={item} size="thumb" className="h-12 w-12 shrink-0 rounded-md" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[0.87rem] font-semibold text-paper">{item.title}</strong>
                  <small className="block truncate text-[0.72rem] text-paper-faint">
                    {item.type === 'album' ? '专辑' : '歌曲'} · {item.artist} · {item.albumTitle || item.year}
                  </small>
                </span>
                <em className="shrink-0 not-italic text-[0.72rem] font-bold tabular-nums text-accent-sky/80">{item.match}%</em>
              </button>
            );
          }) : (
            <p className="ac-empty text-[0.85rem]">还没有候选。填写关键词后点击「搜索」。</p>
          )}
        </div>

        <div className="ac-card p-5">
          {selectedCandidate ? (
            <div className="space-y-4">
              <AlbumArt item={selectedCandidate} size="large" className="w-full rounded-lg shadow-card ring-1 ring-white/10" />
              <div className="space-y-1.5">
                <p className="ac-eyebrow"><Album size={13} aria-hidden="true" /> selected {selectedType}</p>
                <h3 className="ac-h3 break-words">{selectedCandidate.title}</h3>
                <p className="ac-muted">
                  {selectedCandidate.artist} · {selectedCandidate.type === 'album' ? '专辑' : selectedCandidate.albumTitle}
                </p>
              </div>
              {(selectedCandidate.tags || []).length ? (
                <div className="ac-tag-row">
                  {(selectedCandidate.tags || []).map((tag) => <span key={tag} className="ac-tag">{tag}</span>)}
                </div>
              ) : null}
              <button
                type="button"
                className="ac-btn ac-btn-primary w-full justify-center"
                disabled={isAdding}
                onClick={addSelectedToShowroom}
              >
                <CirclePlus size={16} aria-hidden="true" />
                {isAdding ? '正在生成导览' : `加入${selectedType}`}
              </button>
              {isAdding ? (
                <AddGenerationLoader item={selectedCandidate} phaseSteps={phaseSteps} activePhaseIndex={activePhaseIndex} />
              ) : null}
              <p className="ac-status" aria-live="polite">
                {isAdding
                  ? '正在联网检索并生成音乐导览；如果模型响应过慢，会先用已核验资料保存可用版本。'
                  : (statusLabels[backgroundStatus] || statusLabels[itemStatus] || '确认后会写入当前房间。')}
              </p>
              {addError ? <p className="ac-status ac-status-error">{addError}</p> : null}
            </div>
          ) : (
            <div className="ac-empty h-full">
              <Disc3 size={28} className="text-paper-faint" aria-hidden="true" />
              <p className="ac-body">搜索并选择一个候选。</p>
            </div>
          )}
        </div>
      </div>

      {isAdding && selectedCandidate ? (
        <div
          className="pointer-events-none fixed inset-0 -z-10 scale-110 opacity-[0.12] blur-3xl"
          style={{ backgroundImage: cssImageUrl(selectedCandidate.cover), backgroundSize: 'cover', backgroundPosition: 'center' }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
