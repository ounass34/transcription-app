import { useEffect, useState } from 'react'
import { Plus, FileText, Trash2, CreditCard as Edit2, X, Loader as Loader2, CircleAlert as AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { Template } from '../types'

export default function TemplatesPage() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [structurePrompt, setStructurePrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setTemplates(data ?? [])
    }
    setLoading(false)
  }

  const openCreate = () => {
    setEditingTemplate(null)
    setTitle('')
    setDescription('')
    setStructurePrompt('')
    setShowModal(true)
    setError(null)
  }

  const openEdit = (template: Template) => {
    setEditingTemplate(template)
    setTitle(template.title)
    setDescription(template.description ?? '')
    setStructurePrompt(template.structure_prompt)
    setShowModal(true)
    setError(null)
  }

  const handleSave = async () => {
    if (!title.trim() || !structurePrompt.trim()) {
      setError('Le titre et la structure sont obligatoires.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('templates')
          .update({ title, description, structure_prompt: structurePrompt })
          .eq('id', editingTemplate.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('templates')
          .insert({ title, description, structure_prompt: structurePrompt })

        if (error) throw error
      }

      await fetchTemplates()
      setShowModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce modèle ?')) return
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTemplate(null)
    setTitle('')
    setDescription('')
    setStructurePrompt('')
    setError(null)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Modèles</h1>
          <p className="text-neutral-500 text-sm mt-1">Créez des modèles de compte-rendu réutilisables</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all shadow-sm shadow-primary-600/20"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouveau modèle</span>
          <span className="sm:hidden">Nouveau</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-error-600 bg-error-50 border border-error-100 rounded-xl px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-100 p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 mb-4">
            <FileText className="w-6 h-6" />
          </div>
          <p className="text-neutral-700 font-medium text-sm">Aucun modèle créé</p>
          <p className="text-neutral-400 text-xs mt-1 mb-4">Les modèles vous permettent de générer des comptes-rendus avec une structure prédéfinie</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-all"
          >
            <Plus className="w-4 h-4" />
            Créer un modèle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-2xl border border-neutral-100 p-5 hover:shadow-md hover:shadow-neutral-200/40 transition-all group">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-neutral-900 text-sm truncate">{template.title}</h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {new Date(template.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(template)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-primary-600 hover:bg-primary-50 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(template.id)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-error-500 hover:bg-error-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {template.description && (
                <p className="text-xs text-neutral-500 mb-2">{template.description}</p>
              )}
              <div className="bg-neutral-50 rounded-xl p-3 mt-2">
                <p className="text-xs text-neutral-400 font-mono whitespace-pre-wrap line-clamp-4">
                  {template.structure_prompt}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-fade-in" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-neutral-900">
                {editingTemplate ? 'Modifier le modèle' : 'Nouveau modèle'}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-lg text-neutral-400 hover:bg-neutral-100 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Titre *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Compte-rendu de réunion"
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Modèle pour les réunions d'équipe"
                  className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                  Structure du compte-rendu *
                </label>
                <p className="text-xs text-neutral-400 mb-2">
                  Définissez les sections du compte-rendu (une section par ligne)
                </p>
                <textarea
                  value={structurePrompt}
                  onChange={(e) => setStructurePrompt(e.target.value)}
                  rows={8}
                  placeholder={"Ordre du jour\nParticipants\nDécisions prises\nActions à mener\nPoints en suspens"}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y font-mono"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-error-600 bg-error-50 border border-error-100 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-neutral-600 text-sm font-medium hover:bg-neutral-100 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-all"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
