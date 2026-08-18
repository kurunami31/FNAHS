import { Database, Eye, Lock } from 'lucide-react'
import { useApp } from '../context/AppContext'

/** The Data Privacy Notice body — shared by the full consent gate (first
    entry) and the read-only preview shown on the signup form. */
export default function PrivacyNoticeContent() {
  const { orgFull } = useApp()
  return (
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
  )
}