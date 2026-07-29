/**
 * Database seed script.
 *
 * Inserts sample job listings into saved_jobs for testing and development.
 * Uses a hardcoded test user_id — make sure that user exists or create one first.
 *
 * Usage:
 *   bun run src/db/seed.ts
 *
 * Requires DATABASE_URL to be set in the environment.
 */

import { neon } from "@neondatabase/serverless";

// Hardcoded test user — create this user in the database before seeding,
// or run this after creating a test account.
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

const SAMPLE_JOBS = [
  // --- Tech ---
  {
    title: "Senior Frontend Engineer",
    company: "Vercel",
    location: "Remote (US)",
    description:
      "Build the future of web development tooling. Work on the Next.js framework and the Vercel platform to create delightful developer experiences.",
    url: "https://vercel.com/careers",
    source: "vercel",
    salary: "$160,000 – $220,000",
  },
  {
    title: "Full-Stack TypeScript Developer",
    company: "Linear",
    location: "San Francisco, CA",
    description:
      "Join a small, high-performance team building the next generation of project management tools. Deep TypeScript, React, and GraphQL experience required.",
    url: "https://linear.app/careers",
    source: "linear",
    salary: "$150,000 – $200,000",
  },
  {
    title: "Backend Engineer (Go)",
    company: "Stripe",
    location: "Remote (Global)",
    description:
      "Design and build the core payment infrastructure that powers millions of businesses. Strong systems thinking and Go experience preferred.",
    url: "https://stripe.com/jobs",
    source: "stripe",
    salary: "$170,000 – $240,000",
  },
  {
    title: "DevOps / Platform Engineer",
    company: "Fly.io",
    location: "Remote",
    description:
      "Help us build the global application delivery platform. Work on orchestration, networking, and edge compute at scale.",
    url: "https://fly.io/jobs",
    source: "fly.io",
    salary: "$140,000 – $190,000",
  },
  {
    title: "Machine Learning Engineer",
    company: "Anthropic",
    location: "San Francisco, CA",
    description:
      "Work on frontier AI safety research and model training infrastructure. Experience with large-scale ML systems and Python required.",
    url: "https://anthropic.com/careers",
    source: "anthropic",
    salary: "$200,000 – $350,000",
  },

  // --- Business ---
  {
    title: "Product Manager, Growth",
    company: "Notion",
    location: "New York, NY",
    description:
      "Drive growth initiatives for a product used by millions. Combine data analysis, user research, and experimentation to unlock new user segments.",
    url: "https://notion.so/careers",
    source: "notion",
    salary: "$140,000 – $195,000",
  },
  {
    title: "Business Operations Associate",
    company: "Ramp",
    location: "New York, NY",
    description:
      "Work cross-functionally to scale operations at one of the fastest-growing fintech companies. SQL, analytics, and strategic thinking required.",
    url: "https://ramp.com/careers",
    source: "ramp",
    salary: "$100,000 – $140,000",
  },
  {
    title: "Sales Development Representative",
    company: "HubSpot",
    location: "Cambridge, MA",
    description:
      "Be the first point of contact for prospective customers. Drive pipeline growth through outbound prospecting and inbound qualification.",
    url: "https://hubspot.com/careers",
    source: "hubspot",
    salary: "$65,000 – $85,000 OTE",
  },
  {
    title: "Marketing Lead",
    company: "Raycast",
    location: "Remote (Europe)",
    description:
      "Own all marketing channels for a beloved developer productivity tool. Content strategy, community, growth, and brand.",
    url: "https://raycast.com/jobs",
    source: "raycast",
    salary: "€90,000 – €130,000",
  },
  {
    title: "Data Analyst",
    company: "Airbnb",
    location: "Remote (US)",
    description:
      "Transform complex data into actionable insights. Work with product and eng teams to drive decisions through experimentation and analytics.",
    url: "https://airbnb.com/careers",
    source: "airbnb",
    salary: "$120,000 – $170,000",
  },

  // --- Creative ---
  {
    title: "Senior Product Designer",
    company: "Figma",
    location: "San Francisco, CA",
    description:
      "Shape the future of collaborative design tools. Own end-to-end design for core product features used by millions of designers.",
    url: "https://figma.com/careers",
    source: "figma",
    salary: "$160,000 – $230,000",
  },
  {
    title: "UX Writer / Content Designer",
    company: "Spotify",
    location: "New York, NY",
    description:
      "Craft clear, human-centered copy for the Spotify platform. Partner with design and product to shape the voice of the experience.",
    url: "https://spotify.com/jobs",
    source: "spotify",
    salary: "$110,000 – $155,000",
  },
  {
    title: "Creative Director",
    company: "Patagonia",
    location: "Ventura, CA",
    description:
      "Lead creative vision across brand campaigns, retail, and digital. Deep commitment to environmental activism and storytelling required.",
    url: "https://patagonia.com/careers",
    source: "patagonia",
    salary: "$140,000 – $190,000",
  },
  {
    title: "Illustrator & Visual Designer",
    company: "Duolingo",
    location: "Pittsburgh, PA",
    description:
      "Create delightful illustrations and animations that make language learning fun for hundreds of millions of users worldwide.",
    url: "https://duolingo.com/careers",
    source: "duolingo",
    salary: "$90,000 – $130,000",
  },
  {
    title: "Video Content Producer",
    company: "Squarespace",
    location: "New York, NY",
    description:
      "Produce high-quality video content for product launches, brand campaigns, and social. Full production lifecycle from concept to delivery.",
    url: "https://squarespace.com/careers",
    source: "squarespace",
    salary: "$85,000 – $120,000",
  },
];

async function seed() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL is not set. Connect a database before seeding.");
    process.exit(1);
  }

  const db = neon(url);

  // Ensure the test user exists before inserting jobs
  console.log(`👤 Ensuring test user ${TEST_USER_ID} exists...`);
  await db`
    INSERT INTO users (id, email, password_hash, name, plan)
    VALUES (
      ${TEST_USER_ID},
      'demo@jobhub.dev',
      '$2b$10$placeholder_hash_for_demo_user',
      'Demo User',
      'free'
    )
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("  ✅ Test user ready.");

  console.log(`🌱 Seeding ${SAMPLE_JOBS.length} sample jobs for test user ${TEST_USER_ID}...`);

  for (const job of SAMPLE_JOBS) {
    await db`
      INSERT INTO saved_jobs (user_id, title, company, location, description, url, source, salary, posted_at)
      VALUES (
        ${TEST_USER_ID},
        ${job.title},
        ${job.company},
        ${job.location},
        ${job.description},
        ${job.url},
        ${job.source},
        ${job.salary},
        now() - (random() * interval '30 days')
      )
    `;
    console.log(`  ✅ ${job.title} @ ${job.company}`);
  }

  console.log("✅ Seed complete.");
}

seed();
