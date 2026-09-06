// Seeds platform_db (a user + login) and professionals_db (their
// professional record, pre-verified) for six demo professionals so the
// matching and booking flows have real data to work against.
require("dotenv").config();
const bcrypt = require("bcrypt");
const { patientsPool, professionalsPool, platformPool } = require("../config/db");

const DEMO_PROFESSIONALS = [
  { email: "amara.kintu@tend.demo", fullName: "Dr. Amara Kintu", title: "Clinical Psychologist", license: "UAP-2291", years: 9, rating: 4.9, sessions: 1180, specialties: ["Anxiety", "Trauma", "Grief & loss", "Sleep"], modes: ["online", "physical"], rate: 120000, bio: "Works with adults carrying long-standing anxiety and trauma, using a slow, structured approach." },
  { email: "michael.okello@tend.demo", fullName: "Michael Okello", title: "Licensed Counselor", license: "UAP-1074", years: 6, rating: 4.8, sessions: 860, specialties: ["Stress & burnout", "Work or school pressure", "Relationships", "Low mood"], modes: ["online", "physical"], rate: 90000, bio: "Helps working professionals and students untangle pressure before it becomes burnout." },
  { email: "grace.namono@tend.demo", fullName: "Dr. Namono Grace", title: "Psychiatrist", license: "UAP-0562", years: 14, rating: 5.0, sessions: 2040, specialties: ["Low mood", "Trauma", "Substance use", "Anxiety"], modes: ["online"], rate: 150000, bio: "Combines talk therapy with medical oversight for more complex or long-running conditions." },
  { email: "sarah.nabatanzi@tend.demo", fullName: "Sarah Nabatanzi", title: "Marriage & Family Therapist", license: "UAP-1830", years: 5, rating: 4.7, sessions: 540, specialties: ["Relationships", "Grief & loss", "Self-esteem"], modes: ["online", "physical"], rate: 85000, bio: "Focuses on relationships — romantic, family, and the ones we have with ourselves." },
  { email: "david.mugisha@tend.demo", fullName: "David Mugisha", title: "Addiction Counselor", license: "UAP-2117", years: 8, rating: 4.8, sessions: 910, specialties: ["Substance use", "Stress & burnout", "Self-esteem"], modes: ["physical"], rate: 95000, bio: "Steady, non-judgemental support for recovery, one week at a time." },
  { email: "grace.achieng@tend.demo", fullName: "Grace Achieng", title: "Clinical Psychologist", license: "UAP-1955", years: 7, rating: 4.9, sessions: 770, specialties: ["Sleep", "Anxiety", "Work or school pressure", "Low mood"], modes: ["online", "physical"], rate: 100000, bio: "Specialises in the anxious mind that won't switch off at night." },
];

async function seed() {
  for (const p of DEMO_PROFESSIONALS) {
    const passwordHash = await bcrypt.hash("Demo12345!", 12);
    const userRes = await platformPool.query(
      `INSERT INTO users (email, password_hash, role) VALUES ($1,$2,'professional')
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      [p.email, passwordHash]
    );
    let userId = userRes.rows[0]?.id;
    if (!userId) {
      const existing = await platformPool.query("SELECT id FROM users WHERE email = $1", [p.email]);
      userId = existing.rows[0].id;
    }

    const existingPro = await professionalsPool.query("SELECT id FROM professionals WHERE license_number = $1", [p.license]);
    if (existingPro.rowCount > 0) {
      console.log(`Skipping ${p.fullName}, already seeded.`);
      continue;
    }

    const proRes = await professionalsPool.query(
      `INSERT INTO professionals (user_id, full_name, title, license_number, license_verified, license_verified_at, years_experience, bio, hourly_rate_ugx, modes, rating, sessions_completed)
       VALUES ($1,$2,$3,$4,TRUE,now(),$5,$6,$7,$8,$9,$10) RETURNING id`,
      [userId, p.fullName, p.title, p.license, p.years, p.bio, p.rate, p.modes, p.rating, p.sessions]
    );
    const proId = proRes.rows[0].id;
    for (const s of p.specialties) {
      await professionalsPool.query("INSERT INTO professional_specialties (professional_id, specialty) VALUES ($1,$2)", [proId, s]);
    }
    console.log(`Seeded ${p.fullName}`);
  }
  console.log("Done.");
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
