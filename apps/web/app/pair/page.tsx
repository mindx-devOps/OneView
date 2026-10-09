export default function PairPage() {
  return (
    <div className="list">
      <section className="card">
        <div className="card-title">Sign in & pair</div>
        <p>Placeholder for Phase 2.</p>
        <ol className="small">
          <li>Sign in to OneView.</li>
          <li>On your laptop, run the connector. It shows a QR code.</li>
          <li>Scan it with the Android app. Pair codes are single use and expire after 2 minutes.</li>
        </ol>
        <div className="qr-placeholder" aria-label="QR code placeholder">QR</div>
      </section>
    </div>
  );
}
