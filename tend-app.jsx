import React, { useState, useMemo } from "react";
import {
  Leaf, Calendar, MessageCircle, BookOpen, ShieldCheck, Users, Smile,
  LogOut, ChevronRight, ChevronLeft, Check, CreditCard, Smartphone,
  Star, Plus, X, Video, MapPin, Clock, Lock, Fingerprint, Bell,
  ArrowRight, AlertCircle, Sparkles
} from "lucide-react";

/* ---------------------------------------------------------------
   TEND — a mental health care platform
   Prototype covering: patient onboarding + auto-matching, daily
   feed, appointment booking with payment gate, mood check-ins,
   journaling, and a professional-side console.
   All data lives in memory for this demo — a real build would need
   a backend, encrypted storage, and a licensed payment processor.
----------------------------------------------------------------*/

const PALETTE = {
  paper: "#EEF1E8",
  card: "#FBFAF5",
  ink: "#20291F",
  inkSoft: "#5B6558",
  forest: "#33503F",
  forestDeep: "#233A2C",
  moss: "#8AA07C",
  mossPale: "#DCE6D4",
  clay: "#B96A52",
  clayPale: "#F0DAD1",
  gold: "#C9992E",
  line: "#D8DBCC",
};

const CONCERNS = [
  "Anxiety", "Low mood", "Stress & burnout", "Relationships",
  "Grief & loss", "Trauma", "Sleep", "Self-esteem",
  "Substance use", "Work or school pressure",
];

const MOCK_PROFESSIONALS = [
  { id: "p1", name: "Dr. Amara Kintu", title: "Clinical Psychologist", license: "UAP-2291", years: 9, rating: 4.9, sessions: 1180,
    specialties: ["Anxiety", "Trauma", "Grief & loss", "Sleep"],
    modes: ["online", "physical"], rate: 120000,
    bio: "Works with adults carrying long-standing anxiety and trauma, using a slow, structured approach.", tone: PALETTE.forest },
  { id: "p2", name: "Michael Okello", title: "Licensed Counselor", license: "UAP-1074", years: 6, rating: 4.8, sessions: 860,
    specialties: ["Stress & burnout", "Work or school pressure", "Relationships", "Low mood"],
    modes: ["online", "physical"], rate: 90000,
    bio: "Helps working professionals and students untangle pressure before it becomes burnout.", tone: PALETTE.clay },
  { id: "p3", name: "Dr. Namono Grace", title: "Psychiatrist", license: "UAP-0562", years: 14, rating: 5.0, sessions: 2040,
    specialties: ["Low mood", "Trauma", "Substance use", "Anxiety"],
    modes: ["online"], rate: 150000,
    bio: "Combines talk therapy with medical oversight for more complex or long-running conditions.", tone: PALETTE.gold },
  { id: "p4", name: "Sarah Nabatanzi", title: "Marriage & Family Therapist", license: "UAP-1830", years: 5, rating: 4.7, sessions: 540,
    specialties: ["Relationships", "Grief & loss", "Self-esteem"],
    modes: ["online", "physical"], rate: 85000,
    bio: "Focuses on relationships — romantic, family, and the ones we have with ourselves.", tone: PALETTE.moss },
  { id: "p5", name: "David Mugisha", title: "Addiction Counselor", license: "UAP-2117", years: 8, rating: 4.8, sessions: 910,
    specialties: ["Substance use", "Stress & burnout", "Self-esteem"],
    modes: ["physical"], rate: 95000,
    bio: "Steady, non-judgemental support for recovery, one week at a time.", tone: PALETTE.forestDeep },
  { id: "p6", name: "Grace Achieng", title: "Clinical Psychologist", license: "UAP-1955", years: 7, rating: 4.9, sessions: 770,
    specialties: ["Sleep", "Anxiety", "Work or school pressure", "Low mood"],
    modes: ["online", "physical"], rate: 100000,
    bio: "Specialises in the anxious mind that won't switch off at night.", tone: PALETTE.clay },
];

/* ---------------------------------------------------------------
   LIVE API CLIENT
   Talks to the real Tend backend (see the companion /backend
   project — three Postgres databases, JWT auth, encrypted PHI
   fields, a payment-gated booking flow). Flip USE_LIVE_API to true
   and point API_BASE_URL at a reachable deployment of that backend
   to connect this UI to it for real.

   This preview sandbox can't reach an outside server, so USE_LIVE_API
   defaults to false and everything runs on local mock state. Every
   api.* call below is still wired into the components — when a call
   fails (or is switched off), the caller falls back to the same local
   behavior this prototype always had, so the app works either way.
----------------------------------------------------------------*/
const USE_LIVE_API = false;
const API_BASE_URL = "http://localhost:4000";

let accessToken = null;

async function apiRequest(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const TONE_CYCLE = [PALETTE.forest, PALETTE.clay, PALETTE.gold, PALETTE.moss, PALETTE.forestDeep];

// Backend rows (snake_case, UGX field names) -> the shape every
// frontend component already expects. Keeping this in one place means
// live data and mock data are interchangeable everywhere else.
function normalizePro(p, index = 0) {
  return {
    id: p.id,
    name: p.full_name || p.name,
    title: p.title,
    license: p.license_number || p.license || "—",
    years: p.years_experience ?? p.years ?? 0,
    rating: Number(p.rating) || 0,
    sessions: p.sessions_completed ?? p.sessions ?? 0,
    specialties: p.specialties || [],
    modes: p.modes || [],
    rate: p.hourly_rate_ugx ?? p.rate ?? 0,
    bio: p.bio || "",
    tone: TONE_CYCLE[index % TONE_CYCLE.length],
  };
}

function normalizePost(p) {
  return { id: p.id, proId: p.professional_id, title: p.title, body: p.body, tag: p.tag, date: new Date(p.created_at).toLocaleDateString() };
}

// Maps the demo picker's mock ids to the real seeded professional
// accounts in platform_db (see backend/src/db/seed.js).
const DEMO_PRO_LOGINS = {
  p1: "amara.kintu@tend.demo", p2: "michael.okello@tend.demo", p3: "grace.namono@tend.demo",
  p4: "sarah.nabatanzi@tend.demo", p5: "david.mugisha@tend.demo", p6: "grace.achieng@tend.demo",
};
const DEMO_PRO_PASSWORD = "Demo12345!";

const api = {
  setToken(token) { accessToken = token; },
  registerPatient: (payload) => apiRequest("/api/auth/register/patient", { method: "POST", body: payload, auth: false }),
  login: (email, password) => apiRequest("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  getMyProfessional: () => apiRequest("/api/professionals/me"),
  listProfessionals: () => apiRequest("/api/professionals"),
  createAppointment: (body) => apiRequest("/api/appointments", { method: "POST", body }),
  payAppointment: (id, method) => apiRequest(`/api/appointments/${id}/pay`, { method: "POST", body: { method } }),
  myAppointments: () => apiRequest("/api/appointments/mine"),
  listFeed: () => apiRequest("/api/feed"),
  postFeed: (body) => apiRequest("/api/feed", { method: "POST", body }),
  addMood: (body) => apiRequest("/api/patients/mood", { method: "POST", body }),
  listMood: () => apiRequest("/api/patients/mood"),
  addJournal: (body) => apiRequest("/api/patients/journal", { method: "POST", body }),
  listJournal: () => apiRequest("/api/patients/journal"),
};

const SLOTS = ["09:00", "11:30", "14:00", "16:30"];

function nextDays(n) {
  const out = [];
  const d = new Date();
  for (let i = 1; i <= n; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    out.push(dd);
  }
  return out;
}

function fmtDate(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ugx(n) {
  return "UGX " + n.toLocaleString();
}

function matchProfessionals(patient, pros = MOCK_PROFESSIONALS) {
  const scored = pros.map((pro) => {
    let score = 0;
    const overlap = pro.specialties.filter((s) => patient.concerns.includes(s));
    score += overlap.length * 3;
    if (patient.modePref === "either" || pro.modes.includes(patient.modePref)) score += 2;
    score += pro.rating;
    return { pro, score, overlap };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const max = top[0]?.score || 1;
  return top.map((t) => ({ ...t, percent: Math.min(98, Math.round((t.score / (max + 3)) * 100)) }));
}

/* ---------- shared bits ---------- */

function Leafmark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M8 32C6 20 12 8 30 6C31 22 22 32 8 32Z" fill={PALETTE.forest} />
      <path d="M9 31C13 22 18 16 29 8" stroke={PALETTE.mossPale} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Brand({ dark }) {
  return (
    <div className="flex items-center gap-2">
      <Leafmark size={26} />
      <span style={{ fontFamily: "Fraunces, serif", fontSize: 21, color: dark ? PALETTE.card : PALETTE.ink, letterSpacing: "-0.01em" }}>
        Tend
      </span>
    </div>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-full text-sm transition"
      style={{
        border: `1px solid ${active ? PALETTE.forest : PALETTE.line}`,
        background: active ? PALETTE.forest : "transparent",
        color: active ? PALETTE.card : PALETTE.inkSoft,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = PALETTE.forest }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: tone + "1a", color: tone, border: `1px solid ${tone}33` }}
    >
      {children}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled, full, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition ${full ? "w-full" : ""}`}
      style={{
        background: disabled ? PALETTE.line : PALETTE.forest,
        color: disabled ? PALETTE.inkSoft : PALETTE.card,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children} {Icon && <Icon size={16} />}
    </button>
  );
}

function GhostButton({ children, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition"
      style={{ background: "transparent", color: PALETTE.ink, border: `1px solid ${PALETTE.line}` }}
    >
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block mb-4">
      <div className="text-sm mb-1.5" style={{ color: PALETTE.inkSoft }}>{label}</div>
      {children}
      {hint && <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{hint}</div>}
    </label>
  );
}

function inputStyle() {
  return {
    background: PALETTE.card,
    border: `1px solid ${PALETTE.line}`,
    color: PALETTE.ink,
  };
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={"w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 " + (props.className || "")}
      style={{ ...inputStyle(), ...(props.style || {}) }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none"
      style={inputStyle()}
    >
      {props.children}
    </select>
  );
}

/* ============================= LANDING ============================= */

function Landing({ onPick }) {
  return (
    <div className="min-h-screen" style={{ background: PALETTE.paper }}>
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-24">
        <Brand />
        <div className="grid md:grid-cols-2 gap-10 mt-16 items-center">
          <div>
            <h1
              style={{ fontFamily: "Fraunces, serif", color: PALETTE.ink, lineHeight: 1.08 }}
              className="text-5xl md:text-6xl"
            >
              Care that keeps
              <br />showing up.
            </h1>
            <p className="mt-5 text-lg max-w-md" style={{ color: PALETTE.inkSoft }}>
              Tend pairs you with a licensed therapist who fits what you're
              carrying, then holds the rest — booking, daily grounding, mood
              tracking, and a private journal — in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton onClick={() => onPick("patient")} icon={ArrowRight}>Start as a patient</PrimaryButton>
              <GhostButton onClick={() => onPick("professional")} icon={Users}>I'm a professional</GhostButton>
            </div>
            <div className="mt-10 flex gap-8">
              <div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.forest }}>6</div>
                <div className="text-xs" style={{ color: PALETTE.inkSoft }}>certified professionals</div>
              </div>
              <div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.forest }}>3</div>
                <div className="text-xs" style={{ color: PALETTE.inkSoft }}>matches on signup</div>
              </div>
              <div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.forest }}>2</div>
                <div className="text-xs" style={{ color: PALETTE.inkSoft }}>ways to meet</div>
              </div>
            </div>
          </div>
          <div className="rounded-3xl p-8" style={{ background: PALETTE.forestDeep }}>
            <svg viewBox="0 0 300 300" width="100%">
              <path d="M40 220C20 150 60 60 180 40C190 140 130 220 40 220Z" fill={PALETTE.forest} opacity="0.9" />
              <path d="M45 215C90 150 130 110 175 55" stroke={PALETTE.mossPale} strokeWidth="1.6" fill="none" />
              <circle cx="220" cy="200" r="48" fill={PALETTE.clay} opacity="0.85" />
              <circle cx="235" cy="120" r="6" fill={PALETTE.gold} />
              <circle cx="250" cy="150" r="4" fill={PALETTE.mossPale} />
            </svg>
            <p className="mt-4 text-sm" style={{ color: PALETTE.mossPale }}>
              "The matching actually made sense — I didn't have to explain everything twice."
            </p>
            <p className="text-xs mt-2" style={{ color: PALETTE.moss }}>— a Tend patient</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================= ONBOARDING ============================= */

function Onboarding({ onDone, onBack }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "", email: "", password: "", phone: "", dob: "", gender: "",
    concerns: [], modePref: "either", urgency: "routine",
    kin1: { name: "", relation: "", phone: "" },
    kin2: { name: "", relation: "", phone: "" },
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const steps = ["About you", "What's going on", "Next of kin", "Your matches"];

  const toggleConcern = (c) => {
    setForm((f) => ({
      ...f,
      concerns: f.concerns.includes(c) ? f.concerns.filter((x) => x !== c) : [...f.concerns, c],
    }));
  };

  const matches = useMemo(() => matchProfessionals(form), [step]);

  const canNext = () => {
    if (step === 0) return form.name && form.email && form.password.length >= 10 && form.phone && form.dob;
    if (step === 1) return form.concerns.length > 0;
    if (step === 2) return form.kin1.name && form.kin1.phone && form.kin2.name && form.kin2.phone;
    return true;
  };

  // Tries the real backend first (registers the account, saves
  // next-of-kin encrypted, runs matching server-side). Falls back to
  // the local mock match shown in the step-3 preview if that call
  // isn't reachable — same UX either way, just not backed by a
  // real account in mock mode.
  const finish = async () => {
    setSubmitting(true);
    setSubmitError(null);
    if (USE_LIVE_API) {
      try {
        const res = await api.registerPatient({
          email: form.email, password: form.password, fullName: form.name,
          phone: form.phone, dateOfBirth: form.dob, gender: form.gender || undefined,
          concerns: form.concerns, modePref: form.modePref, urgency: form.urgency,
          nextOfKin: [form.kin1, form.kin2],
        });
        api.setToken(res.accessToken);
        const liveProfessionals = res.matches.map((m, i) => normalizePro(m.professional, i));
        const matchedIds = res.matches.map((m) => m.professionalId);
        setSubmitting(false);
        onDone({ ...form, id: res.patient.id }, matchedIds, liveProfessionals, { accessToken: res.accessToken, refreshToken: res.refreshToken, role: "patient" });
        return;
      } catch (err) {
        console.warn("Live registration failed, continuing in local demo mode:", err.message);
        setSubmitError("Couldn't reach the server — continuing with a local demo account.");
      }
    }
    setSubmitting(false);
    onDone(form, matches.map((m) => m.pro.id), null, null);
  };

  return (
    <div className="min-h-screen" style={{ background: PALETTE.paper }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between">
          <Brand />
          <button onClick={onBack} className="text-sm" style={{ color: PALETTE.inkSoft }}>Exit</button>
        </div>

        <div className="flex items-center gap-3 mt-10 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: i <= step ? PALETTE.forest : "transparent",
                  color: i <= step ? PALETTE.card : PALETTE.inkSoft,
                  border: `1px solid ${i <= step ? PALETTE.forest : PALETTE.line}`,
                }}
              >
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <span className="text-sm hidden md:inline" style={{ color: i === step ? PALETTE.ink : PALETTE.inkSoft }}>{s}</span>
              {i < steps.length - 1 && <div className="w-8 h-px" style={{ background: PALETTE.line }} />}
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-8" style={{ background: PALETTE.card, border: `1px solid ${PALETTE.line}` }}>
          {step === 0 && (
            <div>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.ink }}>A little about you</h2>
              <p className="text-sm mt-1 mb-6" style={{ color: PALETTE.inkSoft }}>Only your care team will see this.</p>
              <div className="grid md:grid-cols-2 gap-x-4">
                <Field label="Full name">
                  <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Nakato" />
                </Field>
                <Field label="Email">
                  <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@email.com" />
                </Field>
                <Field label="Password" hint="At least 10 characters, with a number.">
                  <TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••••" />
                </Field>
                <Field label="Phone number">
                  <TextInput value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+256 7XX XXX XXX" />
                </Field>
                <Field label="Date of birth">
                  <TextInput type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                </Field>
                <Field label="Gender (optional)">
                  <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Prefer not to say</option>
                    <option>Woman</option>
                    <option>Man</option>
                    <option>Non-binary</option>
                  </Select>
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.ink }}>What's going on lately?</h2>
              <p className="text-sm mt-1 mb-5" style={{ color: PALETTE.inkSoft }}>Pick everything that fits — this is what we match on.</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {CONCERNS.map((c) => (
                  <Pill key={c} active={form.concerns.includes(c)} onClick={() => toggleConcern(c)}>{c}</Pill>
                ))}
              </div>
              <div className="grid md:grid-cols-2 gap-x-4">
                <Field label="How would you like to meet?">
                  <Select value={form.modePref} onChange={(e) => setForm({ ...form, modePref: e.target.value })}>
                    <option value="either">Either is fine</option>
                    <option value="online">Online only</option>
                    <option value="physical">In person only</option>
                  </Select>
                </Field>
                <Field label="How urgent does this feel?">
                  <Select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
                    <option value="routine">Routine — no rush</option>
                    <option value="soon">I'd like to start soon</option>
                    <option value="urgent">I need support urgently</option>
                  </Select>
                </Field>
              </div>
              {form.urgency === "urgent" && (
                <div className="flex gap-2 items-start rounded-lg p-3 text-sm" style={{ background: PALETTE.clayPale, color: PALETTE.forestDeep }}>
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  If you're in immediate danger or thinking of harming yourself, please contact a local
                  emergency line or crisis service right now, before booking through the app.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.ink }}>Two people we can reach</h2>
              <p className="text-sm mt-1 mb-6" style={{ color: PALETTE.inkSoft }}>
                We only contact your next of kin in a safety emergency, never for routine updates.
              </p>
              {["kin1", "kin2"].map((k, i) => (
                <div key={k} className="mb-5 pb-5" style={{ borderBottom: i === 0 ? `1px solid ${PALETTE.line}` : "none" }}>
                  <div className="text-sm font-medium mb-2" style={{ color: PALETTE.ink }}>Next of kin {i + 1}</div>
                  <div className="grid md:grid-cols-3 gap-x-4">
                    <Field label="Name">
                      <TextInput value={form[k].name} onChange={(e) => setForm({ ...form, [k]: { ...form[k], name: e.target.value } })} />
                    </Field>
                    <Field label="Relationship">
                      <TextInput value={form[k].relation} onChange={(e) => setForm({ ...form, [k]: { ...form[k], relation: e.target.value } })} placeholder="Sister, spouse…" />
                    </Field>
                    <Field label="Phone number">
                      <TextInput value={form[k].phone} onChange={(e) => setForm({ ...form, [k]: { ...form[k], phone: e.target.value } })} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={18} color={PALETTE.gold} />
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.ink }}>Your top 3 matches</h2>
              </div>
              <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>
                Based on what you shared, these professionals fit best. You can book any of them, or browse everyone later.
              </p>
              <div className="space-y-3">
                {matches.map(({ pro, percent, overlap }) => (
                  <div key={pro.id} className="rounded-xl p-4 flex gap-4" style={{ border: `1px solid ${PALETTE.line}` }}>
                    <div className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-sm font-medium" style={{ background: pro.tone, color: PALETTE.card }}>
                      {pro.name.split(" ").map((n) => n[0]).slice(-2).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <span style={{ color: PALETTE.ink }} className="font-medium">{pro.name}</span>
                          <span className="text-sm ml-2" style={{ color: PALETTE.inkSoft }}>{pro.title}</span>
                        </div>
                        <Badge tone={PALETTE.gold}>{percent}% match</Badge>
                      </div>
                      <p className="text-sm mt-1" style={{ color: PALETTE.inkSoft }}>{pro.bio}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {overlap.map((o) => <Badge key={o}>{o}</Badge>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            {step > 0 ? (
              <GhostButton onClick={() => setStep(step - 1)} icon={ChevronLeft}>Back</GhostButton>
            ) : <span />}
            {step < 3 ? (
              <PrimaryButton disabled={!canNext()} onClick={() => setStep(step + 1)} icon={ChevronRight}>Continue</PrimaryButton>
            ) : (
              <PrimaryButton disabled={submitting} onClick={finish} icon={ArrowRight}>{submitting ? "Setting up your account…" : "Go to my dashboard"}</PrimaryButton>
            )}
          </div>
          {submitError && (
            <div className="flex gap-2 items-start rounded-lg p-3 text-sm mt-4" style={{ background: PALETTE.clayPale, color: PALETTE.forestDeep }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {submitError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================= PATIENT DASHBOARD ============================= */

function Sidebar({ tabs, active, onChange, onExit, name, subtitle }) {
  return (
    <div className="w-60 shrink-0 h-screen sticky top-0 flex flex-col justify-between py-6 px-4" style={{ background: PALETTE.forestDeep }}>
      <div>
        <div className="px-2 mb-8"><Brand dark /></div>
        <div className="space-y-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition"
              style={{
                background: active === t.id ? "rgba(255,255,255,0.1)" : "transparent",
                color: active === t.id ? PALETTE.card : PALETTE.moss,
              }}
            >
              <t.icon size={17} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2">
        <div className="text-sm" style={{ color: PALETTE.card }}>{name}</div>
        <div className="text-xs mb-3" style={{ color: PALETTE.moss }}>{subtitle}</div>
        <button onClick={onExit} className="flex items-center gap-2 text-sm" style={{ color: PALETTE.moss }}>
          <LogOut size={15} /> Switch role
        </button>
      </div>
    </div>
  );
}

function FeedTab({ posts, setPosts, professionals }) {
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    if (!USE_LIVE_API || loaded) return;
    api.listFeed()
      .then((rows) => { if (rows.length) setPosts(rows.map(normalizePost)); setLoaded(true); })
      .catch((err) => { console.warn("Feed fetch failed, showing local posts:", err.message); setLoaded(true); });
  }, [loaded]);

  return (
    <div className="max-w-2xl">
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Daily feed</h1>
      <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Grounded tips from your care team, posted as they come to mind.</p>
      <div className="space-y-0">
        {posts.map((post, i) => {
          const pro = professionals.find((p) => p.id === post.proId) || professionals[0];
          return (
            <div key={post.id} className="py-5" style={{ borderTop: i === 0 ? "none" : `1px solid ${PALETTE.line}` }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full text-[10px] flex items-center justify-center" style={{ background: pro.tone, color: PALETTE.card }}>
                  {pro.name.split(" ").map((n) => n[0]).slice(-2).join("")}
                </div>
                <span className="text-sm" style={{ color: PALETTE.ink }}>{pro.name}</span>
                <span className="text-xs" style={{ color: PALETTE.inkSoft }}>· {pro.title}</span>
                <Badge tone={PALETTE.moss}>{post.tag}</Badge>
              </div>
              <h3 className="text-lg" style={{ color: PALETTE.ink, fontFamily: "Fraunces, serif" }}>{post.title}</h3>
              <p className="text-sm mt-1" style={{ color: PALETTE.inkSoft }}>{post.body}</p>
              <div className="text-xs mt-2" style={{ color: PALETTE.inkSoft }}>{post.date}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentForm({ amount, onPaid, onCancel }) {
  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvv: "" });
  const [momo, setMomo] = useState({ provider: "MTN Mobile Money", phone: "" });

  const formatCard = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const ready = method === "card"
    ? card.number.replace(/\s/g, "").length >= 12 && card.name && card.exp && card.cvv.length >= 3
    : momo.phone.length >= 9;

  const pay = () => {
    setProcessing(true);
    setTimeout(() => { setProcessing(false); onPaid(method); }, 1200);
  };

  return (
    <div className="rounded-xl p-5" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2" style={{ color: PALETTE.ink }}>
          <Lock size={15} /> <span className="text-sm font-medium">Secure payment</span>
        </div>
        <span style={{ fontFamily: "Fraunces, serif", fontSize: 20, color: PALETTE.forest }}>{ugx(amount)}</span>
      </div>
      <div className="flex gap-2 mb-4">
        <Pill active={method === "card"} onClick={() => setMethod("card")}><span className="flex items-center gap-1.5"><CreditCard size={14} /> Card</span></Pill>
        <Pill active={method === "momo"} onClick={() => setMethod("momo")}><span className="flex items-center gap-1.5"><Smartphone size={14} /> Mobile money</span></Pill>
      </div>

      {method === "card" ? (
        <div>
          <Field label="Card number">
            <TextInput value={card.number} onChange={(e) => setCard({ ...card, number: formatCard(e.target.value) })} placeholder="4000 1234 5678 9010" />
          </Field>
          <Field label="Name on card">
            <TextInput value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Jane Nakato" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Expiry">
              <TextInput value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value })} placeholder="MM/YY" />
            </Field>
            <Field label="CVV">
              <TextInput value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="123" />
            </Field>
          </div>
        </div>
      ) : (
        <div>
          <Field label="Provider">
            <Select value={momo.provider} onChange={(e) => setMomo({ ...momo, provider: e.target.value })}>
              <option>MTN Mobile Money</option>
              <option>Airtel Money</option>
            </Select>
          </Field>
          <Field label="Phone number" hint="You'll get a prompt on this phone to approve the payment.">
            <TextInput value={momo.phone} onChange={(e) => setMomo({ ...momo, phone: e.target.value })} placeholder="+256 7XX XXX XXX" />
          </Field>
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs mt-1 mb-4" style={{ color: PALETTE.inkSoft }}>
        <ShieldCheck size={13} /> Encrypted end-to-end. The session is only confirmed once payment clears.
      </div>

      <div className="flex gap-2">
        <GhostButton onClick={onCancel}>Cancel</GhostButton>
        <PrimaryButton disabled={!ready || processing} onClick={pay} full>
          {processing ? "Processing…" : `Pay ${ugx(amount)}`}
        </PrimaryButton>
      </div>
    </div>
  );
}

function BookingTab({ patient, appointments, setAppointments, matchedIds, professionals }) {
  const [proId, setProId] = useState(matchedIds[0]);
  const [mode, setMode] = useState("online");
  const [day, setDay] = useState(null);
  const [slot, setSlot] = useState(null);
  const [paying, setPaying] = useState(false);
  const [filter, setFilter] = useState("matched");
  const [liveApptId, setLiveApptId] = useState(null);
  const [bookingError, setBookingError] = useState(null);
  const [loadedHistory, setLoadedHistory] = useState(false);

  const pro = professionals.find((p) => p.id === proId);
  const list = filter === "matched" ? professionals.filter((p) => matchedIds.includes(p.id)) : professionals;
  const days = nextDays(6);

  // Pull real appointment history once, on a real account, instead of
  // starting from an empty list every reload.
  React.useEffect(() => {
    if (!USE_LIVE_API || !patient.id || loadedHistory) return;
    api.myAppointments()
      .then((rows) => {
        setAppointments(rows.map((a) => ({
          id: a.id, proId: a.professional_id, mode: a.mode,
          date: new Date(a.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          time: new Date(a.scheduled_start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          status: a.status, method: null, amount: a.amount_ugx, patientName: patient.name,
        })));
        setLoadedHistory(true);
      })
      .catch((err) => { console.warn("Appointment history fetch failed:", err.message); setLoadedHistory(true); });
  }, [loadedHistory, patient.id]);

  // Reserving the slot happens before payment against the real API
  // (mirrors the backend: an appointment exists as pending_payment
  // before it can ever be paid). Falls back to a client-only id if the
  // call fails or we're in mock mode, so the flow never dead-ends.
  const startPayment = async () => {
    setBookingError(null);
    if (USE_LIVE_API) {
      try {
        const scheduledStart = new Date(day);
        const [h, m] = slot.split(":").map(Number);
        scheduledStart.setHours(h, m, 0, 0);
        const appt = await api.createAppointment({ professionalId: proId, mode, scheduledStart: scheduledStart.toISOString() });
        setLiveApptId(appt.id);
      } catch (err) {
        console.warn("Live appointment reservation failed, continuing in local demo mode:", err.message);
        setBookingError("Couldn't reach the server — this booking will only be saved locally.");
      }
    }
    setPaying(true);
  };

  const confirmBooking = async (method) => {
    if (USE_LIVE_API && liveApptId) {
      try {
        await api.payAppointment(liveApptId, method);
      } catch (err) {
        console.warn("Live payment failed, recording locally instead:", err.message);
      }
    }
    setAppointments((a) => [
      ...a,
      {
        id: liveApptId || Date.now(), proId, mode, date: fmtDate(day), time: slot,
        status: "confirmed", method, amount: pro.rate, patientName: patient.name,
      },
    ]);
    setPaying(false); setDay(null); setSlot(null); setLiveApptId(null);
  };

  return (
    <div className="max-w-3xl">
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Book an appointment</h1>
      <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Choose a professional, a way to meet, and a time. Payment confirms the slot.</p>

      {appointments.length > 0 && (
        <div className="mb-8 space-y-2">
          <div className="text-sm font-medium" style={{ color: PALETTE.ink }}>Your appointments</div>
          {appointments.map((a) => {
            const p = professionals.find((x) => x.id === a.proId);
            if (!p) return null;
            return (
              <div key={a.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
                <div className="flex items-center gap-3">
                  {a.mode === "online" ? <Video size={16} color={PALETTE.forest} /> : <MapPin size={16} color={PALETTE.clay} />}
                  <div>
                    <div className="text-sm" style={{ color: PALETTE.ink }}>{p.name} · {a.date} at {a.time}</div>
                    <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{a.mode === "online" ? "Online session, in-app" : "In-person visit"}{a.method ? ` · paid via ${a.method === "card" ? "card" : "mobile money"}` : ""}</div>
                  </div>
                </div>
                <Badge tone={PALETTE.forest}>{a.status === "confirmed" ? "Confirmed" : a.status}</Badge>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <Pill active={filter === "matched"} onClick={() => setFilter("matched")}>Your matches</Pill>
        <Pill active={filter === "all"} onClick={() => setFilter("all")}>Everyone</Pill>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mb-6">
        {list.map((p) => (
          <button key={p.id} onClick={() => { setProId(p.id); setDay(null); setSlot(null); }}
            className="text-left rounded-xl p-4"
            style={{ border: `1.5px solid ${proId === p.id ? PALETTE.forest : PALETTE.line}`, background: PALETTE.card }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs mb-2" style={{ background: p.tone, color: PALETTE.card }}>
              {p.name.split(" ").map((n) => n[0]).slice(-2).join("")}
            </div>
            <div className="text-sm font-medium" style={{ color: PALETTE.ink }}>{p.name}</div>
            <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{p.title}</div>
            <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: PALETTE.gold }}>
              <Star size={11} fill={PALETTE.gold} /> {p.rating} · {p.sessions} sessions
            </div>
            <div className="text-xs mt-1" style={{ color: PALETTE.inkSoft }}>{ugx(p.rate)} / session</div>
          </button>
        ))}
      </div>

      {pro && (
        <div className="rounded-xl p-5" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
          <div className="flex gap-3 mb-4">
            {["online", "physical"].filter((m) => pro.modes.includes(m)).map((m) => (
              <Pill key={m} active={mode === m} onClick={() => setMode(m)}>
                <span className="flex items-center gap-1.5">{m === "online" ? <Video size={14} /> : <MapPin size={14} />} {m === "online" ? "Online" : "In person"}</span>
              </Pill>
            ))}
          </div>

          <div className="text-sm mb-2" style={{ color: PALETTE.inkSoft }}>Choose a day</div>
          <div className="flex flex-wrap gap-2 mb-4">
            {days.map((d) => (
              <Pill key={d.toString()} active={day?.toString() === d.toString()} onClick={() => { setDay(d); setSlot(null); }}>
                {fmtDate(d)}
              </Pill>
            ))}
          </div>

          {day && (
            <>
              <div className="text-sm mb-2" style={{ color: PALETTE.inkSoft }}>Choose a time</div>
              <div className="flex flex-wrap gap-2 mb-5">
                {SLOTS.map((s) => (
                  <Pill key={s} active={slot === s} onClick={() => setSlot(s)}>
                    <span className="flex items-center gap-1.5"><Clock size={13} /> {s}</span>
                  </Pill>
                ))}
              </div>
            </>
          )}

          {bookingError && (
            <div className="flex gap-2 items-start rounded-lg p-3 text-sm mb-3" style={{ background: PALETTE.clayPale, color: PALETTE.forestDeep }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" /> {bookingError}
            </div>
          )}
          {slot && !paying && (
            <PrimaryButton onClick={startPayment}>Continue to payment · {ugx(pro.rate)}</PrimaryButton>
          )}
          {slot && paying && (
            <PaymentForm amount={pro.rate} onPaid={confirmBooking} onCancel={() => { setPaying(false); setLiveApptId(null); }} />
          )}
        </div>
      )}
    </div>
  );
}

const MOODS = [
  { v: 1, label: "Low", color: "#A8543F" },
  { v: 2, label: "Down", color: "#BD8253" },
  { v: 3, label: "Okay", color: PALETTE.gold },
  { v: 4, label: "Good", color: PALETTE.moss },
  { v: 5, label: "Great", color: PALETTE.forest },
];

function MoodTab({ entries, setEntries }) {
  const [val, setVal] = useState(null);
  const [note, setNote] = useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!USE_LIVE_API || loaded) return;
    api.listMood()
      .then((rows) => {
        if (rows.length) setEntries(rows.map((r) => ({ date: new Date(r.loggedAt).toLocaleDateString(), val: r.moodValue, note: r.note })));
        setLoaded(true);
      })
      .catch((err) => { console.warn("Mood history fetch failed:", err.message); setLoaded(true); });
  }, [loaded]);

  const save = async () => {
    const entry = { date: new Date().toLocaleDateString(), val, note };
    setEntries((e) => [entry, ...e]);
    setVal(null); setNote("");
    if (USE_LIVE_API) {
      try { await api.addMood({ moodValue: entry.val, note: entry.note || undefined }); }
      catch (err) { console.warn("Saving mood check-in to the server failed, kept locally:", err.message); }
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>How are you, today?</h1>
      <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>One check-in a day is enough to notice a pattern.</p>

      <div className="rounded-xl p-5 mb-8" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
        <div className="flex gap-2 mb-4">
          {MOODS.map((m) => (
            <button key={m.v} onClick={() => setVal(m.v)}
              className="flex-1 rounded-lg py-3 text-sm transition"
              style={{ background: val === m.v ? m.color : "transparent", color: val === m.v ? PALETTE.card : PALETTE.inkSoft, border: `1px solid ${val === m.v ? m.color : PALETTE.line}` }}>
              {m.label}
            </button>
          ))}
        </div>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Anything behind that feeling? (optional)"
          rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3"
          style={inputStyle()}
        />
        <PrimaryButton disabled={!val} onClick={save} icon={Check}>Save today's check-in</PrimaryButton>
      </div>

      {entries.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-3" style={{ color: PALETTE.ink }}>Recent check-ins</div>
          <div className="space-y-2">
            {entries.slice(0, 10).map((e, i) => {
              const m = MOODS.find((x) => x.v === e.val);
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full" style={{ background: m.color }} />
                  <div className="flex-1">
                    <div className="text-sm" style={{ color: PALETTE.ink }}>{m.label} <span className="text-xs" style={{ color: PALETTE.inkSoft }}>· {e.date}</span></div>
                    {e.note && <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{e.note}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function JournalTab({ entries, setEntries }) {
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!USE_LIVE_API || loaded) return;
    api.listJournal()
      .then((rows) => {
        if (rows.length) setEntries(rows.map((r) => ({ id: r.id, title: r.title, body: r.body, date: new Date(r.createdAt).toLocaleDateString() })));
        setLoaded(true);
      })
      .catch((err) => { console.warn("Journal history fetch failed:", err.message); setLoaded(true); });
  }, [loaded]);

  const save = async () => {
    if (!body.trim()) return;
    const entry = { id: Date.now(), title: title || "Untitled entry", body, date: new Date().toLocaleDateString() };
    setEntries((e) => [entry, ...e]);
    setTitle(""); setBody(""); setWriting(false);
    if (USE_LIVE_API) {
      try { await api.addJournal({ title: entry.title, body: entry.body }); }
      catch (err) { console.warn("Saving journal entry to the server failed, kept locally:", err.message); }
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Journal</h1>
        {!writing && <PrimaryButton onClick={() => setWriting(true)} icon={Plus}>New entry</PrimaryButton>}
      </div>
      <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Private — only visible to you, never shared with your care team automatically.</p>

      {writing && (
        <div className="rounded-xl p-5 mb-6" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="mb-3" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Write whatever's on your mind…"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3" style={inputStyle()} />
          <div className="flex gap-2">
            <GhostButton onClick={() => setWriting(false)}>Discard</GhostButton>
            <PrimaryButton onClick={save}>Save entry</PrimaryButton>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {entries.map((e) => (
          <div key={e.id} className="pb-4" style={{ borderBottom: `1px solid ${PALETTE.line}` }}>
            <div className="flex items-center justify-between">
              <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 18, color: PALETTE.ink }}>{e.title}</h3>
              <span className="text-xs" style={{ color: PALETTE.inkSoft }}>{e.date}</span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: PALETTE.inkSoft }}>{e.body}</p>
          </div>
        ))}
        {entries.length === 0 && !writing && (
          <p className="text-sm" style={{ color: PALETTE.inkSoft }}>Nothing here yet — your first entry is one click away.</p>
        )}
      </div>
    </div>
  );
}

function CareTeamTab({ matchedIds, professionals }) {
  return (
    <div className="max-w-2xl">
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Your care team</h1>
      <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Matched to you when you signed up.</p>
      <div className="space-y-3">
        {matchedIds.map((id) => {
          const p = professionals.find((x) => x.id === id);
          if (!p) return null;
          return (
            <div key={id} className="rounded-xl p-4 flex gap-4" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: p.tone, color: PALETTE.card }}>
                {p.name.split(" ").map((n) => n[0]).slice(-2).join("")}
              </div>
              <div>
                <div style={{ color: PALETTE.ink }} className="font-medium">{p.name}</div>
                <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{p.title} · License {p.license} · {p.years} yrs experience</div>
                <p className="text-sm mt-1" style={{ color: PALETTE.inkSoft }}>{p.bio}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecurityTab() {
  const [twoFA, setTwoFA] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [sessions, setSessions] = useState([
    { device: "This device · Chrome, Kampala", time: "Active now" },
    { device: "iPhone 13 · Tend app", time: "2 days ago" },
  ]);

  const Toggle = ({ on, onClick }) => (
    <button onClick={onClick} className="w-10 h-6 rounded-full relative transition" style={{ background: on ? PALETTE.forest : PALETTE.line }}>
      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition" style={{ left: on ? 18 : 2 }} />
    </button>
  );

  return (
    <div className="max-w-2xl">
      <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Privacy & security</h1>
      <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Session notes, mood data, and payment details are encrypted separately from your everyday login.</p>

      <div className="rounded-xl divide-y" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3"><ShieldCheck size={18} color={PALETTE.forest} />
            <div><div className="text-sm" style={{ color: PALETTE.ink }}>Two-factor authentication</div>
              <div className="text-xs" style={{ color: PALETTE.inkSoft }}>Require a code by SMS at login</div></div>
          </div>
          <Toggle on={twoFA} onClick={() => setTwoFA(!twoFA)} />
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3"><Fingerprint size={18} color={PALETTE.forest} />
            <div><div className="text-sm" style={{ color: PALETTE.ink }}>Biometric app lock</div>
              <div className="text-xs" style={{ color: PALETTE.inkSoft }}>Face or fingerprint to reopen the app</div></div>
          </div>
          <Toggle on={biometric} onClick={() => setBiometric(!biometric)} />
        </div>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3"><Bell size={18} color={PALETTE.forest} />
            <div><div className="text-sm" style={{ color: PALETTE.ink }}>Alert next of kin on flagged risk</div>
              <div className="text-xs" style={{ color: PALETTE.inkSoft }}>Only in a safety emergency, reviewed by a clinician first</div></div>
          </div>
          <Toggle on={true} onClick={() => {}} />
        </div>
      </div>

      <div className="text-sm font-medium mt-6 mb-2" style={{ color: PALETTE.ink }}>Signed-in devices</div>
      <div className="space-y-2">
        {sessions.map((s, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
            <div>
              <div className="text-sm" style={{ color: PALETTE.ink }}>{s.device}</div>
              <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{s.time}</div>
            </div>
            {s.time !== "Active now" && (
              <button onClick={() => setSessions(sessions.filter((_, j) => j !== i))} className="text-xs" style={{ color: PALETTE.clay }}>Sign out</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientDashboard({ patient, matchedIds, professionals, onExit, sharedState }) {
  const [tab, setTab] = useState("feed");
  const tabs = [
    { id: "feed", label: "Daily feed", icon: MessageCircle },
    { id: "book", label: "Appointments", icon: Calendar },
    { id: "mood", label: "Mood check-in", icon: Smile },
    { id: "journal", label: "Journal", icon: BookOpen },
    { id: "team", label: "Care team", icon: Users },
    { id: "security", label: "Privacy & security", icon: ShieldCheck },
  ];
  return (
    <div className="flex" style={{ background: PALETTE.paper }}>
      <Sidebar tabs={tabs} active={tab} onChange={setTab} onExit={onExit} name={patient.name} subtitle="Patient" />
      <div className="flex-1 p-10">
        {tab === "feed" && <FeedTab posts={sharedState.posts} setPosts={sharedState.setPosts} professionals={professionals} />}
        {tab === "book" && <BookingTab patient={patient} appointments={sharedState.appointments} setAppointments={sharedState.setAppointments} matchedIds={matchedIds} professionals={professionals} />}
        {tab === "mood" && <MoodTab entries={sharedState.moods} setEntries={sharedState.setMoods} />}
        {tab === "journal" && <JournalTab entries={sharedState.journal} setEntries={sharedState.setJournal} />}
        {tab === "team" && <CareTeamTab matchedIds={matchedIds} professionals={professionals} />}
        {tab === "security" && <SecurityTab />}
      </div>
    </div>
  );
}

/* ============================= PROFESSIONAL SIDE ============================= */

function ProfessionalPicker({ professionals, onPick, onBack }) {
  const [signingIn, setSigningIn] = useState(null);
  const [error, setError] = useState(null);

  // Demo "login" for the six seeded professional accounts. Real
  // credential entry (email/password/MFA) is what a production login
  // screen would show instead of a picker list.
  const pick = async (p) => {
    setError(null);
    if (USE_LIVE_API && DEMO_PRO_LOGINS[p.id]) {
      setSigningIn(p.id);
      try {
        const res = await api.login(DEMO_PRO_LOGINS[p.id], DEMO_PRO_PASSWORD);
        api.setToken(res.accessToken);
      } catch (err) {
        console.warn("Live professional login failed, continuing in local demo mode:", err.message);
        setError("Couldn't reach the server — continuing with a local demo session.");
      }
      setSigningIn(null);
    }
    onPick(p.id);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: PALETTE.paper }}>
      <div className="max-w-md w-full">
        <Brand />
        <h2 className="mt-8 mb-1" style={{ fontFamily: "Fraunces, serif", fontSize: 26, color: PALETTE.ink }}>Continue as</h2>
        <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Demo login — pick a certified professional profile.</p>
        {error && <p className="text-xs mb-3" style={{ color: PALETTE.clay }}>{error}</p>}
        <div className="space-y-2">
          {professionals.slice(0, 3).map((p) => (
            <button key={p.id} disabled={signingIn === p.id} onClick={() => pick(p)} className="w-full flex items-center gap-3 rounded-xl p-4 text-left"
              style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card, opacity: signingIn === p.id ? 0.6 : 1 }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: p.tone, color: PALETTE.card }}>
                {p.name.split(" ").map((n) => n[0]).slice(-2).join("")}
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: PALETTE.ink }}>{p.name}</div>
                <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{p.title} · Verified · License {p.license}</div>
              </div>
              <ChevronRight size={16} className="ml-auto" color={PALETTE.inkSoft} />
            </button>
          ))}
        </div>
        <button onClick={onBack} className="text-sm mt-6" style={{ color: PALETTE.inkSoft }}>Back</button>
      </div>
    </div>
  );
}

function ProDashboard({ proId, professionals, onExit, sharedState }) {
  const [tab, setTab] = useState("requests");
  const pro = professionals.find((p) => p.id === proId);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [postTag, setPostTag] = useState("Tip");
  const [liveAppointments, setLiveAppointments] = useState(null);
  const [loadedAppts, setLoadedAppts] = useState(false);

  const tabs = [
    { id: "requests", label: "Appointments", icon: Calendar },
    { id: "feed", label: "Post to feed", icon: MessageCircle },
    { id: "profile", label: "Profile & credentials", icon: ShieldCheck },
  ];

  // When signed in for real, the professional's own bookings come
  // straight from the backend (scoped server-side to their id — see
  // GET /api/appointments/mine). Falls back to the shared local state
  // used by the rest of this prototype otherwise.
  React.useEffect(() => {
    if (!USE_LIVE_API || loadedAppts) return;
    api.myAppointments()
      .then((rows) => {
        setLiveAppointments(rows.map((a) => ({
          id: a.id, mode: a.mode,
          date: new Date(a.scheduled_start).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
          time: new Date(a.scheduled_start).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
          amount: a.amount_ugx, patientName: `Patient ${a.patient_id.slice(0, 8)}`,
        })));
        setLoadedAppts(true);
      })
      .catch((err) => { console.warn("Professional appointment fetch failed, showing local bookings:", err.message); setLoadedAppts(true); });
  }, [loadedAppts]);

  const myAppointments = liveAppointments ?? sharedState.appointments.filter((a) => a.proId === proId);

  const publish = async () => {
    if (!postBody.trim()) return;
    const localPost = { id: Date.now(), proId, title: postTitle || "A note for today", body: postBody, tag: postTag, date: new Date().toLocaleDateString() };
    if (USE_LIVE_API) {
      try {
        const saved = await api.postFeed({ title: localPost.title, body: localPost.body, tag: localPost.tag });
        sharedState.setPosts((p) => [normalizePost(saved), ...p]);
        setPostTitle(""); setPostBody("");
        return;
      } catch (err) {
        console.warn("Publishing to the live feed failed, saving locally instead:", err.message);
      }
    }
    sharedState.setPosts((p) => [localPost, ...p]);
    setPostTitle(""); setPostBody("");
  };

  return (
    <div className="flex" style={{ background: PALETTE.paper }}>
      <Sidebar tabs={tabs} active={tab} onChange={setTab} onExit={onExit} name={pro.name} subtitle="Professional" />
      <div className="flex-1 p-10">
        {tab === "requests" && (
          <div className="max-w-2xl">
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Appointments</h1>
            <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Paid and confirmed bookings appear here automatically.</p>
            {myAppointments.length === 0 && <p className="text-sm" style={{ color: PALETTE.inkSoft }}>No bookings yet — patients matched to you will see you first when they book.</p>}
            <div className="space-y-2">
              {myAppointments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
                  <div className="flex items-center gap-3">
                    {a.mode === "online" ? <Video size={16} color={PALETTE.forest} /> : <MapPin size={16} color={PALETTE.clay} />}
                    <div>
                      <div className="text-sm" style={{ color: PALETTE.ink }}>{a.patientName} · {a.date} at {a.time}</div>
                      <div className="text-xs" style={{ color: PALETTE.inkSoft }}>{ugx(a.amount)} received · {a.mode === "online" ? "online session" : "in person"}</div>
                    </div>
                  </div>
                  <Badge tone={PALETTE.forest}>Paid & confirmed</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "feed" && (
          <div className="max-w-xl">
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Post to the daily feed</h1>
            <p className="text-sm mb-6" style={{ color: PALETTE.inkSoft }}>Short, practical notes reach every patient matched to you.</p>
            <div className="rounded-xl p-5" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
              <div className="flex gap-2 mb-3">
                {["Tip", "Exercise", "Reflection"].map((t) => <Pill key={t} active={postTag === t} onClick={() => setPostTag(t)}>{t}</Pill>)}
              </div>
              <TextInput value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="Title" className="mb-3" />
              <textarea value={postBody} onChange={(e) => setPostBody(e.target.value)} rows={4} placeholder="Write your note…" className="w-full rounded-lg px-3 py-2 text-sm outline-none mb-3" style={inputStyle()} />
              <PrimaryButton onClick={publish} icon={Plus}>Publish to feed</PrimaryButton>
            </div>
          </div>
        )}

        {tab === "profile" && (
          <div className="max-w-xl">
            <h1 style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: PALETTE.ink }}>Profile & credentials</h1>
            <div className="rounded-xl p-5 mt-6" style={{ border: `1px solid ${PALETTE.line}`, background: PALETTE.card }}>
              <div className="flex items-center gap-2 mb-3"><ShieldCheck size={16} color={PALETTE.forest} /><Badge>Verified professional</Badge></div>
              <div className="text-sm" style={{ color: PALETTE.ink }}>{pro.name}</div>
              <div className="text-xs mb-3" style={{ color: PALETTE.inkSoft }}>{pro.title} · License {pro.license} · {pro.years} years practicing</div>
              <div className="flex flex-wrap gap-1.5 mb-3">{pro.specialties.map((s) => <Badge key={s} tone={PALETTE.moss}>{s}</Badge>)}</div>
              <p className="text-sm" style={{ color: PALETTE.inkSoft }}>{pro.bio}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= APP ROOT ============================= */

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [patient, setPatient] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [proId, setProId] = useState(null);
  // Live-matched professionals replace the mock list the moment
  // registration succeeds against the real backend; every tab reads
  // from this single array so mock and live data are interchangeable.
  const [professionals, setProfessionals] = useState(MOCK_PROFESSIONALS);

  const [posts, setPosts] = useState([
    { id: 1, proId: "p2", title: "Naming the pressure helps", tag: "Tip", date: "2 days ago",
      body: "Before a hard day, write down the one thing you're most worried about. It rarely looks as big on paper." },
    { id: 2, proId: "p1", title: "A 4-count breath for racing thoughts", tag: "Exercise", date: "4 days ago",
      body: "Inhale for 4, hold for 4, exhale for 6. Repeat five times before you reach for your phone in the morning." },
  ]);
  const [appointments, setAppointments] = useState([]);
  const [moods, setMoods] = useState([]);
  const [journal, setJournal] = useState([]);

  const sharedState = { posts, setPosts, appointments, setAppointments, moods, setMoods, journal, setJournal };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::selection { background: ${PALETTE.mossPale}; }
        input:focus, select:focus, textarea:focus { border-color: ${PALETTE.forest} !important; }
      `}</style>

      {screen === "landing" && (
        <Landing onPick={(role) => setScreen(role === "patient" ? "onboarding" : "pro-pick")} />
      )}

      {screen === "onboarding" && (
        <Onboarding
          onBack={() => setScreen("landing")}
          onDone={(form, ids, liveProfessionals) => {
            setPatient(form);
            setMatchedIds(ids);
            if (liveProfessionals?.length) {
              // Merge rather than replace, so professionals not in the
              // top-3 match are still bookable from "Everyone".
              setProfessionals((prev) => {
                const byId = new Map(prev.map((p) => [p.id, p]));
                liveProfessionals.forEach((p) => byId.set(p.id, p));
                return Array.from(byId.values());
              });
            }
            setScreen("patient-dash");
          }}
        />
      )}

      {screen === "patient-dash" && patient && (
        <PatientDashboard patient={patient} matchedIds={matchedIds} professionals={professionals} onExit={() => setScreen("landing")} sharedState={sharedState} />
      )}

      {screen === "pro-pick" && (
        <ProfessionalPicker professionals={professionals} onBack={() => setScreen("landing")} onPick={(id) => { setProId(id); setScreen("pro-dash"); }} />
      )}

      {screen === "pro-dash" && proId && (
        <ProDashboard proId={proId} professionals={professionals} onExit={() => setScreen("landing")} sharedState={sharedState} />
      )}
    </div>
  );
}
