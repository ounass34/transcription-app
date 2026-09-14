import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, FileText, Clock, CheckCircle2, AlertCircle, Loader2, Plus, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Transcription } from '../types'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: typeof Clock }> = {
    pending: { label: 'En attente', className: 'bg-warning-100 text-warning-600', icon: Clock },
    processing: { label: 'Traitement', className: 'bg-primary-100 text-primary-700', icon: Loader2 },
    completed: { label: 'Terminé', className: 'bg-success-100 text-success-700', icon: CheckCircle2 },
    failed: { label: 'Échec', className: 'bg-error-100 text-error-600', icon: AlertCircle },
  }
  const { label, className, icon: Icon } = config[status] ?? config.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {label}
    </span>
  )
}

export default function Dashboard() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, completed: 0, processing: 0 })

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from('transcriptions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching transcriptions:', error)
      } else {
        setTranscriptions(data ?? [])
        const completed = data?.filter((t) => t.status === 'completed').length ?? 0
        const processing = data?.filter((t) => t.status === 'processing' || t.status === 'pending').length ?? 0
        setStats({ total: data?.length ?? 0, completed, processing })
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Tableau de bord</h1>
          <p className="text-neutral-500 text-sm mt-1">Gérez vos transcriptions et comptes-rendus</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all shadow-sm shadow-primary-600/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle transcription</span>
          <span className="sm:hidden">Nouvelle</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
              <p className="text-xs text-neutral-500">Total transcriptions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success-50 text-success-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{stats.completed}</p>
              <p className="text-xs text-neutral-500">Terminées</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-100 p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center">
              <Loader2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{stats.processing}</p>
              <p className="text-xs text-neutral-500">En cours</p>
            </div>
          </div>
        </div>
      </div>

      {/* Transcription list */}
      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="font-semibold text-neutral-900 text-sm">Transcriptions récentes</h2>
          <Link to="/templates" className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            Modèles
          </Link>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
          </div>
        ) : transcriptions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 mb-4">
              <Mic className="w-6 h-6" />
            </div>
            <p className="text-neutral-700 font-medium text-sm">Aucune transcription pour le moment</p>
            <p className="text-neutral-400 text-xs mt-1 mb-4">Importez un fichier audio ou enregistrez-vous pour commencer</p>
            <Link
              to="/upload"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all"
            >
              <Plus className="w-4 h-4" />
              Créer une transcription
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {transcriptions.map((t) => (
              <Link
                key={t.id}
                to={`/transcription/${t.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                  <Mic className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 text-sm truncate">{t.title}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {t.audio_file_name} · {formatDate(t.created_at)}
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-xs text-neutral-400">{formatDuration(t.audio_duration)}</p>
                </div>
                <StatusBadge status={t.status} />
                <ArrowRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
