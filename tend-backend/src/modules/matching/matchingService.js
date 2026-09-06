const { listActiveProfessionals } = require("../professionals/professionalsService");
const { getConcerns, saveMatchResults } = require("../patients/patientsService");

/**
 * Matching intentionally lives in its own module rather than inside
 * either the patients or professionals service: it is the one place in
 * the system that legitimately needs to read both databases at once.
 * It never writes to professionals_db, and the only patients_db write
 * is the match_results snapshot for that one patient.
 */
async function runMatching(patient, concerns, modePref) {
  const professionals = await listActiveProfessionals();

  const scored = professionals.map((pro) => {
    const overlap = pro.specialties.filter((s) => concerns.includes(s));
    let score = overlap.length * 3;
    if (modePref === "either" || pro.modes.includes(modePref)) score += 2;
    score += Number(pro.rating);
    return { pro, score, overlap };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const maxScore = top[0]?.score || 1;

  const results = top.map((t, i) => ({
    professionalId: t.pro.id,
    rank: i + 1,
    score: Math.min(98, Math.round((t.score / (maxScore + 3)) * 100)),
    reasons: t.overlap.length ? t.overlap : ["Highly rated on the platform"],
  }));

  await saveMatchResults(patient.id, results);
  return results.map((r) => ({
    ...r,
    professional: professionals.find((p) => p.id === r.professionalId),
  }));
}

module.exports = { runMatching };
