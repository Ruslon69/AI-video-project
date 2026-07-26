export type ProjectAnalysisStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'

export type AnalysisAudioStream = Readonly<{
  index: number
  codec: string
  channels: number | null
  sampleRate: number | null
  channelLayout: string | null
  language: string | null
}>

export type AnalysisMediaMetadata = Readonly<{
  filename: string
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  bitrate: number | null
  fileSize: number
  audioStreams: AnalysisAudioStream[]
}>

export type AnalysisAudioExtraction = Readonly<{
  status: 'extracted' | 'not_available'
  format: 'wav'
  sampleRate: number
  channels: number
}>

export type AnalysisTranscriptSegment = Readonly<{
  id: number
  start: number
  end: number
  text: string
  confidence: number | null
}>

export type AnalysisTranscript = Readonly<{
  language: string
  segments: AnalysisTranscriptSegment[]
}>

export type AnalysisScene = Readonly<{
  id: string
  start: number
  end: number
  confidence: number
}>

export type AnalysisSilence = Readonly<{
  id: string
  start: number
  end: number
  duration: number
}>

export type ProjectAnalysis = Readonly<{
  schemaVersion: '1.0'
  pipelineVersion: 'analysis-v1'
  sourceAssetId: string
  generatedAt: string
  metadata: AnalysisMediaMetadata
  audioExtraction: AnalysisAudioExtraction
  transcript: AnalysisTranscript
  scenes: AnalysisScene[]
  silences: AnalysisSilence[]
}>

export type ProjectAnalysisState = Readonly<{
  status: ProjectAnalysisStatus
  progress: number
  sourceAssetId: string | null
  result: ProjectAnalysis | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
}>

export function createIdleProjectAnalysisState(): ProjectAnalysisState {
  return {
    status: 'idle',
    progress: 0,
    sourceAssetId: null,
    result: null,
    error: null,
    startedAt: null,
    completedAt: null,
  }
}
