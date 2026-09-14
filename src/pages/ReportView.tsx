import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Download, Trash2, AlertCircle, FileText, FileType, FileSpreadsheet,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Report, ReportFormat } from '../types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const formatIcons: Record<ReportFormat, typeof FileText> = {
  structured: FileText,
  pdf: FileType,
  word: FileText,
  excel: FileSpreadsheet,
}

const formatLabels: Record<ReportFormat, string> = {
  structured: 'Structuré',
  pdf: 'PDF',
  word: 'Word',
  excel: 'Excel',
}

export default function ReportView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReport() {
      if (!id) return
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error || !data) {
        setError('Compte-rendu introuvable.')
      } else {
        setReport(data)
      }
      setLoading(false)
    }
    fetchReport()
  }, [id])

  const handleDownload = () => {
    if (!report) return
    const blob = new Blob([report.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = async () => {
    if (!id || !report) return
    if (!confirm('Supprimer ce compte-rendu ?')) return
    await supabase.from('reports').delete().eq('id', id)
    navigate(`/transcription/${report.transcription_id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <p className="text-neutral-600">{error || 'Compte-rendu introuvable'}</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 mt-4 text-primary-600 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>
      </div>
    )
  }

  const Icon = formatIcons[report.format] ?? FileText

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <Link
        to={`/transcription/${report.transcription_id}`}
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la transcription
      </Link>

      <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-neutral-100">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-neutral-900 truncate">{report.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                    {formatLabels[report.format]}
                  </span>
                  <span>{formatDate(report.created_at)}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleDownload}
                className="p-2.5 rounded-xl text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                title="Télécharger"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-xl text-neutral-400 hover:text-error-500 hover:bg-error-50 transition-all"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-neutral-50 rounded-xl p-5 max-h-[60vh] overflow-y-auto">
            <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-mono leading-relaxed">
              {report.content}
            </pre>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-neutral-100 flex gap-2">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all"
          >
            <Download className="w-4 h-4" />
            Télécharger
          </button>
          <Link
            to={`/transcription/${report.transcription_id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-neutral-600 text-sm font-medium hover:bg-neutral-100 transition-all"
          >
            Retour à la transcription
          </Link>
        </div>
      </div>
    </div>
  )
}
