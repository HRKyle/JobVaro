import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

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

export const analyzeCompass = createServerFn({ method: "POST" }).handler(async ({ data }): Promise<{ success: true; report: CompassReport; truncated: boolean } | { success: false; error: string }> => {
  const input = data as { resumeText?: string; jobDescription?: string; jobTitle?: string; company?: string };
  const resumeText = (input.resumeText ?? "").trim();
  const jobDescription = (input.jobDescription ?? "").trim();
  if (!resumeText || !jobDescription) return { success: false, error: "Please provide both a resume and job description." };
  const truncated = resumeText.length > 8000 || jobDescription.length > 8000;
  const resume = resumeText.slice(0, 8000);
  const job = jobDescription.slice(0, 8000);
  if (!process.env.OPENAI_API_KEY) return { success: false, error: "Compass is not configured yet. Please try again later." };
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `JOB TITLE: ${input.jobTitle || "(infer from posting)"}\nCOMPANY: ${input.company || "(not provided)"}\n\nJOB DESCRIPTION:\n${job}\n\nRESUME:\n${resume}` }] }),
    });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status})`);
    const payload = await response.json() as { choices?: { message?: { content?: string } }[] };
    const report = JSON.parse(payload.choices?.[0]?.message?.content ?? "") as CompassReport;
    if (typeof report.matchScore !== "number" || !report.categoryScores) throw new Error("Invalid analysis returned");
    const { getSession } = await import("~/auth/session");
    const session = await getSession();
    if (session) {
      await sql`INSERT INTO compass_analyses (user_id, job_title, company, job_description, resume_text, match_score, report_json) VALUES (${session.userId}, ${input.jobTitle?.trim() || "Untitled role"}, ${input.company?.trim() || null}, ${jobDescription}, ${resumeText}, ${report.matchScore}, ${JSON.stringify(report)})`;
    }
    return { success: true, report, truncated };
  } catch (error) {
    console.error("Compass analysis error:", error);
    return { success: false, error: "We couldn't complete the analysis. Please check your inputs and try again." };
  }
});
