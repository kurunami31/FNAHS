import { useState } from 'react'
import { ShieldCheck, ArrowRight, Lock, Database, Eye } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { api } from '../lib/api'

export default function PrivacyNotice() {
  const { orgFull, toast, refreshUser, logout } = useApp()
  const [agreed, setAgreed] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleAccept() {
    if (!agreed || saving) return
    setSaving(true)
    try {
      await api.acceptPrivacyPolicy()
      toast('Thank you. Welcome to the community.')
      await refreshUser()
    } catch (e) {
      toast(e?.message || 'Could not save your consent. Please try again.', 'err')
      setSaving(false)
    }
  }

  return (
    <div className="privacy-gate">
      <div className="privacy-card">
        <div className="privacy-seal">
          <ShieldCheck size={26} />
        </div>

        <p className="privacy-kicker">{orgFull} community platform</p>
        <h1>Data Privacy Notice</h1>
        <p className="privacy-lead">
          Before you can enter the community, please read how your information is handled.
          This notice follows the spirit of the Philippine Data Privacy Act of 2012 (R.A. 10173).
        </p>

        <div className="privacy-body">
          <section>
            <h2><Database size={15} /> What we collect</h2>
            <ul>
              <li>Your account details: name, email, program, year level, and ID photo.</li>
              <li>Content you create: posts, comments, likes, event RSVPs, and attendance records.</li>
              <li>Conversations with Florence, our AI assistant, which are kept on your own account history.</li>
            </ul>
          </section>
          <section>
            <h2><Eye size={15} /> How we use it</h2>
            <ul>
              <li>To run community features — the feed, events, directory, ID cards, and attendance.</li>
              <li>For organization officers to manage events, verify attendance, and moderate content.</li>
              <li>To answer your questions through Florence and improve the platform experience.</li>
            </ul>
          </section>
          <section>
            <h2><Lock size={15} /> Your rights</h2>
            <ul>
              <li>Your information is visible only to members of the {orgFull} community — it is never sold.</li>
              <li>Role-based access control limits who can view or change sensitive records.</li>
              <li>You may update your details anytime, or ask the organization moderators to delete your account and records.</li>
            </ul>
          </section>
        </div>

        <label className="privacy-agree">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={saving} />
          <span>
            I have read and understood the data privacy notice, and I consent to the processing of my
            information as described above.
          </span>
        </label>

        <div className="privacy-actions">
          <button className="privacy-btn ghost" onClick={() => logout()} disabled={saving}>
            Sign out
          </button>
          <button className="privacy-btn" onClick={handleAccept} disabled={!agreed || saving}>
            {saving ? 'Saving…' : 'Continue to the community'}
            {!saving && <ArrowRight size={16} />}
          </button>
        </div>
        <p className="privacy-foot">
          Questions? Contact the organization moderators — a summary of your consent is saved to your account.
        </p>
      </div>
    </div>
  )
}