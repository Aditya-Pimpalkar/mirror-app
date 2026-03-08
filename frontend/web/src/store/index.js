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
      updateStreak: (personaId, beliefImproved) =>
        set((state) => ({
          streaks: { ...state.streaks, [personaId]: beliefImproved ? (state.streaks[personaId] || 0) + 1 : 0 },
        })),
      reset: () => set({ user: null, profile: null, screen: "splash", activePersonaId: null, beliefs: INITIAL_BELIEFS, completedPersonas: [], gapScore: 72, conversations: {}, perceptionMap: null, archetype: null, mirrorMoment: null, lastConfrontation: null, streaks: {} }),
    }),
    {
      name: "mirror-store",
      partialize: (state) => ({ beliefs: state.beliefs, completedPersonas: state.completedPersonas, gapScore: state.gapScore, archetype: state.archetype, streaks: state.streaks }),
    }
  )
);
