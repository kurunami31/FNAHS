export default function Ecg({ className = '' }) {
  return (
    <svg className={`ecg ${className}`} viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0 12h30l4-4 6 8 6-8 4 4h70" />
    </svg>
  )
}