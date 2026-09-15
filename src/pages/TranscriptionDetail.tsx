import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Loader as Loader2, FileText, FileAudio, Clock, Plus, Trash2, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Download, Sparkles, FileSpreadsheet, FileType } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Transcription, Template, Report, ReportFormat } from '../types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}m ${secs}s`
}

export default function TranscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [transcription, setTranscription] = useState<Transcription | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingText, setEditingText] = useState(false)
  const [rawText, setRawText] = useState('')
  const [showReportModal, setShowReportModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [reportTitle, setReportTitle] = useState('')
  const [reportFormat, setReportFormat] = useState<ReportFormat>('structured')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true

    async function fetchData() {
      const { data: trans, error: transError } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!active) return
      if (transError || !trans) {
        setError('Transcription introuvable.')
        setLoading(false)
        return
      }

      setTranscription(trans)
      setRawText(trans.raw_text ?? '')

      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .eq('transcription_id', id)
        .order('created_at', { ascending: false })

      if (!active) return
      setReports(reportsData ?? [])

      const { data: templatesData } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false })

      if (!active) return
      setTemplates(templatesData ?? [])
      setLoading(false)
    }
    fetchData()

    // Poll for status updates while transcription is pending or processing
    const pollInterval = setInterval(async () => {
      const { data: trans } = await supabase
        .from('transcriptions')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (!active || !trans) return

      setTranscription((prev) => {
        if (prev && prev.status !== trans.status) {
          setRawText(trans.raw_text ?? '')
          return trans
        }
        return prev
      })

      if (trans.status === 'completed' || trans.status === 'failed') {
        clearInterval(pollInterval)
      }
    }, 3000)

    return () => {
      active = false
      clearInterval(pollInterval)
    }
  }, [id])

  const updateTranscription = async (updates: Partial<Transcription>) => {
    if (!id) return
    const { error } = await supabase.from('transcriptions').update(updates).eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setTranscription((prev) => prev ? { ...prev, ...updates } : null)
  }

  const handleSaveText = async () => {
    await updateTranscription({ raw_text: rawText, status: 'completed' })
    setEditingText(false)
  }

  const handleDelete = async () => {
    if (!id || !transcription) return
    if (!confirm('Supprimer cette transcription et tous ses comptes-rendus ?')) return

    if (transcription.audio_file_path) {
      await supabase.storage.from('audio_files').remove([transcription.audio_file_path])
    }

    await supabase.from('transcriptions').delete().eq('id', id)
    navigate('/dashboard')
  }

  const handleGenerateReport = async () => {
    if (!id || !transcription) return
    setGenerating(true)
    setError(null)

    try {
      const template = templates.find((t) => t.id === selectedTemplate)
      const baseTitle = reportTitle.trim() || `Compte-rendu - ${transcription.title}`
      const text = transcription.raw_text || ''

      let content = ''

      if (reportFormat === 'structured' && template) {
        content = generateStructuredReport(text, template)
      } else if (reportFormat === 'excel') {
        content = generateExcelReport(text)
      } else if (reportFormat === 'pdf') {
        content = generatePdfReport(text, baseTitle)
      } else if (reportFormat === 'word') {
        content = generateWordReport(text, baseTitle)
      } else {
        content = generateDefaultReport(text)
      }

      const { data, error: insertError } = await supabase
        .from('reports')
        .insert({
          transcription_id: id,
          template_id: template?.id ?? null,
          title: baseTitle,
          format: reportFormat,
          content,
        })
        .select()
        .single()

      if (insertError) throw insertError

      setReports((prev) => [data, ...prev])
      setShowReportModal(false)
      setReportTitle('')
      setSelectedTemplate('')
      navigate(`/report/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération.')
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = (report: Report) => {
    const blob = new Blob([report.content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!transcription) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <p className="text-neutral-600">{error || 'Transcription introuvable'}</p>
        <Link to="/dashboard" className="inline-flex items-center gap-2 mt-4 text-primary-600 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Retour au tableau de bord
        </Link>
      </div>
    )
  }

  const formatIcons: Record<ReportFormat, typeof FileText> = {
    structured: FileText,
    pdf: FileType,
    word: FileText,
    excel: FileSpreadsheet,
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-700 mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900">{transcription.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <FileAudio className="w-3.5 h-3.5" />
              {transcription.audio_file_name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(transcription.created_at)}
            </span>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="p-2.5 rounded-xl text-neutral-400 hover:text-error-500 hover:bg-error-50 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-error-600 bg-error-50 border border-error-100 rounded-xl px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transcription text */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-600" />
                Transcription
              </h2>
              {transcription.status === 'completed' && !editingText && (
                <button
                  onClick={() => setEditingText(true)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Modifier le texte
                </button>
              )}
            </div>

            <div className="p-5">
              {transcription.status === 'pending' && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-3" />
                  <p className="text-sm text-neutral-600">Transcription en attente de traitement...</p>
                  <p className="text-xs text-neutral-400 mt-1">Vous pouvez ajouter le texte manuellement</p>
                  <button
                    onClick={() => { setEditingText(true); updateTranscription({ status: 'processing' }) }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Saisir le texte
                  </button>
                </div>
              )}

              {transcription.status === 'processing' && !editingText && !rawText && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary-500 mb-3" />
                  <p className="text-sm text-neutral-600">Traitement en cours...</p>
                  <button
                    onClick={() => setEditingText(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Saisir le texte manuellement
                  </button>
                </div>
              )}

              {editingText ? (
                <div>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    rows={12}
                    placeholder="Collez ou saisissez le texte de la transcription ici..."
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={handleSaveText}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Enregistrer
                    </button>
                    <button
                      onClick={() => { setEditingText(false); setRawText(transcription.raw_text ?? '') }}
                      className="px-4 py-2 rounded-xl text-neutral-600 text-sm font-medium hover:bg-neutral-100 transition-all"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              ) : rawText ? (
                <div className="prose prose-sm max-w-none">
                  <p className="text-neutral-700 whitespace-pre-wrap text-sm leading-relaxed">{rawText}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Reports sidebar */}
        <div>
          <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent-600" />
                Comptes-rendus
              </h2>
              {transcription.raw_text && (
                <button
                  onClick={() => setShowReportModal(true)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Générer
                </button>
              )}
            </div>

            <div className="p-3">
              {reports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400">Aucun compte-rendu généré</p>
                  {transcription.raw_text && (
                    <button
                      onClick={() => setShowReportModal(true)}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium hover:bg-primary-100 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      Générer un compte-rendu
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => {
                    const Icon = formatIcons[report.format] ?? FileText
                    return (
                      <div key={report.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 transition-all group">
                        <div className="w-9 h-9 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <Link to={`/report/${report.id}`} className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{report.title}</p>
                          <p className="text-xs text-neutral-400 capitalize">{report.format}</p>
                        </Link>
                        <button
                          onClick={() => downloadReport(report)}
                          className="p-1.5 rounded-lg text-neutral-300 hover:text-primary-600 hover:bg-primary-50 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Audio info */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 mt-4">
            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Informations</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-400">Durée</span>
                <span className="text-neutral-700 font-medium">{formatDuration(transcription.audio_duration)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Statut</span>
                <span className="text-neutral-700 font-medium capitalize">{transcription.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Créé le</span>
                <span className="text-neutral-700 font-medium text-xs">{formatDate(transcription.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report generation modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowReportModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-neutral-900 mb-1">Générer un compte-rendu</h2>
            <p className="text-sm text-neutral-500 mb-5">Choisissez un format et un modèle pour votre compte-rendu</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Titre</label>
                <input
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Compte-rendu de réunion..."
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Format de sortie</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'structured', label: 'Structuré', icon: FileText },
                    { value: 'pdf', label: 'PDF', icon: FileType },
                    { value: 'word', label: 'Word', icon: FileText },
                    { value: 'excel', label: 'Excel', icon: FileSpreadsheet },
                  ] as const).map((opt) => {
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setReportFormat(opt.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                          reportFormat === opt.value
                            ? 'border-primary-300 bg-primary-50 text-primary-700'
                            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {reportFormat === 'structured' && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1.5">Modèle</label>
                  {templates.length === 0 ? (
                    <div className="text-xs text-neutral-400 bg-neutral-50 rounded-xl px-4 py-3">
                      Aucun modèle créé.{' '}
                      <Link to="/templates" className="text-primary-600 font-medium">Créer un modèle</Link>
                    </div>
                  ) : (
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">-- Sans modèle (format libre) --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowReportModal(false)}
                className="flex-1 py-2.5 rounded-xl text-neutral-600 text-sm font-medium hover:bg-neutral-100 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleGenerateReport}
                disabled={generating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-all"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Génération...' : 'Générer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function generateStructuredReport(text: string, template: Template): string {
  const sections = template.structure_prompt.split('\n').filter((s) => s.trim())
  const lines = text.split('\n').filter((l) => l.trim())

  let content = `# ${template.title}\n\n`
  content += `Modèle: ${template.title}\n`
  if (template.description) content += `Description: ${template.description}\n`
  content += `\n---\n\n`

  for (const section of sections) {
    const sectionTitle = section.replace(/^#+\s*/, '').replace(/[*_]/g, '').trim()
    if (!sectionTitle) continue
    content += `## ${sectionTitle}\n\n`
    const relevantLines = lines.slice(0, Math.min(5, lines.length))
    content += relevantLines.join('\n') + '\n\n'
  }

  content += `\n---\n\n## Texte complet\n\n${text}`
  return content
}

function generateDefaultReport(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim())
  return `# Compte-rendu\n\n## Résumé\n\n${lines.slice(0, 3).join(' ')}\n\n## Contenu détaillé\n\n${text}\n\n---\nGénéré le ${new Date().toLocaleDateString('fr-FR')}`
}

function generatePdfReport(text: string, title: string): string {
  return `%PDF-1.4 Format Report\n\nTitle: ${title}\nDate: ${new Date().toLocaleDateString('fr-FR')}\n\n--- Content ---\n\n${text}\n\n--- End of document ---`
}

function generateWordReport(text: string, title: string): string {
  return `Document Word - ${title}\nDate: ${new Date().toLocaleDateString('fr-FR')}\n\n${text}`
}

function generateExcelReport(text: string): string {
  const lines = text.split('\n').filter((l) => l.trim())
  let csv = 'Section\tContenu\tTimestamp\n'
  lines.forEach((line, i) => {
    csv += `Ligne ${i + 1}\t${line.replace(/\t/g, ' ')}\t\n`
  })
  return csv
}
