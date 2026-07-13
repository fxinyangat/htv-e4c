import { useState, ReactNode } from 'react'
import { X, MoreVertical, Pencil, Trash2, ExternalLink, Bot, UserRound, HelpCircle, CheckCircle2, AlertTriangle, XCircle, PlusCircle, Sparkles, Send, Bell, CalendarClock } from 'lucide-react'
import { Company, ActivityType, ScoreBand, computeScore, deleteCompany, addNote, deleteNote, isRealCompanyId } from '../api'
import EditCompanyModal from './EditCompanyModal'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import { useToast } from '../context/ToastContext'

const ACTIVITY_META: Record<ActivityType, { icon: typeof PlusCircle; cls: string }> = {
  created: { icon: PlusCircle, cls: 'bg-ht-blue/5 text-ht-blue/60' },
  tagged: { icon: Sparkles, cls: 'bg-indigo-50 text-indigo-600' },
  reviewed: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-600' },
  edited: { icon: Pencil, cls: 'bg-amber-50 text-amber-600' },
}

const AVATAR_COLORS = [
  'bg-ht-orange/10 text-ht-orange',
  'bg-indigo-100 text-indigo-600',
  'bg-emerald-100 text-emerald-600',
  'bg-fuchsia-100 text-fuchsia-600',
  'bg-amber-100 text-amber-700',
]

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase()
}

function avatarColor(name: string): string {
  const sum = [...name].reduce((n, c) => n + c.charCodeAt(0), 0)
  return AVATAR_COLORS[sum % AVATAR_COLORS.length]
}

const CLASSIFICATION_AXES: [string, string][] = [
  ['industry', 'Industry'],
  ['construction_stage', 'Construction Stage'],
  ['product_type', 'Product Type'],
  ['technology_type', 'Technology Type'],
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function reminderStatus(dateStr: string): 'overdue' | 'soon' | 'upcoming' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = (new Date(dateStr).getTime() - today.getTime()) / 86400000
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'soon'
  return 'upcoming'
}

const REMINDER_META: Record<ReturnType<typeof reminderStatus>, string> = {
  overdue: 'bg-red-50 text-red-600 ring-red-600/20',
  soon: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  upcoming: 'bg-ht-blue/5 text-ht-blue/60 ring-ht-blue/10',
}

// Reads the real "Tagged By" value from Notion directly, rather than inferring it from tags.
function taggedByMeta(taggedBy: string): { label: string; cls: string; icon: typeof Bot } {
  if (taggedBy === 'Human') return { label: 'Human', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: UserRound }
  if (taggedBy === 'AI Agent') return { label: 'AI Agent', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', icon: Bot }
  return { label: 'Untagged', cls: 'bg-ht-blue/5 text-ht-blue/50 ring-ht-blue/10', icon: HelpCircle }
}

// Same data-completeness scoring used in the Review Queue — Notion doesn't give us a real
// per-tag AI confidence score, so this reuses the score/band the queue already computes.
const SCORE_BADGE_META: Record<ScoreBand, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  high: { label: 'High', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', icon: CheckCircle2 },
  needs_review: { label: 'Needs Review', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20', icon: AlertTriangle },
  insufficient: { label: 'Insufficient Data', cls: 'bg-red-50 text-red-600 ring-red-600/20', icon: XCircle },
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-ht-blue/60 shrink-0">{label}</span>
      <div className="text-sm font-medium text-ht-blue text-right">{children}</div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center py-24">
      <p className="text-sm text-ht-blue/40">{text}</p>
    </div>
  )
}

interface Props {
  company: Company
  onClose: () => void
  onDeleted: () => void
  onUpdated: () => void
}

export default function CompanyDetailPanel({ company, onClose, onDeleted, onUpdated }: Props) {
  const { showToast } = useToast()
  const [tab, setTab] = useState<'details' | 'activity' | 'notes'>('details')
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [reminderDate, setReminderDate] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteText.trim()) return
    if (isRealCompanyId(company.id)) {
      showToast('info', 'Not connected yet', 'Notes on Notion-backed companies aren\'t wired up yet.')
      return
    }
    setAddingNote(true)
    await addNote(company.id, noteText.trim(), reminderDate || null)
    setNoteText('')
    setReminderDate('')
    setAddingNote(false)
    onUpdated()
  }

  async function handleDeleteNote(noteId: string) {
    if (isRealCompanyId(company.id)) {
      showToast('info', 'Not connected yet', 'Notes on Notion-backed companies aren\'t wired up yet.')
      return
    }
    await deleteNote(company.id, noteId)
    showToast('success', 'Note deleted', 'The note has been removed.')
    onUpdated()
  }

  async function handleConfirmDelete() {
    if (isRealCompanyId(company.id)) {
      setDeleting(false)
      showToast('info', 'Not connected yet', 'Deleting Notion-backed companies isn\'t wired up yet.')
      return
    }
    setDeleteLoading(true)
    await deleteCompany(company.id)
    setDeleteLoading(false)
    setDeleting(false)
    showToast('success', 'Company deleted', `${company.name} has been removed from the database.`)
    onDeleted()
  }

  const active = company.tags.filter(t => t.is_accepted !== false)
  const valuesFor = (axis: string) => active.filter(t => t.axis === axis).map(t => t.value)
  const tb = taggedByMeta(company.tagged_by)
  const { score, band } = computeScore(company)
  const conf = SCORE_BADGE_META[band]

  return (
    <div className="fixed top-24 right-6 bottom-6 w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-white z-40 flex flex-col overflow-hidden">
      {/* header */}
      <div className="px-8 pt-7 pb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-display font-bold text-ht-blue tracking-tight truncate">{company.name}</h2>
          {company.domain && (
            <a
              href={`https://${company.domain}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-ht-blue/50 hover:text-ht-orange transition-colors inline-flex items-center gap-1 mt-1"
            >
              {company.domain} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 rounded-full bg-ht-blue/5 hover:bg-ht-blue/10 flex items-center justify-center text-ht-blue/60 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div
                onMouseLeave={() => setMenuOpen(false)}
                className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-ht-blue/10 overflow-hidden z-10"
              >
                <button
                  onClick={() => { setMenuOpen(false); setEditing(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-ht-blue hover:bg-ht-blue/5 flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setDeleting(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-ht-blue/5 hover:bg-ht-blue/10 flex items-center justify-center text-ht-blue/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-6 px-8 border-b border-ht-blue/10">
        {(['details', 'activity', 'notes'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative py-3 text-sm font-semibold capitalize transition-colors ${tab === t ? 'text-ht-blue' : 'text-ht-blue/40 hover:text-ht-blue/70'}`}
          >
            {t}
            {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-ht-orange rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
        {tab === 'details' && (
          <div className="space-y-7">
            <p className="text-sm text-ht-blue/80 leading-relaxed border-l-2 border-ht-orange pl-4">
              {company.description.trim() || <span className="text-ht-blue/30 italic">No company description available.</span>}
            </p>

            <section>
              <h4 className="text-[11px] font-bold text-ht-blue/40 uppercase tracking-widest mb-1">Classification</h4>
              <div className="divide-y divide-ht-blue/5">
                {CLASSIFICATION_AXES.map(([axis, label]) => {
                  const values = valuesFor(axis)
                  if (!values.length) return null
                  return (
                    <InfoRow key={axis} label={label}>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {values.map(v => (
                          <span key={v} className="px-2.5 py-1 rounded-lg bg-ht-blue/5 text-ht-blue text-xs font-medium">{v}</span>
                        ))}
                      </div>
                    </InfoRow>
                  )
                })}
                {company.region.length > 0 && (
                  <InfoRow label="Region">
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {company.region.map(v => (
                        <span key={v} className="px-2.5 py-1 rounded-lg bg-ht-blue/5 text-ht-blue text-xs font-medium">{v}</span>
                      ))}
                    </div>
                  </InfoRow>
                )}
              </div>
            </section>

            <section>
              <h4 className="text-[11px] font-bold text-ht-blue/40 uppercase tracking-widest mb-1">Company Info</h4>
              <div className="divide-y divide-ht-blue/5">
                <InfoRow label="Domain">
                  {company.domain
                    ? <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-ht-orange hover:underline inline-flex items-center gap-1">{company.domain} <ExternalLink className="w-3 h-3" /></a>
                    : <span className="text-ht-blue/30">—</span>}
                </InfoRow>
                <InfoRow label="Location">
                  {company.location.trim() || <span className="text-ht-blue/30">Not specified</span>}
                </InfoRow>
                <InfoRow label="Diversity Status">{company.diversity_status ?? 'Not specified'}</InfoRow>
                <InfoRow label="LinkedIn">
                  {company.linkedin_url
                    ? <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="text-ht-orange hover:underline inline-flex items-center gap-1">View profile <ExternalLink className="w-3 h-3" /></a>
                    : <span className="text-ht-blue/30">—</span>}
                </InfoRow>
                <InfoRow label="Origin Source">
                  {company.origin_source.trim() || <span className="text-ht-blue/30">Not specified</span>}
                </InfoRow>
                <InfoRow label="Allie Knockout Pass/Fail">
                  {company.allie_knockout ?? <span className="text-ht-blue/30">Not specified</span>}
                </InfoRow>
                <InfoRow label="Andra Knockout Pass/Fail">
                  {company.andra_knockout ?? <span className="text-ht-blue/30">Not specified</span>}
                </InfoRow>
              </div>
            </section>

            <section>
              <h4 className="text-[11px] font-bold text-ht-blue/40 uppercase tracking-widest mb-1">Metadata</h4>
              <div className="divide-y divide-ht-blue/5">
                <InfoRow label="Tagged By">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${tb.cls}`}>
                    <tb.icon className="w-3.5 h-3.5" /> {tb.label}
                  </span>
                </InfoRow>
                <InfoRow label="Confidence">
                  <div className="flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset ${conf.cls}`}>
                      <conf.icon className="w-3.5 h-3.5" /> {conf.label}
                    </span>
                    <span className="text-[11px] text-ht-blue/40">{score}/100</span>
                  </div>
                </InfoRow>
                <InfoRow label="Date Added">{formatDate(company.updated_at)}</InfoRow>
              </div>
            </section>
          </div>
        )}

        {tab === 'activity' && (
          company.activity.length === 0 ? (
            <EmptyState text="No activity recorded yet." />
          ) : (
            <div className="space-y-5">
              {[...company.activity].sort((a, b) => b.date.localeCompare(a.date)).map((entry, idx, arr) => {
                const meta = ACTIVITY_META[entry.type]
                const Icon = meta.icon
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.cls}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      {idx < arr.length - 1 && <span className="w-px flex-1 bg-ht-blue/10 my-1" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm text-ht-blue font-medium">{entry.label}</p>
                      <p className="text-xs text-ht-blue/40 mt-0.5">{formatDate(entry.date)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {tab === 'notes' && (
          <div className="flex flex-col h-full">
            <form onSubmit={handleAddNote} className="mb-7">
              <label className="block text-[11px] font-bold text-ht-blue/40 uppercase tracking-widest mb-2">Add a note</label>
              <div className="relative bg-white border border-ht-blue/10 rounded-2xl shadow-sm focus-within:border-ht-orange/40 focus-within:ring-4 focus-within:ring-ht-orange/10 transition-all">
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Share context, next steps, or diligence findings…"
                  rows={3}
                  className="w-full px-4 pt-3.5 pb-3 text-sm bg-transparent focus:outline-none text-ht-blue placeholder:text-ht-blue/30 resize-none"
                />
                <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-2 border-t border-ht-blue/5">
                  <label className="flex items-center gap-1.5 text-xs text-ht-blue/50 hover:text-ht-blue transition-colors cursor-pointer">
                    <Bell className="w-3.5 h-3.5 shrink-0" />
                    <span className="shrink-0">{reminderDate ? 'Follow up on' : 'Set a follow-up reminder'}</span>
                    <input
                      type="date"
                      value={reminderDate}
                      onChange={e => setReminderDate(e.target.value)}
                      className="bg-transparent text-xs text-ht-blue/70 focus:outline-none cursor-pointer [color-scheme:light]"
                    />
                    {reminderDate && (
                      <button
                        type="button"
                        onClick={() => setReminderDate('')}
                        className="text-ht-blue/30 hover:text-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </label>
                  <button
                    type="submit"
                    disabled={addingNote || !noteText.trim()}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-ht-orange text-white text-xs font-semibold rounded-lg hover:shadow-md hover:shadow-ht-orange/30 transition-all disabled:opacity-30 disabled:hover:shadow-none shrink-0"
                  >
                    {addingNote ? 'Posting…' : 'Post note'} <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </form>

            {company.notes.length === 0 ? (
              <EmptyState text="No notes yet." />
            ) : (
              <div className="space-y-3">
                {[...company.notes].sort((a, b) => b.date.localeCompare(a.date)).map(note => (
                  <div key={note.id} className="group relative bg-white border border-ht-blue/10 rounded-2xl shadow-sm hover:shadow-md transition-all p-4">
                    <div className="flex items-start gap-3 pr-6">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(note.author)}`}>
                        {initials(note.author)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-ht-blue">{note.author}</span>
                          <span className="text-ht-blue/20">·</span>
                          <span className="text-xs text-ht-blue/40">{formatDate(note.date)}</span>
                        </div>
                        <p className="text-sm text-ht-blue/70 leading-relaxed mt-1">{note.text}</p>
                        {note.reminder_date && (
                          <span className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${REMINDER_META[reminderStatus(note.reminder_date)]}`}>
                            <CalendarClock className="w-3 h-3" />
                            {reminderStatus(note.reminder_date) === 'overdue' ? 'Overdue since' : 'Follow up'} {formatDate(note.reminder_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-ht-blue/30 hover:text-red-600 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editing && (
        <EditCompanyModal
          company={company}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); onUpdated() }}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          name={company.name}
          onCancel={() => setDeleting(false)}
          onConfirm={handleConfirmDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  )
}
