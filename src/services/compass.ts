import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { PAID_COMPASS_MONTHLY_LIMIT, STRIPE_PRICE_IDS, getGraceStateForUser } from "~/services/plans";

export interface CompassReport {
  matchScore: number; candidateFit: number; resumeEffectiveness: number;
  categoryScores: { qualifications: number; experience: number; skills: number; resumeEvidence: number; atsReadiness: number };
  summary: string; recruiterPerspective: string; hiringManagerPerspective: string;
  atsAnalysis: { presentTerms: string[]; missingTerms: string[]; formattingRisks: string[] };
  recommendations: { alreadyHaveButBuried: string[]; likelyHaveShouldAdd: string[]; genuinelyMissing: string[] };
  jobPostInterpretation: { trueRequirements: string[]; wishListItems: string[] };
  actionPlan: string[]; overallRating: string; shouldApply: boolean; applyRationale: string;
}

const SYSTEM_PROMPT = `You are JobVaro Compass, an expert recruiter and resume strategist. Assess the candidate against the job using this exact 100-point framework: Qualifications Alignment (25): education, licenses, certifications, required credentials, required years of experience; Relevant Experience (30): similar work, industry, scope, responsibility, recency; Skills & Capability Match (20): technical/software/functional/transferable skills; Resume Evidence & Positioning (15): how well the resume demonstrates qualifications, accomplishments and relevance; Recruiter & ATS Readiness (10): ATS compatibility, keyword alignment, formatting and recruiter-friendly presentation.

Return ONLY valid JSON (no markdown) with exactly these sections: matchScore (0-100), candidateFit (0-75), resumeEffectiveness (0-25), categoryScores ({ qualifications: 0-25, experience: 0-30, skills: 0-20, resumeEvidence: 0-15, atsReadiness: 0-10 }), summary (2-3 sentences), recruiterPerspective (direct recruiter's voice: what stands out, worries them, and whether they would pass it to the hiring manager), hiringManagerPerspective (what a manager would probe and where evidence is thin), atsAnalysis ({ presentTerms: string[], missingTerms: string[], formattingRisks: string[] }), recommendations ({ alreadyHaveButBuried: string[], likelyHaveShouldAdd: string[], genuinelyMissing: string[] }), jobPostInterpretation ({ trueRequirements: string[], wishListItems: string[] }), actionPlan (prioritized string[]), overallRating (one of Excellent Match, Strong Match, Competitive Match, Possible Match, Significant Gaps), shouldApply (boolean), applyRationale (1-2 sentences).

Rules: truly required missing qualifications (especially legally required licenses/certifications) must heavily reduce Qualifications Alignment. Distinguish Required from Preferred; missing preferred items should not heavily penalize. Transferable skills earn partial credit (for example Tableau + Python for a Power BI request). Do not merely keyword match; evaluate actual capability. Scores must add up: matchScore = category total, candidateFit = qualifications + experience + skills, resumeEffectiveness = resumeEvidence + atsReadiness.`;

export const analyzeCompass = createServerFn({ method: "POST" }).handler(async ({ data }): Promise<{ success: true; report: CompassReport; truncated: boolean } | { success: false; error: string; upgradeRequired?: boolean }> => {
  const input = data as { resumeText?: string; jobDescription?: string; jobTitle?: string; company?: string };
  const resumeText = (input.resumeText ?? "").trim();
  const jobDescription = (input.jobDescription ?? "").trim();
  if (!resumeText || !jobDescription) return { success: false, error: "Please provide both a resume and job description." };
  const truncated = resumeText.length > 8000 || jobDescription.length > 8000;
  const resume = resumeText.slice(0, 8000);
  const job = jobDescription.slice(0, 8000);
  if (!process.env.OPENAI_API_KEY) return { success: false, error: "Compass is not configured yet. Please try again later." };
  try {
    // Resolve the session up front so we can enforce the free-plan usage cap.
    const { getSession } = await import("~/auth/session");
    const session = await getSession();
    if (!session) return { success: false, error: "Please sign in to use Compass." };

    // Free users receive one lifetime analysis; paid plans receive 25 each calendar month.
    const userRows = await sql`SELECT plan FROM users WHERE id = ${session.userId} LIMIT 1`;
    const plan = String((userRows[0] as { plan?: string } | undefined)?.plan ?? "free");
    const isPaid = ["pro", "sprint", "momentum"].includes(plan);
    const countRows = isPaid
      ? await sql`SELECT COUNT(*)::int AS count FROM compass_analyses WHERE user_id = ${session.userId} AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`
      : await sql`SELECT COUNT(*)::int AS count FROM compass_analyses WHERE user_id = ${session.userId}`;
    const count = (countRows[0] as { count: number }).count ?? 0;
    const limit = isPaid ? PAID_COMPASS_MONTHLY_LIMIT : 1;
    if (count >= limit) {
      return { success: false, error: isPaid ? "You've used all 25 Compass analyses this month. Purchase an additional analysis for $0.99 to continue." : "Free plan includes 1 Compass analysis. Upgrade to Pro or purchase an additional analysis for $0.99 to continue.", upgradeRequired: true, addOnPriceId: STRIPE_PRICE_IDS.compassAddOn } as never;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `JOB TITLE: ${input.jobTitle || "(infer from posting)"}\nCOMPANY: ${input.company || "(not provided)"}\n\nJOB DESCRIPTION:\n${job}\n\nRESUME:\n${resume}` }] }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const report = JSON.parse(payload.choices?.[0]?.message?.content ?? "") as CompassReport;
    if (typeof report.matchScore !== "number" || !report.categoryScores) throw new Error("Invalid analysis returned");
    await sql`INSERT INTO compass_analyses (user_id, job_title, company, job_description, resume_text, match_score, report_json) VALUES (${session.userId}, ${input.jobTitle?.trim() || "Untitled role"}, ${input.company?.trim() || null}, ${jobDescription}, ${resumeText}, ${report.matchScore}, ${JSON.stringify(report)})`;
    return { success: true, report, truncated };
  } catch (error) {
    console.error("Compass analysis error:", error);
    return { success: false, error: "We couldn't complete the analysis. Please check your inputs and try again." };
  }
});

export interface CompassAnalysisSummary {
  id: string;
  job_title: string;
  company: string | null;
  match_score: number | null;
  created_at: string;
}

/**
 * List the logged-in user's Compass analyses, newest first. Locking
 * (data-lapse policy): while the user is free AND in grace, only the newest
 * analysis is visible — rows stay in the DB (query-level lock).
 */
export const getCompassAnalyses = createServerFn({ method: "GET" }).handler(
  async (): Promise<CompassAnalysisSummary[]> => {
    const { getSession } = await import("~/auth/session");
    const session = await getSession();
    if (!session) return [];

    try {
      const grace = await getGraceStateForUser(session.userId);
      const locked = grace.inGrace;

      const rows = locked
        ? await sql`
          SELECT id, job_title, company, match_score, created_at
          FROM compass_analyses
          WHERE user_id = ${session.userId}
          ORDER BY created_at DESC
          LIMIT 1
        `
        : await sql`
          SELECT id, job_title, company, match_score, created_at
          FROM compass_analyses
          WHERE user_id = ${session.userId}
          ORDER BY created_at DESC
        `;

      return (rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        job_title: String(r.job_title),
        company: r.company ? String(r.company) : null,
        match_score: r.match_score === null || r.match_score === undefined ? null : Number(r.match_score),
        created_at: r.created_at ? String(r.created_at) : "",
      }));
    } catch (error) {
      console.error("getCompassAnalyses error:", error);
      return [];
    }
  },
);
