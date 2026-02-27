const getBibleUrl = () => {
  const envUrl = import.meta.env.VITE_BIBLE_APP_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./bible-tracker/";
};

const getGradeEstimatorUrl = () => {
  const envUrl = import.meta.env.VITE_GRADE_ESTIMATOR_URL as string | undefined;
  return envUrl && envUrl.trim().length > 0 ? envUrl : "./grade-estimator/";
};

export default function App() {
  const bibleUrl = getBibleUrl();
  const gradeEstimatorUrl = getGradeEstimatorUrl();

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
        </div>
      </section>
    </div>
  );
}
