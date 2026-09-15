import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, Upload, FileAudio, Loader as Loader2, Square, Trash2, CircleAlert as AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

type Mode = 'idle' | 'recording' | 'uploading' | 'submitted'

export default function UploadPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('idle')
  const [title, setTitle] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  const startRecording = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        setFileName(`enregistrement_${Date.now()}.webm`)
        setMode('idle')
      }

      recorder.start()
      setMode('recording')
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch {
      setError("Impossible d'accéder au microphone. Vérifiez les autorisations de votre navigateur.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac', 'audio/flac']
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(webm|wav|mp3|ogg|m4a|flac|aac)$/i)) {
      setError("Format de fichier non supporté. Utilisez MP3, WAV, OGG, M4A, WebM ou FLAC.")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("Le fichier est trop volumineux (maximum 50 Mo).")
      return
    }

    setAudioBlob(file)
    setAudioUrl(URL.createObjectURL(file))
    setFileName(file.name)
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ''))
  }

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setFileName('')
  }

  const handleSubmit = async () => {
    if (!audioBlob || !user) return
    setError(null)
    setMode('uploading')

    try {
      const filePath = `${user.id}/${Date.now()}_${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('audio_files')
        .upload(filePath, audioBlob)

      if (uploadError) throw uploadError

      const finalTitle = title.trim() || fileName.replace(/\.[^/.]+$/, '')

      const { data, error: dbError } = await supabase
        .from('transcriptions')
        .insert({
          title: finalTitle,
          audio_file_path: filePath,
          audio_file_name: fileName,
          status: 'pending',
        })
        .select()
        .single()

      if (dbError) throw dbError

      // Trigger the transcription edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token

      if (accessToken) {
        fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            transcriptionId: data.id,
            audioPath: filePath,
            userId: user.id,
          }),
        }).catch((err) => {
          console.warn('Failed to trigger transcription:', err)
        })
      }

      setMode('submitted')
      navigate(`/transcription/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue lors du téléversement.')
      setMode('idle')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Nouvelle transcription</h1>
        <p className="text-neutral-500 text-sm mt-1">Importez un fichier audio ou enregistrez-vous en direct</p>
      </div>

      {/* Mode selection */}
      {!audioBlob && mode !== 'recording' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-neutral-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="font-medium text-neutral-900 text-sm">Importer un fichier</p>
              <p className="text-xs text-neutral-400 mt-0.5">MP3, WAV, OGG, M4A, FLAC</p>
            </div>
          </button>

          <button
            onClick={startRecording}
            className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-neutral-200 hover:border-accent-300 hover:bg-accent-50/50 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent-50 text-accent-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="font-medium text-neutral-900 text-sm">Enregistrer en direct</p>
              <p className="text-xs text-neutral-400 mt-0.5">Utilisez votre microphone</p>
            </div>
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Recording state */}
      {mode === 'recording' && (
        <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-error-50/50 border border-error-100 mb-6 animate-fade-in">
          <div className="flex items-center gap-2 text-error-600">
            <div className="w-3 h-3 rounded-full bg-error-500 animate-pulse-slow" />
            <span className="text-lg font-mono font-medium">{formatTime(recordingTime)}</span>
          </div>
          <p className="text-sm text-neutral-600">Enregistrement en cours...</p>
          <button
            onClick={stopRecording}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-error-500 text-white text-sm font-medium hover:bg-error-600 transition-all"
          >
            <Square className="w-4 h-4" />
            Arrêter l'enregistrement
          </button>
        </div>
      )}

      {/* Audio preview */}
      {audioUrl && mode !== 'recording' && (
        <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-6 animate-slide-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <FileAudio className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 text-sm truncate">{fileName}</p>
              <p className="text-xs text-neutral-400">
                {audioBlob ? `${(audioBlob.size / 1024 / 1024).toFixed(2)} Mo` : ''}
              </p>
            </div>
            <button
              onClick={clearAudio}
              className="p-2 rounded-lg text-neutral-400 hover:text-error-500 hover:bg-error-50 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <audio src={audioUrl} controls className="w-full" />
        </div>
      )}

      {/* Title input */}
      {audioBlob && mode !== 'recording' && (
        <div className="mb-6 animate-slide-up">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            Titre de la transcription
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Donnez un nom à votre transcription"
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 text-sm text-error-600 bg-error-50 border border-error-100 rounded-xl px-4 py-3 mb-6 animate-slide-down">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      {audioBlob && mode !== 'recording' && mode !== 'uploading' && (
        <button
          onClick={handleSubmit}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white font-medium text-sm hover:bg-primary-700 transition-all shadow-sm shadow-primary-600/20"
        >
          <Upload className="w-4 h-4" />
          Téléverser et transcrire
        </button>
      )}

      {mode === 'uploading' && (
        <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-50 text-primary-700 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          Téléversement en cours...
        </div>
      )}
    </div>
  )
}
