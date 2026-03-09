"use client";
import { useEffect, useState } from "react";
import { auth, signInAnon, onAuthStateChanged } from "../lib/firebase";
import { getProfile } from "../lib/api";
import { useMirrorStore } from "../store";
import Splash from "../components/Splash";
import Onboarding from "../components/onboarding/Onboarding";
import Home from "../components/Home";
import Chat from "../components/personas/Chat";
import PerceptionMap from "../components/map/PerceptionMap";
import Timeline from "../components/Timeline";
import Confrontation from "../components/confrontation/Confrontation";
import Archetype from "../components/Archetype";
import ScenarioPrep from "../components/ScenarioPrep";

async function loadAllPersonaState(token, store) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/personas/all-status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return;
    const data = await res.json();

    data.personas?.forEach((p) => {
      store.updateBelief(p.personaId, p.currentBelief);
      if (p.conversationCount > 0) {
        store.markPersonaComplete(p.personaId);
      }
      if (p.messages?.length > 0) {
        store.setConversation(p.personaId, p.messages);
      }
    });
  } catch (err) {
    console.error("[loadAllPersonaState]", err.message);
  }
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const store = useMirrorStore();
  const { screen, setScreen, setUser, setProfile } = store;

  useEffect(() => {
    // Pre-emptive anonymous sign in
    signInAnon().catch(() => {});

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser({ uid: user.uid, isAnonymous: user.isAnonymous });

        try {
          // Check profile
          const profileData = await getProfile();
          if (profileData.exists) {
            setProfile(profileData);

            // Reload all persona state from Firestore
            const token = await user.getIdToken();
            await loadAllPersonaState(token, store);

            setScreen("home");
          } else {
            setScreen("onboarding");
          }
        } catch {
          setScreen("onboarding");
        }
      } else {
        setScreen("splash");
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", maxWidth: 480, margin: "0 auto", background: "var(--bg)" }}>
        <div style={{ textAlign: "center", animation: "fadeIn 0.6s ease" }}>
          <div style={{ fontSize: 52, marginBottom: 20, animation: "pulse 2s infinite" }}>🪞</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.6em", color: "var(--gold)", marginBottom: 24 }}>MIRROR</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--gold)", animation: `pulse 1.2s ${i * 0.2}s infinite` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="ambient-glow noise-overlay" style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>
      {screen === "splash"        && <Splash />}
      {screen === "onboarding"    && <Onboarding />}
      {screen === "home"          && <Home />}
      {screen === "chat"          && <Chat />}
      {screen === "map"           && <PerceptionMap />}
      {screen === "timeline"      && <Timeline />}
      {screen === "confrontation" && <Confrontation />}
      {screen === "archetype"     && <Archetype />}
      {screen === "scenario"      && <ScenarioPrep />}
    </main>
  );
}
