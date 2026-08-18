import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

/*
 * App-install banner. Listens for the browser's beforeinstallprompt event
 * (Android/Chrome/Edge) and offers a button that triggers the native prompt.
 * iOS/Safari has no event — the hint text shows how to add to the home
 * screen from Share. Dismissed state is remembered for the session.
 */

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [ios, setIos] = useState(false)
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem('fnahs-install-dismissed') === '1')

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
    }
    const isIosSafari = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
    window.addEventListener('beforeinstallprompt', onPrompt)
    if (isIosSafari && !isStandalone) setIos(true)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (dismissed || (!deferred && !ios)) return null

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try {
      await deferred.userChoice
    } finally {
      setDeferred(null)
    }
  }

  return (
    <div className="install-banner" role="note">
      {ios ? (
        <p>Install FNAHS PULSO — tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>
      ) : (
        <>
          <p><b>Install FNAHS PULSO</b> on your device for offline access.</p>
          <button className="btn btn--sm btn--primary" onClick={install}>
            <Download size={13} /> Install
          </button>
        </>
      )}
      <button
        className="icon-btn"
        onClick={() => {
          setDismissed(true)
          sessionStorage.setItem('fnahs-install-dismissed', '1')
        }}
        aria-label="Dismiss install banner"
      >
        <X size={14} />
      </button>
    </div>
  )
}
