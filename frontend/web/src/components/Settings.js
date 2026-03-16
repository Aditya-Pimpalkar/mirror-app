"use client";
import { useState } from "react";
import { useMirrorStore } from "../store";
import { auth } from "../lib/firebase";
import { getIdToken } from "../lib/firebase";

function EditProfileForm({ initialBio, initialLinks, saving, onSave }) {
  const [bio, setBio] = useState(initialBio);
  const [links, setLinks] = useState(initialLinks);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div className="label" style={{ marginBottom: 8, color: "rgba(255,255,255,0.5)" }}>BIO</div>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Your bio, background, achievements..."
          style={{ minHeight: 120, fontSize: 13, lineHeight: 1.7 }}
        />
      </div>
      <div>
        <div className="label" style={{ marginBottom: 8, color: "rgba(255,255,255,0.5)" }}>PUBLIC LINKS (one per line)</div>
        <textarea
          value={links}
          onChange={e => setLinks(e.target.value)}
          placeholder={"https://github.com/username\nhttps://yoursite.com"}
          style={{ minHeight: 80, fontSize: 13, fontFamily: "var(--font-mono)" }}
        />
        <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.35)", fontSize: 11, fontStyle: "italic", marginTop: 4 }}>GitHub, Medium, personal portfolio. Not LinkedIn.</div>
      </div>
      <button
        onClick={() => onSave(bio, links)}
        disabled={saving}
        style={{ padding: "13px", background: "var(--gold)", color: "#070707", border: "none", borderRadius: 100, fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 11, letterSpacing: "0.15em", opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "SAVING..." : "SAVE & REBUILD PROFILE →"}
      </button>
    </div>
  );
}

export default function Settings() {
  const { setScreen, reset, profile, setProfile } = useMirrorStore();
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editBio, setEditBio] = useState("");
  const [editLinks, setEditLinks] = useState("");

  const handleShowEdit = () => {
    if (!showEdit) {
      setEditBio(profile?.rawBio || profile?.summary || "");
      setEditLinks((profile?.publicLinks || []).join("\n"));
    }
    setShowEdit(prev => !prev);
  };

  const saveProfile = async (bio, links) => {
    setSaving(true);
    try {
      const { getIdToken } = await import("../lib/firebase.js");
      const token = await getIdToken();
      const linkList = links.split("\n").map(l => l.trim()).filter(l => l.startsWith("http"));
      const baseUrl = process.env.NEXT_PUBLIC_PROFILE_SERVICE_URL;
      if (!baseUrl) {
        throw new Error("Profile service URL is not configured.");
      }
      const res = await fetch(`${baseUrl}/profile/onboard`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio, publicLinks: linkList, userName: profile?.userName }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh profile from server
        const { getProfile } = await import("../lib/api.js");
        const updated = await getProfile();
        setProfile(updated);
        setDone("Profile updated. Personas will use your new bio.");
        setShowEdit(false);
      } else {
        setDone(data.error || "Failed to update profile.");
      }
    } catch (err) {
      setDone("Failed to update profile.");
    }
    setSaving(false);
  };

  const clearAllData = async () => {
    if (!confirm("Clear all conversations and beliefs? Your profile stays.")) return;
    setClearing(true);
    try {
      const token = await getIdToken();
      const personaIds = ["recruiter", "date", "competitor", "journalist"];
      await Promise.all(personaIds.map(id =>
        fetch(`${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/personas/${id}/history`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      ));
      reset();
      setDone("All conversation data cleared.");
    } catch (err) {
      setDone("Failed to clear data.");
    }
    setClearing(false);
  };

  const deleteAccount = async () => {
    if (!confirm("Delete your Mirror account permanently? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure? All data will be deleted.")) return;
    setDeleting(true);
    try {
      const token = await getIdToken();
      await fetch(`${process.env.NEXT_PUBLIC_PERSONA_SERVICE_URL}/account`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await auth.currentUser?.delete();
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
      reset();
      setScreen("onboarding");
    } catch (err) {
      setDone("Failed to delete account. Please try again.");
    }
    setDeleting(false);
  };

  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 28 }}>
      <div className="label" style={{ marginBottom: 14, color: "rgba(255,255,255,0.5)" }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );

  const Item = ({ label, sublabel, onClick, danger, disabled }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "16px 18px", textAlign: "left",
        background: danger ? "rgba(232,112,112,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${danger ? "rgba(232,112,112,0.2)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14, width: "100%", opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: danger ? "#E87070" : "rgba(255,255,255,0.75)" }}>{label}</div>
      {sublabel && <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.45)", fontSize: 12, fontStyle: "italic", marginTop: 4 }}>{sublabel}</div>}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px 100px" }}>
      <button onClick={() => setScreen("home")} style={{ color: "rgba(255,255,255,0.6)", fontSize: 20, marginBottom: 28 }}>←</button>

      <div className="label" style={{ color: "var(--gold)", marginBottom: 8 }}>SETTINGS</div>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "0 0 32px" }}>
        {profile?.userName || "Your Account"}
      </h2>

      {done && (
        <div style={{ padding: "12px 16px", background: "rgba(125,201,143,0.08)", border: "1px solid rgba(125,201,143,0.2)", borderRadius: 10, marginBottom: 20, fontFamily: "var(--font-mono)", fontSize: 11, color: "#7DC98F" }}>
          ✓ {done}
        </div>
      )}

      <Section title="ACCOUNT">
        <div style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
          <div className="label" style={{ fontSize: 9, marginBottom: 4 }}>SIGNED IN AS</div>
          <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
            {auth.currentUser?.isAnonymous ? "Anonymous user" : auth.currentUser?.email || "Unknown"}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>
            UID: {auth.currentUser?.uid?.slice(0, 16)}...
          </div>
        </div>
      </Section>

      <Section title="PROFILE">
        <button
          onClick={handleShowEdit}
          style={{ padding: "16px 18px", textAlign: "left", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, width: "100%" }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", color: "rgba(255,255,255,0.75)" }}>EDIT BIO & LINKS</div>
          <div style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.45)", fontSize: 12, fontStyle: "italic", marginTop: 4 }}>Update your story or add new public links.</div>
        </button>

        {showEdit && (
          <EditProfileForm
            initialBio={editBio}
            initialLinks={editLinks}
            saving={saving}
            onSave={(bio, links) => saveProfile(bio, links)}
          />
        )}
      </Section>

      <Section title="PRIVACY">
        <Item
          label="CLEAR CONVERSATION HISTORY"
          sublabel="Removes all chat history. Beliefs reset to default."
          onClick={clearAllData}
          disabled={clearing}
        />
        <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
          <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>DATA STORED</div>
          {["Your bio and public links", "Conversation messages (encrypted at rest)", "Belief scores and Gap Score history", "Voice session summaries", "Archetype and Perception Map"].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#7DC98F", fontSize: 11 }}>·</span>
              <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
          <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>DATA NOT STORED</div>
          {["Raw audio recordings", "Camera frames or images", "Device identifiers"].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11 }}>·</span>
              <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.45)", fontSize: 12 }}>{item}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="ABOUT">
        <div style={{ padding: "16px 18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
          {[
            ["App", "Mirror — Reputation Intelligence Engine"],
            ["Version", "1.0.0"],
            ["Built with", "Gemini Live API · Google Cloud Run · Firebase"],
            ["Category", "Live Agents — Gemini Live Agent Challenge"],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span className="label" style={{ fontSize: 9 }}>{k}</span>
              <span style={{ fontFamily: "var(--font-body)", color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "right", maxWidth: "60%" }}>{v}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="DANGER ZONE">
        <Item
          label="DELETE ACCOUNT"
          sublabel="Permanently delete your Mirror account and all data."
          onClick={deleteAccount}
          danger
          disabled={deleting}
        />
      </Section>
    </div>
  );
}
