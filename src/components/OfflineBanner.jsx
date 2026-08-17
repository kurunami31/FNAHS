import { WifiOff, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function OfflineBanner() {
  const { online, pendingCount, syncing, syncNow } = useApp()

  if (online && pendingCount === 0) return null

  const offline = !online
  return (
    <div className={`offline-banner${offline ? '' : ' offline-banner--pending'}`} role="status">
      {offline ? (
        <>
          <WifiOff size={15} />
          <p>
            You're offline — browsing works, and changes are saved here for now
            {pendingCount > 0 ? ` (${pendingCount} pending sync)` : ''}.
          </p>
          {pendingCount > 0 && (
            <button className="btn btn--tiny" onClick={syncNow} disabled={syncing}>
              <RefreshCw size={13} className={syncing ? 'spin' : ''} /> Sync now
            </button>
          )}
        </>
      ) : (
        <>
          <RefreshCw size={15} className={syncing ? 'spin' : ''} />
          <p>{syncing ? 'Syncing your pending changes…' : `${pendingCount} change${pendingCount === 1 ? '' : 's'} waiting to sync.`}</p>
          <button className="btn btn--tiny" onClick={syncNow} disabled={syncing}>
            Sync now
          </button>
        </>
      )}
    </div>
  )
}
