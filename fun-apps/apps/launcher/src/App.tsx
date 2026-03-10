const getBibleUrl = () => {
  const envUrl = import.meta.env.VITE_BIBLE_APP_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./bible-tracker/";
};

const getGradeEstimatorUrl = () => {
  const envUrl = import.meta.env.VITE_GRADE_ESTIMATOR_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./grade-estimator/";
};

const getCoinAtlasUrl = () => {
  const envUrl = import.meta.env.VITE_COIN_ATLAS_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./coin-atlas/";
};

const getBobsBooksUrl = () => {
  const envUrl = import.meta.env.VITE_BOBS_BOOKS_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./bobs-books/";
};

const getEmojiBattleUrl = () => {
  const envUrl = import.meta.env.VITE_EMOJI_BATTLE_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./emoji-battle/";
};

const getTimeLoopCyoaUrl = () => {
  const envUrl = import.meta.env.VITE_TIME_LOOP_CYOA_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./time-loop-cyoa/";
};

const getMuseumMasterpiecesUrl = () => {
  const envUrl = import.meta.env.VITE_MUSEUM_MASTERPIECES_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./museum-masterpieces/";
};

export default function App() {
  const bibleUrl = getBibleUrl();
  const gradeEstimatorUrl = getGradeEstimatorUrl();
  const coinAtlasUrl = getCoinAtlasUrl();
  const bobsBooksUrl = getBobsBooksUrl();
  const emojiBattleUrl = getEmojiBattleUrl();
  const timeLoopCyoaUrl = getTimeLoopCyoaUrl();
  const museumMasterpiecesUrl = getMuseumMasterpiecesUrl();

  return (
    <div className="page">
      <header className="hero">
        <div className="hero__accent" />
        <div>
          <h1>Fun Apps</h1>
          <p>Thoughtfully built, small tools for everyday focus.</p>
        </div>
      </header>

      <section className="library">
        <h2>App Library</h2>
        <div className="grid">
          <button
            className="tile"
            onClick={() => {
              window.location.href = bibleUrl;
            }}
          >
            <div className="tile__title">Bible Tracker</div>
            <div className="tile__subtitle">Reading plan, progress, and analytics</div>
          </button>
          <button
            className="tile"
            onClick={() => {
              window.location.href = gradeEstimatorUrl;
            }}
          >
            <div className="tile__title">Grade Estimator</div>
            <div className="tile__subtitle">Class builder, analyzer, and scenario sandbox</div>
          </button>
          <button
            className="tile"
            onClick={() => {
              window.location.href = coinAtlasUrl;
            }}
          >
            <div className="tile__title">Coin Atlas</div>
            <div className="tile__subtitle">Track world coin and bill collection progress</div>
          </button>
          <button
            className="tile"
            onClick={() => {
              window.location.href = bobsBooksUrl;
            }}
          >
            <div className="tile__title">Bob's Books</div>
            <div className="tile__subtitle">Personal library tracker, sessions, and reading goals</div>
          </button>
          <button
            className="tile"
            onClick={() => {
              window.location.href = emojiBattleUrl;
            }}
          >
            <div className="tile__title">Emoji Battle</div>
            <div className="tile__subtitle">Multiplayer emoji strategy battles</div>
          </button>
          <button
            className="tile"
            onClick={() => {
              window.location.href = timeLoopCyoaUrl;
            }}
          >
            <div className="tile__title">Time Loop CYOA</div>
            <div className="tile__subtitle">Shared time-loop story editor</div>
          </button>
          <button
            className="tile"
            onClick={() => {
              window.location.href = museumMasterpiecesUrl;
            }}
          >
            <div className="tile__title">Museum Masterpieces</div>
            <div className="tile__subtitle">Personal art tracker across museums</div>
          </button>
        </div>
      </section>
    </div>
  );
}
