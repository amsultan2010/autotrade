export function ScanlineOverlay() {
  return (
    <>
      {/* Edge vignette */}
      <div className="fx-vignette" aria-hidden="true" />
      {/* Static horizontal scanlines */}
      <div className="fx-scanlines" aria-hidden="true" />
      {/* Film grain */}
      <div className="fx-grain" aria-hidden="true" />
    </>
  );
}
