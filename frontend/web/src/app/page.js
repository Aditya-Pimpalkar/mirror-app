"use client";
// src/app/page.js
// Main app — handles auth + screen routing

import { useEffect, useState } from "react";
import { auth, signInAnon, onAuthStateChanged } from "../lib/firebase";
import { getProfile } from "../lib/api";
import { useMirrorStore } from "../store";

// Screens
import Splash from "../components/Splash";
import Onboarding from "../components/onboarding/Onboarding";
import Home from "../components/Home";
import Chat from "../components/personas/Chat";
import PerceptionMap from "../components/map/PerceptionMap";
import Timeline from "../components/Timeline";
import Confrontation from "../components/confrontation/Confrontation";
import Archetype from "../components/Archetype";

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const { screen, setScreen, setUser, setProfile, profile } = useMirrorStore();

  // ── Auth init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser({ uid: user.uid, isAnonymous: user.isAnonymous });

        // Check if user has a profile already
        try {
          const profileData = await getProfile();
          if (profileData.exists) {
            setProfile(profileData);
            setScreen("home");
          } else {
            setScreen("onboarding");
          }
        } catch {
          setScreen("onboarding");
        }
      } else {
        // Not signed in — show splash
        setScreen("splash");
      }
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  // ── Auto sign in anonymously when app loads ───────────────────────────────
  useEffect(() => {
    if (authReady) return;
    // Pre-emptively sign in anonymously for zero friction
    signInAnon().catch((err) => {
      console.error("Anonymous sign-in failed:", err);
    });
  }, []);

  if (!authReady) {
    return (
      <div className="ambient-glow noise-overlay" style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: 480,
        margin: "0 auto",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🪞</div>
          <div className="label" style={{ color: "var(--gold)", letterSpacing: "0.3em" }}>
            MIRROR
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="ambient-glow noise-overlay" style={{
      position: "relative",
      zIndex: 1,
      minHeight: "100vh",
    }}>
      {screen === "splash" && <Splash />}
      {screen === "onboarding" && <Onboarding />}
      {screen === "home" && <Home />}
      {screen === "chat" && <Chat />}
      {screen === "map" && <PerceptionMap />}
      {screen === "timeline" && <Timeline />}
      {screen === "confrontation" && <Confrontation />}
      {screen === "archetype" && <Archetype />}
    </main>
  );
}
