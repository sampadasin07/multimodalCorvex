export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="footer-section">
          <div className="footer-brand">CORVEX</div>
          <p>
            Cardiovascular risk visualization and prediction platform.
            Powered by machine learning for clinical decision support.
          </p>
        </div>

        <div className="footer-section">
          <div className="footer-brand">Disclaimer</div>
          <p>
            For educational and decision-support purposes only. Not a diagnosis
            or a substitute for professional medical evaluation.
          </p>
        </div>

        <div className="footer-section">
          <div className="footer-brand">Privacy</div>
          <p>
            All demo records are synthetic. Patient data should be handled
            securely in production deployments.
          </p>
        </div>
      </div>
    </footer>
  );
}
