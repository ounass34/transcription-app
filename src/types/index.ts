export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ReportFormat = 'structured' | 'pdf' | 'word' | 'excel'

export interface Transcription {
  id: string
  user_id: string
  title: string
  audio_file_path: string
  audio_file_name: string
  audio_duration: number | null
  raw_text: string | null
  status: TranscriptionStatus
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  user_id: string
  title: string
  description: string | null
  structure_prompt: string
  created_at: string
  updated_at: string
}

export interface Report {
  id: string
  user_id: string
  transcription_id: string
  template_id: string | null
  title: string
  format: ReportFormat
  content: string
  created_at: string
}

export type TranscriptionWithRelations = Transcription & {
  reports?: Report[]
}
