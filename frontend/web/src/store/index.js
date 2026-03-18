import { create } from "zustand";
import { persist } from "zustand/middleware";

const INITIAL_BELIEFS = { recruiter: 20, date: 35, competitor: 18, journalist: 28 };

export const useMirrorStore = create(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      profile: null,
      setProfile: (profile) => set({ profile }),
      screen: "splash",
      setScreen: (screen) => set({ screen }),
      activePersonaId: null,
      setActivePersona: (id) => set({ activePersonaId: id }),
      beliefs: INITIAL_BELIEFS,
      updateBelief: (personaId, value) =>
        set((state) => ({ beliefs: { ...state.beliefs, [personaId]: Math.min(95, Math.max(5, value)) } })),
      updateBeliefs: (updates) =>
        set((state) => ({ beliefs: { ...state.beliefs, ...updates } })),
      completedPersonas: [],
      markPersonaComplete: (personaId) =>
        set((state) => ({
          completedPersonas: state.completedPersonas.includes(personaId)
            ? state.completedPersonas
            : [...state.completedPersonas, personaId],
        })),
      gapScore: 72,
      setGapScore: (score) => set({ gapScore: score }),
      conversations: {},
      addMessage: (personaId, message) =>
        set((state) => ({
          conversations: { ...state.conversations, [personaId]: [...(state.conversations[personaId] || []), message] },
        })),
      setConversation: (personaId, messages) =>
        set((state) => ({ conversations: { ...state.conversations, [personaId]: messages } })),
      clearConversation: (personaId) =>
        set((state) => ({ conversations: { ...state.conversations, [personaId]: [] } })),
      perceptionMap: null,
      setPerceptionMap: (map) => set({ perceptionMap: map }),
      archetype: null,
      setArchetype: (archetype) => set({ archetype }),
      mirrorMoment: null,
      setMirrorMoment: (moment) => set({ mirrorMoment: moment }),
      lastConfrontation: null,
      setLastConfrontation: (result) => set({ lastConfrontation: result }),
      streaks: {},
      streakLastDate: {},
      /**
       * Daily streaks: first interaction with a persona per day increments.
       * If you skip days, streak resets to 0 before incrementing for today.
       */
      updateStreak: (personaId) =>
        set((state) => {
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
          const last = state.streakLastDate?.[personaId] || null;
          if (last === today) return state; // already counted today

          const prevStreak = state.streaks?.[personaId] || 0;
          let nextStreak = 1;
          if (last) {
            const lastDate = new Date(last + "T00:00:00Z");
            const todayDate = new Date(today + "T00:00:00Z");
            const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));
            nextStreak = diffDays === 1 ? prevStreak + 1 : 1;
          }

          return {
            streaks: { ...state.streaks, [personaId]: nextStreak },
            streakLastDate: { ...(state.streakLastDate || {}), [personaId]: today },
          };
        }),
      reset: () =>
        set({
          user: null,
          profile: null,
          screen: "splash",
          activePersonaId: null,
          beliefs: INITIAL_BELIEFS,
          completedPersonas: [],
          gapScore: 72,
          conversations: {},
          perceptionMap: null,
          archetype: null,
          mirrorMoment: null,
          lastConfrontation: null,
          streaks: {},
          streakLastDate: {},
        }),
    }),
    {
      name: "mirror-store",
      partialize: (state) => ({
        beliefs: state.beliefs,
        completedPersonas: state.completedPersonas,
        gapScore: state.gapScore,
        archetype: state.archetype,
        streaks: state.streaks,
        streakLastDate: state.streakLastDate,
      }),
    }
  )
);
