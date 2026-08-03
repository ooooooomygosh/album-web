import { create } from 'zustand';
import {
  api,
  loadJson,
  mergeUserSettings,
  parseRoomQuery,
  profileToDraft,
  publicMemberProfile,
  roomQueryUrl,
  saveJson,
  slugifyRoom,
} from '../lib/utils.js';

const SESSION_KEY = 'album-circle-session';

export const useAppStore = create((set, get) => ({
  /* ---------- session ---------- */
  session: loadJson(SESSION_KEY, null),
  setSession: (session) => {
    if (session) saveJson(SESSION_KEY, session);
    else localStorage.removeItem(SESSION_KEY);
    set({ session });
  },
  authStatus: '',
  setAuthStatus: (authStatus) => set({ authStatus }),

  login: async ({ email, password }) => {
    set({ authStatus: '正在连接账户' });
    try {
      const data = await api('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const session = { token: data.token, user: data.user };
      saveJson(SESSION_KEY, session);
      set({ session, authStatus: '' });
      return session;
    } catch (error) {
      set({ authStatus: error.message });
      throw error;
    }
  },

  signup: async ({ email, password, name, avatar }) => {
    set({ authStatus: '正在连接账户' });
    try {
      const data = await api('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: 'signup', email, password, name, avatar }),
      });
      const session = { token: data.token, user: data.user };
      saveJson(SESSION_KEY, session);
      set({ session, authStatus: '' });
      return session;
    } catch (error) {
      set({ authStatus: error.message });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    set({ session: null });
  },

  refreshUser: async () => {
    const { session } = get();
    if (!session?.token) return;
    try {
      const data = await api('/api/auth', { session });
      const next = { ...session, user: data.user };
      saveJson(SESSION_KEY, next);
      set({ session: next });
      return next;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      set({ session: null });
    }
  },

  /* ---------- room ---------- */
  room: null,
  setRoom: (room) => set({ room }),
  knownRooms: [],
  discoverRooms: [],
  setKnownRooms: (knownRooms) => set({ knownRooms }),
  setDiscoverRooms: (discoverRooms) => set({ discoverRooms }),
  roomStatus: '',
  setRoomStatus: (roomStatus) => set({ roomStatus }),
  roomDraft: '新的听歌房间',
  setRoomDraft: (roomDraft) => set({ roomDraft }),

  refreshRooms: async () => {
    const { session } = get();
    if (!session?.token) return;
    const [mine, discover] = await Promise.all([
      api('/api/rooms', { session }),
      api('/api/rooms?scope=discover', { session }).catch(() => ({ rooms: [] })),
    ]);
    set({ knownRooms: mine.rooms || [], discoverRooms: discover.rooms || [] });
  },

  createRoom: async (name) => {
    const { session } = get();
    set({ roomStatus: '正在创建房间' });
    try {
      const data = await api('/api/rooms', {
        session,
        method: 'POST',
        body: JSON.stringify({ name, slug: slugifyRoom(name) }),
      });
      const room = data.room;
      window.history.replaceState(null, '', `?room=${encodeURIComponent(room.id)}`);
      set({ room, roomStatus: '' });
      return room;
    } catch (error) {
      set({ roomStatus: error.message });
      throw error;
    }
  },

  enterRoom: async (id) => {
    const { session } = get();
    if (!id) return;
    set({ roomStatus: '正在打开房间' });
    try {
      const data = await api(`/api/rooms?roomId=${encodeURIComponent(id)}`, { session });
      const room = data.room;
      window.history.replaceState(null, '', `?room=${encodeURIComponent(room.id)}`);
      set({ room, roomStatus: '' });
      return room;
    } catch (error) {
      set({ roomStatus: error.message });
      throw error;
    }
  },

  /* ---------- route & UI ---------- */
  routeState: parseRoomQuery(),
  setRouteState: (routeState) => set({ routeState }),
  openCabinet: (options = {}) => {
    const { room, routeState, userSettings, reduceMotion } = get();
    if (!room?.id) return;
    const mine = options.mineOnly ?? (routeState.mineOnly || userSettings.filters?.mineOnly);
    const nextUrl = roomQueryUrl(room.id, { view: 'cabinet', mine: mine ? '1' : '' });
    window.history.pushState(null, '', nextUrl);
    set({ routeState: parseRoomQuery(), mode: 'showroom' });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
  },
  openItemDetail: (itemId) => {
    const { room, routeState, items } = get();
    if (!room?.id || !itemId) return;
    if (items.length && !items.some((item) => item.id === itemId)) return;
    const nextUrl = roomQueryUrl(room.id, { item: itemId, mine: routeState.mineOnly ? '1' : '' });
    window.history.pushState(null, '', nextUrl);
    set({ activeId: itemId, routeState: parseRoomQuery(), mode: 'showroom' });
  },
  mode: 'showroom',
  setMode: (mode) => set({ mode }),
  addPanelOpen: false,
  setAddPanelOpen: (addPanelOpen) => set({ addPanelOpen }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  selectedMemberId: '',
  setSelectedMemberId: (selectedMemberId) => set({ selectedMemberId }),
  confirmAction: null,
  setConfirmAction: (confirmAction) => set({ confirmAction }),
  corridorOpen: false,
  setCorridorOpen: (corridorOpen) => set({ corridorOpen }),
  initialLoading: true,
  setInitialLoading: (initialLoading) => set({ initialLoading }),

  syncRoomMember: (user) => {
    if (!user?.id) return;
    set((state) => {
      if (!state.room?.id) return state;
      return {
        room: {
          ...state.room,
          memberProfiles: {
            ...(state.room.memberProfiles || {}),
            [user.id]: {
              ...(state.room.memberProfiles?.[user.id] || {}),
              ...publicMemberProfile(user, user.id),
            },
          },
        },
      };
    });
  },

  /* ---------- items & comments ---------- */
  items: [],
  setItems: (fnOrValue) => set((state) => ({
    items: typeof fnOrValue === 'function' ? fnOrValue(state.items) : fnOrValue,
  })),
  comments: [],
  setComments: (fnOrValue) => set((state) => ({
    comments: typeof fnOrValue === 'function' ? fnOrValue(state.comments) : fnOrValue,
  })),
  activeId: '',
  setActiveId: (fnOrValue) => set((state) => ({
    activeId: typeof fnOrValue === 'function' ? fnOrValue(state.activeId) : fnOrValue,
  })),
  ratingsByItem: {},
  setRatingsByItem: (fnOrValue) => {
    set((state) => ({
      ratingsByItem: typeof fnOrValue === 'function' ? fnOrValue(state.ratingsByItem) : fnOrValue,
    }));
  },
  loadRatingSummary: async (itemId) => {
    const { session, room, ratingsByItem } = get();
    if (!session?.token || !room?.id || !itemId || ratingsByItem[itemId]) return;
    try {
      const data = await api(`/api/ratings?roomId=${encodeURIComponent(room.id)}&itemId=${encodeURIComponent(itemId)}`, { session });
      set((state) => ({
        ratingsByItem: { ...state.ratingsByItem, [itemId]: data.ratingSummary || null },
      }));
    } catch {
      // 评分不是关键路径，静默失败
    }
  },

  loadRoomData: async (targetRoom, options = {}) => {
    const { session, activeId: currentActiveId, setItems, setComments, setActiveId, setItemStatus, setCommentStatus } = get();
    if (!session?.token || !targetRoom?.id) return;
    const [itemsData, commentsData] = await Promise.all([
      api(`/api/items?roomId=${encodeURIComponent(targetRoom.id)}`, { session }),
      api(`/api/comments?roomId=${encodeURIComponent(targetRoom.id)}`, { session }),
    ]);
    const nextItems = itemsData.items || [];
    setItems(nextItems);
    if (options.activeId !== undefined) {
      setActiveId(options.activeId);
    } else if (options.preserveActive) {
      setActiveId(currentActiveId || nextItems[0]?.id || '');
    } else {
      setActiveId(nextItems[0]?.id || '');
    }
    setComments(commentsData.comments || []);
    setItemStatus('cloud');
    setCommentStatus('cloud');
  },

  /* ---------- settings ---------- */
  userSettings: mergeUserSettings(),
  setUserSettings: (userSettings) => set({ userSettings }),
  saveUserSettings: async (patch) => {
    const { session, userSettings } = get();
    if (!session?.token) return;
    const nextSettings = mergeUserSettings({
      ...userSettings,
      ...patch,
      appearance: { ...userSettings.appearance, ...(patch.appearance || {}) },
      showroom: { ...userSettings.showroom, ...(patch.showroom || {}) },
      filters: { ...userSettings.filters, ...(patch.filters || {}) },
      persona: { ...userSettings.persona, ...(patch.persona || {}) },
    });
    set({
      userSettings: nextSettings,
      glass: nextSettings.appearance.glass,
      reduceMotion: nextSettings.appearance.reduceMotion,
      personaTone: nextSettings.persona.tone,
      personaHistoryMode: nextSettings.persona.historyMode,
    });
    const data = await api('/api/auth', {
      session,
      method: 'POST',
      body: JSON.stringify({ action: 'updateSettings', settings: nextSettings }),
    });
    const nextSession = { ...session, user: data.user };
    saveJson(SESSION_KEY, nextSession);
    set({ session: nextSession });
    return data.user.settings;
  },
  glass: mergeUserSettings().appearance.glass,
  setGlass: (glass) => set({ glass }),
  reduceMotion: mergeUserSettings().appearance.reduceMotion,
  setReduceMotion: (reduceMotion) => set({ reduceMotion }),
  personaTone: mergeUserSettings().persona.tone,
  setPersonaTone: (personaTone) => set({ personaTone }),
  personaHistoryMode: mergeUserSettings().persona.historyMode,
  setPersonaHistoryMode: (personaHistoryMode) => set({ personaHistoryMode }),

  /* ---------- search ---------- */
  query: '',
  setQuery: (query) => set({ query }),
  artistQuery: '',
  setArtistQuery: (artistQuery) => set({ artistQuery }),
  link: '',
  setLink: (link) => set({ link }),
  searchType: 'all',
  setSearchType: (searchType) => set({ searchType }),
  selectedCandidate: null,
  setSelectedCandidate: (selectedCandidate) => set({ selectedCandidate }),
  candidates: [],
  setCandidates: (candidates) => set({ candidates }),
  searchStatus: 'idle',
  setSearchStatus: (searchStatus) => set({ searchStatus }),
  aiInsight: '',
  setAiInsight: (aiInsight) => set({ aiInsight }),
  aiStatus: 'idle',
  setAiStatus: (aiStatus) => set({ aiStatus }),
  commentStatus: 'idle',
  setCommentStatus: (commentStatus) => set({ commentStatus }),
  itemStatus: 'idle',
  setItemStatus: (itemStatus) => set({ itemStatus }),
  backgroundStatus: 'idle',
  setBackgroundStatus: (backgroundStatus) => set({ backgroundStatus }),
  addPhase: 'idle',
  setAddPhase: (addPhase) => set({ addPhase }),
  commentAiStatus: 'idle',
  setCommentAiStatus: (commentAiStatus) => set({ commentAiStatus }),
  addError: '',
  setAddError: (addError) => set({ addError }),
  resolvedLink: null,
  setResolvedLink: (resolvedLink) => set({ resolvedLink }),

  /* ---------- admin / profile / persona ---------- */
  adminData: null,
  setAdminData: (adminData) => set({ adminData }),
  adminStatus: '',
  setAdminStatus: (adminStatus) => set({ adminStatus }),
  aiPromptDraft: '',
  setAiPromptDraft: (aiPromptDraft) => set({ aiPromptDraft }),
  personaPromptDraft: '',
  setPersonaPromptDraft: (personaPromptDraft) => set({ personaPromptDraft }),
  aiMaxTokens: 2100,
  setAiMaxTokens: (aiMaxTokens) => set({ aiMaxTokens }),
  personaMaxTokens: 16000,
  setPersonaMaxTokens: (personaMaxTokens) => set({ personaMaxTokens }),
  personaChatMaxTokens: 5200,
  setPersonaChatMaxTokens: (personaChatMaxTokens) => set({ personaChatMaxTokens }),
  aiTemperature: 0.5,
  setAiTemperature: (aiTemperature) => set({ aiTemperature }),
  personaTemperature: 0.72,
  setPersonaTemperature: (personaTemperature) => set({ personaTemperature }),

  profileDraft: profileToDraft(null),
  setProfileDraft: (profileDraft) => set({ profileDraft }),
  profileStats: null,
  setProfileStats: (profileStats) => set({ profileStats }),
  profileStatus: '',
  setProfileStatus: (profileStatus) => set({ profileStatus }),

  personaSelectedIds: [],
  setPersonaSelectedIds: (fnOrValue) => set((state) => ({
    personaSelectedIds: typeof fnOrValue === 'function' ? fnOrValue(state.personaSelectedIds) : fnOrValue,
  })),
  personaStatus: 'idle',
  setPersonaStatus: (personaStatus) => set({ personaStatus }),
  personaReport: null,
  setPersonaReport: (personaReport) => set({ personaReport }),
  personaQuestion: '',
  setPersonaQuestion: (personaQuestion) => set({ personaQuestion }),
  personaChatStatus: 'idle',
  setPersonaChatStatus: (personaChatStatus) => set({ personaChatStatus }),
  personaChat: [],
  setPersonaChat: (fnOrValue) => set((state) => ({
    personaChat: typeof fnOrValue === 'function' ? fnOrValue(state.personaChat) : fnOrValue,
  })),

  /* ---------- 灵魂仪式（全屏抽牌问卷） ---------- */
  // ritualPhase: 'idle' | 'summon' | 'quiz' | 'weaving' | 'reveal'
  ritualPhase: 'idle',
  setRitualPhase: (ritualPhase) => set({ ritualPhase }),
  ritualQuiz: null,
  setRitualQuiz: (ritualQuiz) => set({ ritualQuiz }),
  ritualStep: 0,
  setRitualStep: (fnOrValue) => set((state) => ({
    ritualStep: typeof fnOrValue === 'function' ? fnOrValue(state.ritualStep) : fnOrValue,
  })),
  ritualAnswers: [],
  setRitualAnswers: (fnOrValue) => set((state) => ({
    ritualAnswers: typeof fnOrValue === 'function' ? fnOrValue(state.ritualAnswers) : fnOrValue,
  })),
  ritualError: '',
  setRitualError: (ritualError) => set({ ritualError }),
  shareCardOpen: false,
  setShareCardOpen: (shareCardOpen) => set({ shareCardOpen }),
  resetRitual: () => set({ ritualPhase: 'idle', ritualQuiz: null, ritualStep: 0, ritualAnswers: [], ritualError: '' }),
}));

