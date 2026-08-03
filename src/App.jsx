import React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Album, Bot, CirclePlus, Grid3X3, LockKeyhole, MessageCircle, UserRound, Users, Wand2 } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { initAnalytics } from './firebaseClient';
import ExperimentalCorridorCarousel from './ExperimentalCorridorCarousel';
import { memberColors, defaultHeroConfig, mergeUserSettings, roomQueryUrl, parseRoomQuery, loadJson, saveJson, profileToDraft, publicMemberProfile, normalizeHeroConfig, editableHeroConfig, imageFileToDataUrl, slugifyRoom, sameAlbum, cssImageUrl, api, apiWithTimeout } from './lib/utils.js';
import { UserAvatar, useCoverPalette, ConfirmDialog, Ai } from './components/common.jsx';
import { AuthGate, RoomGate } from './components/gates.jsx';
import { GlobalMusicSearch, AddMusic } from './components/search.jsx';
import { AlbumCabinetPage, MemberProfileModal } from './components/cabinet.jsx';
import { AlbumDetailPage, Review } from './components/detail.jsx';
import { ProfilePanel, AdminPanel, RoomPanel } from './components/panels.jsx';
import { PersonaQuest } from './components/personaQuest.jsx';
import { PersonaShareCard } from './components/personaShare.jsx';
import { useAppStore } from './store/useAppStore.js';

export default function App() {
  const session = useAppStore((s) => s.session);
  const setSession = useAppStore((s) => s.setSession);
  const room = useAppStore((s) => s.room);
  const setRoom = useAppStore((s) => s.setRoom);
  const knownRooms = useAppStore((s) => s.knownRooms);
  const setKnownRooms = useAppStore((s) => s.setKnownRooms);
  const discoverRooms = useAppStore((s) => s.discoverRooms);
  const setDiscoverRooms = useAppStore((s) => s.setDiscoverRooms);
  const roomStatus = useAppStore((s) => s.roomStatus);
  const setRoomStatus = useAppStore((s) => s.setRoomStatus);

  const userSettings = useAppStore((s) => s.userSettings);
  const setUserSettings = useAppStore((s) => s.setUserSettings);
  const saveUserSettings = useAppStore((s) => s.saveUserSettings);
  const routeState = useAppStore((s) => s.routeState);
  const setRouteState = useAppStore((s) => s.setRouteState);
  const [roomDraft, setRoomDraft] = useState('新的听歌房间');
  const [inviteDraft, setInviteDraft] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);
  const items = useAppStore((s) => s.items);
  const setItems = useAppStore((s) => s.setItems);
  const activeId = useAppStore((s) => s.activeId);
  const setActiveId = useAppStore((s) => s.setActiveId);
  const comments = useAppStore((s) => s.comments);
  const setComments = useAppStore((s) => s.setComments);
  const loadRoomData = useAppStore((s) => s.loadRoomData);
  const [query, setQuery] = useState('');
  const [artistQuery, setArtistQuery] = useState('');
  const [link, setLink] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [draft, setDraft] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const glass = useAppStore((s) => s.glass);
  const setGlass = useAppStore((s) => s.setGlass);
  const reduceMotion = useAppStore((s) => s.reduceMotion);
  const setReduceMotion = useAppStore((s) => s.setReduceMotion);
  const openCabinet = useAppStore((s) => s.openCabinet);
  const openItemDetail = useAppStore((s) => s.openItemDetail);
  const [candidates, setCandidates] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [aiInsight, setAiInsight] = useState('');
  const [aiStatus, setAiStatus] = useState('idle');
  const [commentStatus, setCommentStatus] = useState('idle');
  const [itemStatus, setItemStatus] = useState('idle');
  const initialLoading = useAppStore((s) => s.initialLoading);
  const setInitialLoading = useAppStore((s) => s.setInitialLoading);
  const [backgroundStatus, setBackgroundStatus] = useState('idle');
  const [addPhase, setAddPhase] = useState('idle');
  const [commentAiStatus, setCommentAiStatus] = useState('idle');
  const [addError, setAddError] = useState('');
  const [resolvedLink, setResolvedLink] = useState(null);
  const [adminData, setAdminData] = useState(null);
  const [adminStatus, setAdminStatus] = useState('');
  const [aiPromptDraft, setAiPromptDraft] = useState('');
  const [personaPromptDraft, setPersonaPromptDraft] = useState('');
  const [aiMaxTokens, setAiMaxTokens] = useState(2100);
  const [personaMaxTokens, setPersonaMaxTokens] = useState(16000);
  const [personaChatMaxTokens, setPersonaChatMaxTokens] = useState(5200);
  const [aiTemperature, setAiTemperature] = useState(0.5);
  const [personaTemperature, setPersonaTemperature] = useState(0.72);
  const [profileDraft, setProfileDraft] = useState(() => profileToDraft(session?.user));
  const [profileStats, setProfileStats] = useState(null);
  const [profileStatus, setProfileStatus] = useState('');
  const [personaTone, setPersonaTone] = useState('warm');
  const [personaHistoryMode, setPersonaHistoryMode] = useState('mine');
  const [personaSelectedIds, setPersonaSelectedIds] = useState([]);
  const [personaStatus, setPersonaStatus] = useState('idle');
  const [personaReport, setPersonaReport] = useState(session?.user?.latestPersona || null);
  const [personaQuestion, setPersonaQuestion] = useState('');
  const [personaChatStatus, setPersonaChatStatus] = useState('idle');
  const [personaChat, setPersonaChat] = useState([]);
  const setRitualPhase = useAppStore((s) => s.setRitualPhase);
  const setRitualQuiz = useAppStore((s) => s.setRitualQuiz);
  const setRitualStep = useAppStore((s) => s.setRitualStep);
  const setRitualAnswers = useAppStore((s) => s.setRitualAnswers);
  const setRitualError = useAppStore((s) => s.setRitualError);
  const resetRitual = useAppStore((s) => s.resetRitual);
  const shareCardOpen = useAppStore((s) => s.shareCardOpen);
  const setShareCardOpen = useAppStore((s) => s.setShareCardOpen);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const ratingsByItem = useAppStore((s) => s.ratingsByItem);
  const setRatingsByItem = useAppStore((s) => s.setRatingsByItem);
  const [ratingStatus, setRatingStatus] = useState('idle');
  const [corridorOpen, setCorridorOpen] = useState(false);
  const [roomSettingsDraft, setRoomSettingsDraft] = useState({ visibility: 'unlisted', joinMode: 'open', discoverable: false, description: '', password: '', heroConfig: defaultHeroConfig });

  const routeItem = routeState.itemId ? items.find((item) => item.id === routeState.itemId) : null;
  const activeItem = routeItem || items.find((item) => item.id === activeId) || items[0];
  const palette = useCoverPalette(activeItem);
  const roomUrl = room ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.id)}` : '';
  const activeComments = activeItem ? comments.filter((comment) => {
    if (comment.albumId === activeItem.id || comment.albumTitle === activeItem.title) return true;
    const commentedItem = items.find((item) => item.id === comment.albumId);
    return Boolean(activeItem.type === 'album' && commentedItem && sameAlbum(commentedItem, activeItem));
  }) : [];
  const roomMembers = useMemo(() => {
    const profiles = room?.memberProfiles
      ? Object.entries(room.memberProfiles).map(([id, member]) => publicMemberProfile(member, id))
      : [];
    const fallback = session?.user ? [publicMemberProfile(session.user, session.user.id)] : [];
    const merged = (profiles.length ? profiles : fallback).map((member, index) => {
      const liveUser = member.id && member.id === session?.user?.id ? publicMemberProfile(session.user, session.user.id) : member;
      return {
        ...member,
        ...liveUser,
        id: liveUser.id || member.id,
        color: memberColors[index % memberColors.length]
      };
    });
    return merged.slice(0, 8);
  }, [room, session]);
  const visibleTopbarMembers = roomMembers.slice(0, 5);
  const hiddenTopbarMemberCount = Math.max(0, roomMembers.length - visibleTopbarMembers.length);
  const memberProfilesById = useMemo(() => {
    const profiles = {};
    Object.entries(room?.memberProfiles || {}).forEach(([id, member]) => {
      profiles[id] = publicMemberProfile(member, id);
    });
    if (session?.user?.id) profiles[session.user.id] = publicMemberProfile(session.user, session.user.id);
    Object.values(profiles).forEach((member) => {
      if (member.id) profiles[member.id] = member;
    });
    return profiles;
  }, [room?.memberProfiles, session?.user]);
  const selectedMember = selectedMemberId ? memberProfilesById[selectedMemberId] : null;
  const selectedMemberItems = selectedMemberId ? items.filter((item) => item.addedById === selectedMemberId) : [];

  const syncCurrentRoomMember = (user) => {
    if (!user?.id) return;
    const snapshot = publicMemberProfile(user, user.id);
    setRoom((current) => {
      if (!current?.id) return current;
      return {
        ...current,
        memberProfiles: {
          ...(current.memberProfiles || {}),
          [user.id]: {
            ...(current.memberProfiles?.[user.id] || {}),
            ...snapshot
          }
        }
      };
    });
  };

  const refreshRooms = async () => {
    if (!session?.token) return;
    const [mine, discover] = await Promise.all([
      api('/api/rooms', { session }),
      api('/api/rooms?scope=discover', { session }).catch(() => ({ rooms: [] }))
    ]);
    setKnownRooms(mine.rooms || []);
    setDiscoverRooms(discover.rooms || []);
  };

  useEffect(() => {
    initAnalytics().catch(() => null);
  }, []);

  useEffect(() => {
    const onPopState = () => setRouteState(parseRoomQuery());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!room?.id || routeState.itemId || routeState.view === 'cabinet' || mode !== 'showroom') return;
    const nextUrl = roomQueryUrl(room.id, { view: 'cabinet', mine: routeState.mineOnly ? '1' : '' });
    window.history.replaceState(null, '', nextUrl);
    setRouteState(parseRoomQuery());
  }, [room?.id, routeState.view, routeState.itemId, routeState.mineOnly, mode]);

  useEffect(() => {
    const settings = mergeUserSettings(session?.user?.settings);
    setUserSettings(settings);
    setGlass(settings.appearance.glass);
    setReduceMotion(settings.appearance.reduceMotion);
  }, [session?.user?.id, session?.user?.settings]);

  useEffect(() => {
    refreshRooms().catch(() => null);
  }, [session?.token, room?.id]);

  useEffect(() => {
    if (!session?.token) return;
    api('/api/auth', { session })
      .then((data) => {
        const next = { ...session, user: data.user };
        setSession(next);
        setProfileDraft(profileToDraft(data.user));
        setPersonaReport(data.user.latestPersona || null);
        saveJson('album-circle-session', next);
      })
      .catch(() => {
        localStorage.removeItem('album-circle-session');
        setSession(null);
      });
  }, []);

  useEffect(() => {
    if (session?.user) setProfileDraft(profileToDraft(session.user));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!room) return;
    setRoomSettingsDraft({
      visibility: room.visibility || 'unlisted',
      joinMode: room.joinMode || 'open',
      discoverable: Boolean(room.discoverable),
      description: room.description || '',
      heroConfig: editableHeroConfig(room.heroConfig, room),
      password: ''
    });
  }, [room?.id, room?.visibility, room?.joinMode, room?.discoverable, room?.description, room?.heroConfig]);

  useEffect(() => {
    if (!items.length || !routeState.itemId) return;
    if (items.some((item) => item.id === routeState.itemId) && activeId !== routeState.itemId) {
      setActiveId(routeState.itemId);
    }
  }, [items, routeState.itemId, activeId]);

  useEffect(() => {
    if (activeItem?.id) loadRatingSummary(activeItem.id);
  }, [activeItem?.id, room?.id, session?.token]);

  useEffect(() => {
    if (!room?.id || !items.length || !session?.token) return;
    items.slice(0, 24).forEach((item) => {
      if (!ratingsByItem[item.id]) loadRatingSummary(item.id);
    });
  }, [room?.id, items.length, session?.token]);

  const loadProfileStats = async () => {
    if (!session?.token) return;
    setProfileStatus('正在读取个人音乐档案');
    try {
      const data = await api('/api/auth?action=stats', { session });
      setProfileStats(data.stats);
      setPersonaSelectedIds((current) => {
        const valid = new Set((data.stats?.recentAdds || []).map((item) => item.id));
        return current.filter((id) => valid.has(id));
      });
      setProfileStatus('');
    } catch (error) {
      setProfileStatus(error.message);
    }
  };

  useEffect(() => {
    const roomId = routeState.roomId;
    if (!roomId || room?.id === roomId) return;
    api(`/api/rooms?roomId=${encodeURIComponent(roomId)}`, { session })
      .then((data) => { if (data.room) setRoom(data.room); })
      .catch(() => null);
  }, [routeState.roomId, session?.token]);

  useEffect(() => {
    if (!room?.id) return;
    loadRoomData(room).then(() => setInitialLoading(false)).catch((error) => {
      setInitialLoading(false);
      setItemStatus(error.message);
      setCommentStatus(error.message);
    });
  }, [room?.id, session?.token]);

  const logout = () => {
    localStorage.removeItem('album-circle-session');
    setSession(null);
    setRoom(null);
  };

  const updateSessionUser = (user) => {
    const next = { ...session, user };
    setSession(next);
    saveJson('album-circle-session', next);
  };

  const saveProfile = async (draft = profileDraft) => {
    setProfileStatus('正在保存个人资料');
    try {
      const data = await api('/api/auth', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'updateProfile', ...draft })
      });
      updateSessionUser(data.user);
      syncCurrentRoomMember(data.user);
      setProfileDraft(profileToDraft(data.user));
      setProfileStatus('个人资料已保存');
      return data.user;
    } catch (error) {
      setProfileStatus(error.message);
      throw error;
    }
  };

  const uploadAvatar = async (file) => {
    setProfileStatus('正在压缩并上传头像');
    try {
      const dataUrl = await imageFileToDataUrl(file);
      const data = await api('/api/auth', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'avatar', dataUrl })
      });
      const nextDraft = { ...profileDraft, avatarUrl: data.avatarUrl || '', avatarDataUrl: data.avatarDataUrl || dataUrl };
      setProfileDraft(nextDraft);
      await saveProfile(nextDraft);
    } catch (error) {
      setProfileStatus(error.message);
    }
  };

  const fillProfileFromHistory = () => {
    const stats = profileStats || {};
    const profile = profileDraft.profile || {};
    setProfileDraft((current) => ({
      ...current,
      profile: {
        ...profile,
        favoriteArtists: [...new Set([...(profile.favoriteArtists || []), ...(stats.topArtists || []).slice(0, 8).map((item) => item.name)])].slice(0, 18),
        favoriteAlbums: [...new Set([...(profile.favoriteAlbums || []), ...(stats.topAlbums || []).slice(0, 8).map((item) => item.name)])].slice(0, 18),
        favoriteSongs: [...new Set([...(profile.favoriteSongs || []), ...(stats.recentAdds || []).filter((item) => item.type !== 'album').slice(0, 10).map((item) => `${item.title} - ${item.artist}`)])].slice(0, 24),
        favoriteGenres: [...new Set([...(profile.favoriteGenres || []), ...(stats.tags || []).slice(0, 8).map((item) => item.name)])].slice(0, 16)
      }
    }));
    setProfileStatus('已把历史添加记录填入偏好草稿，记得保存。');
  };

  const togglePersonaItem = (item) => {
    setPersonaSelectedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id].slice(0, 24));
    setPersonaHistoryMode('selected');
  };

  const generatePersona = async ({ quizAnswers = null } = {}) => {
    setPersonaStatus('thinking');
    try {
      await saveProfile(profileDraft);
      const data = await apiWithTimeout('/api/ai/recommend?action=persona', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'persona',
          tone: personaTone,
          quizAnswers: Array.isArray(quizAnswers) && quizAnswers.length ? quizAnswers : undefined,
          history: { mode: personaHistoryMode, selected: personaSelectedIds }
        })
      }, 295000);
      setPersonaReport(data.report);
      setPersonaChat([]);
      const nextUser = { ...session.user, latestPersona: data.report };
      updateSessionUser(nextUser);
      setPersonaStatus(data.fallback ? 'fallback' : 'done');
      return data.report;
    } catch (error) {
      setPersonaStatus(`error-${error.message}`);
      return null;
    }
  };

  /* ------------------------------ 灵魂仪式流程 ------------------------------ */

  const fetchPersonaQuiz = async () => {
    setRitualError('');
    setRitualPhase('summon');
    setRitualQuiz(null);
    setRitualStep(0);
    setRitualAnswers([]);
    try {
      await saveProfile(profileDraft);
      const data = await apiWithTimeout('/api/ai/recommend?action=persona-quiz', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'persona-quiz',
          history: { mode: personaHistoryMode, selected: personaSelectedIds }
        })
      }, 110000);
      if (!data?.quiz?.questions?.length) throw new Error('题目没抽出来');
      // 让召唤法阵至少转满一次，避免闪现
      setRitualQuiz(data.quiz);
      setRitualPhase('quiz');
    } catch (error) {
      setRitualError(error.message || '召唤失败');
    }
  };

  const finishRitual = async (answers) => {
    setRitualAnswers(answers || []);
    setRitualPhase('weaving');
    const report = await generatePersona({ quizAnswers: answers });
    if (report) {
      setRitualPhase('reveal');
    } else {
      resetRitual();
      goToMode('profile');
    }
  };

  const closeRitualToReport = () => {
    resetRitual();
    goToMode('profile');
    requestAnimationFrame(() => {
      document.getElementById('persona-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const askPersona = async (question = personaQuestion) => {
    const text = String(question || '').trim();
    if (!text) return;
    setPersonaChatStatus('thinking');
    setPersonaQuestion('');
    setPersonaChat((current) => [...current, { role: 'user', text }]);
    try {
      const data = await apiWithTimeout('/api/ai/recommend?action=persona-chat', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'persona-chat',
          question: text,
          report: personaReport,
          history: { mode: personaHistoryMode, selected: personaSelectedIds }
        })
      }, 140000);
      setPersonaChat((current) => [...current, { role: 'assistant', text: data.answer, sources: data.research?.sources || [] }]);
      setPersonaChatStatus(data.fallback ? 'fallback' : 'done');
    } catch (error) {
      setPersonaChatStatus(`error-${error.message}`);
    }
  };

  const addPublicTag = async (tag) => {
    const nextTags = [...new Set([...(profileDraft.publicTags || []), tag])].slice(0, 24);
    const nextDraft = { ...profileDraft, publicTags: nextTags };
    setProfileDraft(nextDraft);
    await saveProfile(nextDraft);
  };

  const createAnotherRoom = async () => {
    setRoomStatus('正在创建房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ name: roomDraft, slug: slugifyRoom(roomDraft) })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
      await refreshRooms();
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const joinAnotherRoom = async () => {
    const raw = inviteDraft.trim();
    let parsed = raw;
    if (raw.includes('room=')) {
      try {
        parsed = new URL(raw, window.location.origin).searchParams.get('room') || '';
      } catch {
        parsed = raw.replace(/^.*room=/, '').split('&')[0];
      }
    }
    if (!parsed) return;
    setRoomStatus('正在加入房间');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ action: 'join', roomId: parsed, password: invitePassword })
      });
      setRoom(data.room);
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
      await refreshRooms();
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const saveRoomSettings = async () => {
    if (!room) return;
    setRoomStatus('正在保存房间设置');
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({
          action: 'settings',
          roomId: room.id,
          ...roomSettingsDraft,
          heroConfig: normalizeHeroConfig(roomSettingsDraft.heroConfig, room)
        })
      });
      setRoom(data.room);
      await refreshRooms();
      setRoomStatus('房间设置已保存');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const switchRoom = async (roomId) => {
    setRoomStatus('正在切换房间');
    try {
      const data = await api(`/api/rooms?roomId=${encodeURIComponent(roomId)}`, { session });
      setRoom(data.room);
      setItems([]);
      setComments([]);
      setActiveId('');
      setMode('showroom');
      window.history.replaceState(null, '', `?room=${encodeURIComponent(data.room.id)}`);
      setRouteState(parseRoomQuery());
      setRoomStatus('');
    } catch (error) {
      setRoomStatus(error.message);
    }
  };

  const loadRatingSummary = async (itemId = activeItem?.id) => {
    if (!room?.id || !itemId || !session?.token) return;
    try {
      const data = await api(`/api/ratings?roomId=${encodeURIComponent(room.id)}&itemId=${encodeURIComponent(itemId)}`, { session });
      const current = useAppStore.getState().ratingsByItem;
      setRatingsByItem({ ...current, [itemId]: data });
    } catch {
      const current = useAppStore.getState().ratingsByItem;
      setRatingsByItem({ ...current, [itemId]: { average: 0, count: 0, mine: null } });
    }
  };

  const submitRating = async (score) => {
    if (!room?.id || !activeItem?.id) return;
    setRatingStatus('saving');
    try {
      await api(`/api/ratings?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ itemId: activeItem.id, score })
      });
      await loadRatingSummary(activeItem.id);
      setRatingStatus('cloud');
    } catch (error) {
      setRatingStatus(error.message);
    }
  };

  const runOnlineSearch = async (overrides = {}) => {
    setSearchStatus('searching');
    setAddError('');
    setSelectedCandidate(null);
    try {
      const nextQuery = String(overrides.query ?? query).trim();
      const nextArtistQuery = String(overrides.artistQuery ?? artistQuery).trim();
      const explicitLink = String(overrides.link ?? link).trim();
      const pastedLink = explicitLink || (/^https?:\/\//i.test(nextQuery) ? nextQuery : '');
      if (pastedLink) {
        const resolvedData = await api(`/api/resolve-link?input=${encodeURIComponent(pastedLink)}`);
        setResolvedLink(resolvedData);
      } else {
        setResolvedLink(null);
      }
      const searchTerm = pastedLink || [nextArtistQuery, nextQuery].filter(Boolean).join(' ').trim();
      const params = new URLSearchParams({
        term: searchTerm,
        type: searchType,
        title: pastedLink ? '' : nextQuery,
        artist: pastedLink ? '' : nextArtistQuery,
        link: pastedLink
      });
      const data = await api(`/api/search?${params.toString()}`);
      setCandidates(data.candidates || []);
      setSelectedCandidate(null);
      setSearchStatus(`found-${data.candidates?.length || 0}`);
    } catch (error) {
      setSearchStatus(`error-${error.message}`);
    }
  };

  const completeBackground = async (candidate) => {
    setAddPhase('ai');
    setBackgroundStatus('thinking');
    try {
      const data = await apiWithTimeout('/api/ai/background', {
        session,
        method: 'POST',
        body: JSON.stringify({ item: candidate })
      }, 245000);
      if (!data.background && !data.aiProfile) {
        throw new Error(data.error || '导览没有生成可用内容，本次没有写入展柜，请重试。');
      }
      setBackgroundStatus('done');
      return {
        ...candidate,
        background: data.background || candidate.context,
        context: data.background || candidate.context,
        aiProfile: data.aiProfile
          ? { ...data.aiProfile, sources: data.research?.sources || data.aiProfile.sources || [] }
          : candidate.aiProfile,
        tags: [...new Set([...(candidate.tags || []), ...(data.tags || [])])].slice(0, 8)
      };
    } catch (error) {
      setBackgroundStatus('error');
      throw error;
    }
  };

  const addSelectedToShowroom = async () => {
    if (!selectedCandidate || !room) return false;
    setItemStatus('adding');
    setAddPhase('metadata');
    setAddError('');
    try {
      const enriched = await completeBackground(selectedCandidate);
      setAddPhase('writing');
      const data = await api(`/api/items?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify(enriched)
      });
      setItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
      setActiveId(data.item.id);
      openItemDetail(data.item.id);
      setItemStatus('cloud');
      await loadRoomData(room, { preserveActive: true });
      setAddPhase('done');
      return true;
    } catch (error) {
      setAddError(error.message);
      setItemStatus('error');
      setBackgroundStatus('error');
      setAddPhase('error');
      return false;
    }
  };

  const submitComment = async () => {
    const text = draft.trim();
    if (!text || !activeItem || !room) return;
    const tempId = `temp-comment-${Date.now()}`;
    const optimistic = {
      id: tempId,
      text,
      mood: '9.0',
      albumId: activeItem.id,
      albumTitle: activeItem.title,
      author: session.user.name,
      avatar: session.user.avatar,
      pending: true,
      createdAt: new Date().toISOString()
    };
    // 乐观更新：立即插入临时评论，输入框清空，等待 API 往返
    setComments((current) => [optimistic, ...current]);
    setDraft('');
    setCommentStatus('sending');
    try {
      const data = await api(`/api/comments?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ text, mood: '9.0', albumId: activeItem.id, albumTitle: activeItem.title })
      });
      // 成功：用真实数据替换临时评论
      setComments((current) => current.map((entry) => (entry.id === tempId ? data.comment : entry)));
      setCommentStatus('cloud');
      setCommentAiStatus('thinking');
      api(`/api/ai/comment?roomId=${encodeURIComponent(room.id)}`, {
        session,
        method: 'POST',
        body: JSON.stringify({ item: activeItem, comment: data.comment })
      })
        .then((reply) => {
          if (reply.comment) setComments((current) => [reply.comment, ...current]);
          setCommentAiStatus('done');
        })
        .catch((error) => {
          setCommentAiStatus(error.message || 'error');
        });
    } catch (error) {
      // 失败：移除临时评论、还原草稿、弹出错误 toast
      setComments((current) => current.filter((entry) => entry.id !== tempId));
      setDraft(text);
      setCommentStatus(error.message || '发送失败');
      toast.error('评论发送失败', { description: error.message || '网络异常，请稍后重试' });
    }
  };

  const askAi = async () => {
    if (!activeItem) return;
    setAiStatus('thinking');
    try {
      const data = await api('/api/ai/recommend', {
        session,
        method: 'POST',
        body: JSON.stringify({ album: activeItem, comments: activeComments })
      });
      setAiInsight(data.text);
      setAiStatus('done');
    } catch (error) {
      setAiInsight(error.message);
      setAiStatus('error');
    }
  };

  const deleteItem = async (item) => {
    if (!item || !room) return;
    setItemStatus('正在删除');
    try {
      await api(`/api/items?roomId=${encodeURIComponent(room.id)}&itemId=${encodeURIComponent(item.id)}`, { session, method: 'DELETE' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setActiveId((current) => (current === item.id ? '' : current));
      setItemStatus('cloud');
      await loadRoomData(room, { preserveActive: true });
    } catch (error) {
      setItemStatus(error.message);
    }
  };

  const deleteComment = async (comment) => {
    if (!comment || !room) return;
    setCommentStatus('正在删除');
    try {
      await api(`/api/comments?roomId=${encodeURIComponent(room.id)}&commentId=${encodeURIComponent(comment.id)}`, { session, method: 'DELETE' });
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
      setCommentStatus('cloud');
    } catch (error) {
      setCommentStatus(error.message);
    }
  };

  const requestConfirm = ({ title, message, confirmLabel = '确认', tone = 'danger', action }) => {
    setConfirmAction({ title, message, confirmLabel, tone, action });
  };

  const closeConfirm = () => setConfirmAction(null);

  const confirmDeleteItem = (item) => requestConfirm({
    title: '删除这个展柜条目？',
    message: `《${item?.title || '这个条目'}》会从当前房间移除，相关评论不会自动改写。`,
    confirmLabel: '删除条目',
    action: () => deleteItem(item)
  });

  const confirmDeleteComment = (comment) => requestConfirm({
    title: '删除这条评论？',
    message: '这条评论会从房间里移除。删除后不能从界面恢复。',
    confirmLabel: '删除评论',
    action: () => deleteComment(comment)
  });

  const loadAdmin = async () => {
    if (session?.user?.role !== 'admin') return;
    setAdminStatus('正在加载管理数据');
    try {
      const data = await api('/api/admin', { session });
      setAdminData(data);
      setAiPromptDraft(data.config?.customPrompt || '');
      setPersonaPromptDraft(data.config?.personaPrompt || '');
      setAiMaxTokens(data.config?.maxTokens || 2100);
      setPersonaMaxTokens(data.config?.personaMaxTokens || 16000);
      setPersonaChatMaxTokens(data.config?.personaChatMaxTokens || 5200);
      setAiTemperature(data.config?.temperature ?? 0.5);
      setPersonaTemperature(data.config?.personaTemperature ?? 0.72);
      setAdminStatus('');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const saveAiConfig = async () => {
    setAdminStatus('正在保存 AI 配置');
    try {
      const data = await api('/api/admin?action=config', {
        session,
        method: 'POST',
        body: JSON.stringify({
          customPrompt: aiPromptDraft,
          personaPrompt: personaPromptDraft,
          maxTokens: aiMaxTokens,
          personaMaxTokens,
          personaChatMaxTokens,
          temperature: aiTemperature,
          personaTemperature
        })
      });
      setAdminData((current) => ({ ...(current || {}), config: data.config }));
      setAdminStatus('AI 配置已保存');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const adminDeleteRoom = async (roomId) => {
    setAdminStatus('正在删除房间');
    try {
      await api(`/api/admin?action=room&roomId=${encodeURIComponent(roomId)}`, { session, method: 'DELETE' });
      if (room?.id === roomId) {
        setRoom(null);
        setItems([]);
        setComments([]);
      }
      await loadAdmin();
      setAdminStatus('房间已删除');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const adminDeleteUser = async (userId) => {
    setAdminStatus('正在删除用户');
    try {
      await api(`/api/admin?action=user&userId=${encodeURIComponent(userId)}`, { session, method: 'DELETE' });
      await loadAdmin();
      setAdminStatus('用户已删除');
    } catch (error) {
      setAdminStatus(error.message);
    }
  };

  const confirmAdminDeleteRoom = (roomId) => requestConfirm({
    title: '删除这个房间？',
    message: `房间 ${roomId} 的展柜、评论和成员记录都会被移除。`,
    confirmLabel: '删除房间',
    action: () => adminDeleteRoom(roomId)
  });

  const confirmAdminDeleteUser = (userId) => requestConfirm({
    title: '删除这个用户？',
    message: `用户 ${userId} 将无法继续使用当前账号数据。`,
    confirmLabel: '删除用户',
    action: () => adminDeleteUser(userId)
  });

  useEffect(() => {
    if (mode === 'admin') loadAdmin();
    if (mode === 'profile') loadProfileStats();
  }, [mode, session?.user?.role]);

  if (!session?.token) return <AuthGate />;
  if (!room) return <RoomGate />;
  const isWorking = searchStatus === 'searching' || backgroundStatus === 'thinking' || itemStatus === 'adding' || ratingStatus === 'saving';
  const isDetailPage = mode === 'showroom' && routeState.itemId && routeItem;
  const isCabinetPage = mode === 'showroom' && !isDetailPage;
  const showInspector = mode === 'room';

  const navItems = [
    ['showroom', Grid3X3, '展柜'],
    ['add', CirclePlus, '添加'],
    ['review', MessageCircle, '评论'],
    ['ai', Bot, 'AI'],
    ['room', Users, '房间'],
    ['profile', UserRound, '我的'],
    ...(session.user.role === 'admin' ? [['admin', LockKeyhole, '管理']] : [])
  ];

  const goToMode = (key) => {
    if (key === 'showroom') {
      openCabinet({ mineOnly: routeState.mineOnly || userSettings.filters.mineOnly });
      return;
    }
    setMode(key);
  };

  return (
    <div
      className={[
        'relative min-h-screen isolate bg-ink-950 text-paper',
        reduceMotion ? 'reduce-motion' : ''
      ].filter(Boolean).join(' ')}
      style={{
        '--cover-a': palette[0],
        '--cover-b': palette[1],
        '--cover-c': palette[2],
        '--cover-image': cssImageUrl(activeItem?.cover || ''),
        '--glass-alpha': glass / 100
      }}
    >
      {/* 氛围背景 */}
      <div data-aurora className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-[12%] -top-[18%] h-[58vmax] w-[58vmax] animate-drift rounded-full opacity-[0.28] blur-[130px]"
          style={{ background: 'var(--cover-a)' }}
        />
        <div
          className="absolute -right-[16%] top-[18%] h-[50vmax] w-[50vmax] animate-drift rounded-full opacity-[0.22] blur-[120px] [animation-delay:-8s]"
          style={{ background: 'var(--cover-b)' }}
        />
        <div
          className="absolute -bottom-[22%] left-[18%] h-[46vmax] w-[46vmax] animate-drift rounded-full opacity-[0.16] blur-[110px] [animation-delay:-15s]"
          style={{ background: 'var(--cover-c)' }}
        />
        <div className="absolute inset-0 bg-ink-950/60" />
      </div>

      <Toaster position="bottom-right" theme="dark" duration={4000} closeButton offset={20} gap={12} />
      {isWorking && userSettings.appearance.rainbowStatus ? <div className="ac-rainbow-frame" aria-hidden="true" /> : null}

      <a className="skip-link" href="#main-content">跳到主要内容</a>

      {/* 顶栏 */}
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-ink-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1680px] items-center gap-3 px-3 py-2.5 md:gap-4 md:px-6 md:py-3">
          <button
            type="button"
            onClick={() => setCorridorOpen(true)}
            aria-label="打开隐藏封面长廊"
            title="隐藏封面长廊"
            className="group/brand flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60"
          >
            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-ink-700 to-ink-950 ring-1 ring-white/12">
              <span
                className="h-9 w-9 animate-slow-spin rounded-full [animation-duration:9s]"
                style={{ background: 'conic-gradient(from 0deg, rgba(255,255,255,0.02), rgba(255,255,255,0.16), rgba(255,255,255,0.02))' }}
                aria-hidden="true"
              />
              <span className="absolute h-2.5 w-2.5 rounded-full" style={{ background: 'var(--cover-a)' }} aria-hidden="true" />
            </span>
            <span className="hidden min-w-0 flex-col text-left sm:flex">
              <strong className="max-w-[180px] truncate text-[0.86rem] font-bold text-paper">{room.name}</strong>
              <span className="text-[0.68rem] text-paper-faint">Album Circle · {items.length} 个展柜条目</span>
            </span>
          </button>

          <nav className="hidden shrink-0 items-center gap-0.5 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 md:flex" aria-label="模式">
            {navItems.map(([key, Icon, label]) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => goToMode(key)}
                  className={[
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.76rem] font-semibold transition-all duration-200 ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky/60',
                    active
                      ? 'bg-paper text-ink-900 shadow-soft'
                      : 'text-paper-faint hover:bg-white/[0.06] hover:text-paper'
                  ].join(' ')}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span className="hidden lg:inline">{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            <GlobalMusicSearch
              room={room}
              session={session}
              searchType={searchType}
              setSearchType={setSearchType}
              runSearch={runOnlineSearch}
              query={query}
              setQuery={setQuery}
              artistQuery={artistQuery}
              setArtistQuery={setArtistQuery}
              link={link}
              setLink={setLink}
              searchStatus={searchStatus}
              candidates={candidates}
              selectedCandidate={selectedCandidate}
              setSelectedCandidate={setSelectedCandidate}
              addSelectedToShowroom={addSelectedToShowroom}
              isAdding={backgroundStatus === 'thinking' || itemStatus === 'adding'}
              addPhase={addPhase}
              addError={addError}
            />
          </div>

          <div className="hidden shrink-0 items-center sm:flex" role="group" aria-label="房间成员">
            {visibleTopbarMembers.map((member) => (
              <button
                key={member.id || member.name}
                type="button"
                aria-label={`查看 ${member.name} 的公开资料`}
                title={`查看 ${member.name} 的公开资料`}
                onClick={() => setSelectedMemberId(member.id)}
                className="-ml-2 rounded-full ring-2 ring-ink-950 transition-all duration-200 ease-spring first:ml-0 hover:z-10 hover:-translate-y-0.5 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky"
              >
                <UserAvatar user={member} />
              </button>
            ))}
            {hiddenTopbarMemberCount > 0 ? (
              <button
                type="button"
                aria-label={`还有 ${hiddenTopbarMemberCount} 位房间成员，进入房间查看`}
                title={`还有 ${hiddenTopbarMemberCount} 位房间成员`}
                onClick={() => setMode('room')}
                className="-ml-2 grid h-8 w-8 place-items-center rounded-full border border-white/12 bg-ink-800 text-[0.68rem] font-bold text-paper-dim ring-2 ring-ink-950 transition hover:bg-ink-700 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-sky"
              >
                +{hiddenTopbarMemberCount}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main
        id="main-content"
        className={[
          'mx-auto w-full max-w-[1680px] pb-24 md:pb-6',
          showInspector ? 'grid gap-4 px-0 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] xl:px-6 xl:py-4' : ''
        ].join(' ')}
      >
        <section className="min-w-0">
          {mode === 'showroom' && (
            isDetailPage ? (
              <AlbumDetailPage
                items={items}
                activeItem={activeItem}
                activeComments={activeComments}
                draft={draft}
                setDraft={setDraft}
                submitComment={submitComment}
                commentStatus={commentStatus}
                commentAiStatus={commentAiStatus}
                setActiveId={setActiveId}
                setMode={setMode}
                openCabinet={openCabinet}
                openItemDetail={openItemDetail}
                askAi={askAi}
                itemStatus={itemStatus}
                session={session}
                deleteItem={confirmDeleteItem}
                deleteComment={confirmDeleteComment}
                memberProfilesById={memberProfilesById}
                openMember={setSelectedMemberId}
                ratingSummary={ratingsByItem[activeItem.id]}
                submitRating={submitRating}
                ratingStatus={ratingStatus}
                loading={initialLoading}
                userSettings={userSettings}
              />
            ) : (
              <AlbumCabinetPage />
            )
          )}
          {mode === 'add' && (
            <AddMusic
              query={query} setQuery={setQuery} artistQuery={artistQuery} setArtistQuery={setArtistQuery}
              link={link} setLink={setLink} searchType={searchType} setSearchType={setSearchType}
              setSearchStatus={setSearchStatus} setCandidates={setCandidates} resolvedLink={resolvedLink}
              runOnlineSearch={runOnlineSearch} searchStatus={searchStatus} candidates={candidates}
              selectedCandidate={selectedCandidate} setSelectedCandidate={setSelectedCandidate}
              addSelectedToShowroom={addSelectedToShowroom} backgroundStatus={backgroundStatus}
              itemStatus={itemStatus} addPhase={addPhase} addError={addError}
            />
          )}
          {mode === 'review' && (
            <Review
              selected={activeItem} comments={activeComments} draft={draft} setDraft={setDraft}
              submitComment={submitComment} commentStatus={commentStatus} commentAiStatus={commentAiStatus}
              session={session} deleteComment={confirmDeleteComment} memberProfilesById={memberProfilesById}
              openMember={setSelectedMemberId} loading={initialLoading}
            />
          )}
          {mode === 'ai' && <Ai selected={activeItem} aiInsight={aiInsight} aiStatus={aiStatus} askAi={askAi} />}
          {mode === 'room' && (
            <RoomPanel
              room={room} roomUrl={roomUrl} session={session} comments={comments} items={items}
              knownRooms={knownRooms} discoverRooms={discoverRooms} switchRoom={switchRoom}
              roomDraft={roomDraft} setRoomDraft={setRoomDraft} createAnotherRoom={createAnotherRoom}
              inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} invitePassword={invitePassword}
              setInvitePassword={setInvitePassword} joinAnotherRoom={joinAnotherRoom} roomStatus={roomStatus}
              roomSettingsDraft={roomSettingsDraft} setRoomSettingsDraft={setRoomSettingsDraft}
              saveRoomSettings={saveRoomSettings} userSettings={userSettings} saveUserSettings={saveUserSettings}
            />
          )}
          {mode === 'profile' && (
            <ProfilePanel
              session={session} profileDraft={profileDraft} setProfileDraft={setProfileDraft}
              saveProfile={saveProfile} uploadAvatar={uploadAvatar} profileStats={profileStats}
              profileStatus={profileStatus} loadProfileStats={loadProfileStats}
              fillProfileFromHistory={fillProfileFromHistory} personaTone={personaTone}
              setPersonaTone={setPersonaTone} personaHistoryMode={personaHistoryMode}
              setPersonaHistoryMode={setPersonaHistoryMode} personaSelectedIds={personaSelectedIds}
              togglePersonaItem={togglePersonaItem} generatePersona={generatePersona}
              personaStatus={personaStatus} personaReport={personaReport} addPublicTag={addPublicTag}
              personaQuestion={personaQuestion} setPersonaQuestion={setPersonaQuestion}
              askPersona={askPersona} personaChat={personaChat} personaChatStatus={personaChatStatus}
              startRitual={fetchPersonaQuiz} openShareCard={() => setShareCardOpen(true)}
            />
          )}
          {mode === 'admin' && (
            <AdminPanel
              adminData={adminData} adminStatus={adminStatus} loadAdmin={loadAdmin}
              deleteRoom={confirmAdminDeleteRoom} deleteUser={confirmAdminDeleteUser}
              aiPromptDraft={aiPromptDraft} setAiPromptDraft={setAiPromptDraft}
              personaPromptDraft={personaPromptDraft} setPersonaPromptDraft={setPersonaPromptDraft}
              aiMaxTokens={aiMaxTokens} setAiMaxTokens={setAiMaxTokens}
              personaMaxTokens={personaMaxTokens} setPersonaMaxTokens={setPersonaMaxTokens}
              personaChatMaxTokens={personaChatMaxTokens} setPersonaChatMaxTokens={setPersonaChatMaxTokens}
              aiTemperature={aiTemperature} setAiTemperature={setAiTemperature}
              personaTemperature={personaTemperature} setPersonaTemperature={setPersonaTemperature}
              saveAiConfig={saveAiConfig}
            />
          )}
        </section>

        {showInspector ? (
          <aside className="ac-card mx-4 mb-4 h-fit space-y-4 p-5 xl:sticky xl:top-[76px] xl:mx-0 xl:mb-0" aria-label="房间状态">
            <div className="ac-section-title">
              <Wand2 size={17} className="text-accent-gold" aria-hidden="true" />
              <h2 className="text-[0.95rem] font-bold text-paper">房间状态</h2>
            </div>

            <div className="space-y-1.5">
              {[
                ['账号', session.user.name],
                ['房间', room.name],
                ['展柜', `${items.length} 个条目`],
                ['评论', `${comments.length} 条评论`],
                ['同步', itemStatus === 'cloud' && commentStatus === 'cloud' ? '已连接' : '同步中']
              ].map(([name, detail], index) => (
                <div key={name} className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-sky/15 text-[0.68rem] font-bold text-accent-sky">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-[0.76rem] font-semibold text-paper-dim">{name}</strong>
                    <p className="truncate text-[0.8rem] text-paper">{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-white/[0.07] pt-4">
              <button type="button" className="ac-btn ac-btn-ghost w-full justify-center" onClick={askAi} disabled={!activeItem}>
                <Bot size={15} aria-hidden="true" />围绕当前条目请求 AI
              </button>
              {aiInsight ? (
                <p className="rounded-lg border border-accent-purple/20 bg-accent-purple/[0.08] p-3 text-[0.8rem] leading-relaxed text-paper-dim">
                  {aiInsight}
                </p>
              ) : null}
              <label className="ac-field">
                <span className="flex items-center justify-between">
                  玻璃强度
                  <b className="font-bold tabular-nums text-accent-sky">{glass}</b>
                </span>
                <input
                  type="range"
                  className="ac-range"
                  min="35"
                  max="82"
                  value={glass}
                  onChange={(event) => setGlass(Number(event.target.value))}
                />
              </label>
              <button type="button" className="ac-btn ac-btn-ghost w-full justify-center" onClick={() => setReduceMotion((value) => !value)}>
                {reduceMotion ? '恢复动效' : '减少动效'}
              </button>
            </div>
          </aside>
        ) : null}
      </main>

      {/* 移动端底部导航 */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-ink-950/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="模式"
      >
        <div className="ac-scroll flex items-stretch justify-around overflow-x-auto">
          {navItems.map(([key, Icon, label]) => {
            const active = mode === key;
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => goToMode(key)}
                className={[
                  'relative flex min-w-[56px] flex-1 flex-col items-center gap-0.5 px-2 py-2.5 text-[0.64rem] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-sky/60',
                  active ? 'text-accent-sky' : 'text-paper-faint'
                ].join(' ')}
              >
                {active ? (
                  <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent-sky" aria-hidden="true" />
                ) : null}
                <Icon size={18} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {selectedMember ? (
        <MemberProfileModal
          member={selectedMember}
          items={selectedMemberItems}
          close={() => setSelectedMemberId('')}
          openItem={(itemId) => {
            setSelectedMemberId('');
            openItemDetail(itemId);
          }}
        />
      ) : null}

      <ExperimentalCorridorCarousel
        open={corridorOpen}
        onClose={() => setCorridorOpen(false)}
        items={items}
        activeItem={activeItem}
        roomName={room.name}
        reduceMotion={reduceMotion}
        openItemDetail={openItemDetail}
      />

      <PersonaQuest
        report={personaReport}
        userName={session.user.name}
        onSubmit={finishRitual}
        onRetryQuiz={fetchPersonaQuiz}
        onViewReport={closeRitualToReport}
        onOpenShare={() => setShareCardOpen(true)}
      />

      <PersonaShareCard
        open={shareCardOpen}
        onClose={() => setShareCardOpen(false)}
        report={personaReport}
        userName={session.user.name}
        shareUrl={roomUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?host=${encodeURIComponent(session.user.uid || session.user.name || '')}` : '')}
      />

      {confirmAction ? <ConfirmDialog config={confirmAction} close={closeConfirm} /> : null}
    </div>
  );
}
