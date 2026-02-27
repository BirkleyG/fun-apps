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

export default function App() {
  const bibleUrl = getBibleUrl();
  const gradeEstimatorUrl = getGradeEstimatorUrl();
  const coinAtlasUrl = getCoinAtlasUrl();

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
        </div>
      </section>
    </div>
  );
}
