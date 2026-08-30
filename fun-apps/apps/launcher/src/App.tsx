import type { CSSProperties } from "react";

const getAppUrl = (envUrl: string | undefined, productionPath: string, devPort: number) => {
  if (envUrl && envUrl.trim().length > 0) return envUrl;
  return import.meta.env.DEV ? `http://localhost:${devPort}/` : productionPath;
};

const getBibleUrl = () => {
  const envUrl = import.meta.env.VITE_BIBLE_APP_URL as string | undefined;
  return getAppUrl(envUrl, "./bible-tracker/", 5174);
};

const getGradeEstimatorUrl = () => {
  const envUrl = import.meta.env.VITE_GRADE_ESTIMATOR_URL as string | undefined;
  return getAppUrl(envUrl, "./grade-estimator/", 5175);
};

const getCoinAtlasUrl = () => {
  const envUrl = import.meta.env.VITE_COIN_ATLAS_URL as string | undefined;
  return getAppUrl(envUrl, "./coin-atlas/", 5176);
};

const getBobsBooksUrl = () => {
  const envUrl = import.meta.env.VITE_BOBS_BOOKS_URL as string | undefined;
  return getAppUrl(envUrl, "./bobs-books/", 5177);
};

const getEmojiBattleUrl = () => {
  const envUrl = import.meta.env.VITE_EMOJI_BATTLE_URL as string | undefined;
  return getAppUrl(envUrl, "./emoji-battle/", 5178);
};

const getTimeLoopCyoaUrl = () => {
  const envUrl = import.meta.env.VITE_TIME_LOOP_CYOA_URL as string | undefined;
  return getAppUrl(envUrl, "./time-loop-cyoa/", 5179);
};

const getMuseumMasterpiecesUrl = () => {
  const envUrl = import.meta.env.VITE_MUSEUM_MASTERPIECES_URL as string | undefined;
  return getAppUrl(envUrl, "./museum-masterpieces/", 5180);
};

const getWorldOfFacesUrl = () => {
  const envUrl = import.meta.env.VITE_WORLD_OF_FACES_URL as string | undefined;
  return getAppUrl(envUrl, "./world-of-faces/", 5181);
};

const getMeetingRecorderUrl = () => {
  const envUrl = import.meta.env.VITE_MEETING_RECORDER_URL as string | undefined;
  return getAppUrl(envUrl, "./meeting-recorder/", 5182);
};

type AppTile = {
  title: string;
  subtitle: string;
  signal: string;
  meta: string;
  href: string;
  accent: string;
};

export default function App() {
  const apps: AppTile[] = [
    {
      title: "Bible Tracker",
      subtitle: "Reading plans, progress, cadence, and chapter-level momentum.",
      signal: "BT",
      meta: "Devotional focus",
      href: getBibleUrl(),
      accent: "#b46b48",
    },
    {
      title: "Grade Estimator",
      subtitle: "Scenario analysis for category weights, thresholds, and final outcomes.",
      signal: "GE",
      meta: "Academic cockpit",
      href: getGradeEstimatorUrl(),
      accent: "#47a3ff",
    },
    {
      title: "Coin Atlas",
      subtitle: "A cartographic collection map for world coins, bills, and history.",
      signal: "CA",
      meta: "Collector map",
      href: getCoinAtlasUrl(),
      accent: "#d1ad55",
    },
    {
      title: "Bob's Books",
      subtitle: "A quiet personal archive for books, sessions, and reading goals.",
      signal: "BB",
      meta: "Literary archive",
      href: getBobsBooksUrl(),
      accent: "#b98566",
    },
    {
      title: "Emoji Battle",
      subtitle: "Fast strategy battles with decks, lobbies, and sharp turn feedback.",
      signal: "EB",
      meta: "Arcade tactics",
      href: getEmojiBattleUrl(),
      accent: "#ffd23f",
    },
    {
      title: "Time Loop CYOA",
      subtitle: "A cinematic branching-story editor for timelines, nodes, and memory.",
      signal: "TL",
      meta: "Narrative engine",
      href: getTimeLoopCyoaUrl(),
      accent: "#a98cff",
    },
    {
      title: "Museum Masterpieces",
      subtitle: "Gallery-grade tracking for paintings, journeys, ratings, and notes.",
      signal: "MM",
      meta: "Art field guide",
      href: getMuseumMasterpiecesUrl(),
      accent: "#c9a84c",
    },
    {
      title: "World of Faces",
      subtitle: "A humane field recorder for interviews, consent, and saved voices.",
      signal: "WF",
      meta: "Documentary tool",
      href: getWorldOfFacesUrl(),
      accent: "#db4a3f",
    },
    {
      title: "Meeting Notes AI",
      subtitle: "Records and transcribes meetings, then formats them into your own templates.",
      signal: "MN",
      meta: "Meeting recorder",
      href: getMeetingRecorderUrl(),
      accent: "#5eead4",
    },
  ];

  return (
    <div className="page">
      <div className="grain" aria-hidden="true" />
      <header className="hero">
        <div className="hero__copy">
          <div className="hero__kicker">Fun Apps Studio</div>
          <h1>Small tools, treated like serious software.</h1>
          <p>
            A polished suite of focused utilities with expressive motion, tactile controls,
            and distinct product personalities.
          </p>
        </div>
        <div className="hero__panel" aria-hidden="true">
          <div className="orb orb--one" />
          <div className="orb orb--two" />
          <div className="hero__metric">
            <span>{apps.length}</span>
            <small>apps in the suite</small>
          </div>
          <div className="hero__rail">
            {apps.slice(0, 5).map((app) => (
              <span key={app.title} style={{ "--accent": app.accent } as CSSProperties}>
                {app.signal}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="library" aria-labelledby="library-title">
        <div className="library__header">
          <h2 id="library-title">App library</h2>
          <p>Each tile opens a dedicated app, keeping existing GitHub Pages routes intact.</p>
        </div>
        <div className="grid">
          {apps.map((app, index) => (
            <button
              key={app.title}
              className="tile"
              style={{ "--accent": app.accent, "--i": index } as CSSProperties}
              onClick={() => {
                window.location.href = app.href;
              }}
            >
              <span className="tile__shine" aria-hidden="true" />
              <span className="tile__top">
                <span className="tile__signal">{app.signal}</span>
                <span className="tile__meta">{app.meta}</span>
              </span>
              <span className="tile__title">{app.title}</span>
              <span className="tile__subtitle">{app.subtitle}</span>
              <span className="tile__action">Open app</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
