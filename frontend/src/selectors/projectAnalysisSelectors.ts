import type { ProjectAnalysisState } from '../analysis/models'
import type { MediaItem, VideoScenes, VideoTranscription } from '../types'

export function applyProjectAnalysisToPrimaryMedia(
  mediaItem: MediaItem | null,
  analysisState: ProjectAnalysisState,
): MediaItem | null {
  const analysis = analysisState.result

  if (
    !mediaItem ||
    analysisState.status !== 'completed' ||
    !analysis
  ) {
    return mediaItem
  }

  const scenes: VideoScenes = {
    outcome: analysis.scenes.length > 1
      ? 'scenes_detected'
      : 'no_scene_changes',
    scenes: analysis.scenes.map((scene) => ({
      id: scene.id,
      start: scene.start,
      end: scene.end,
      duration: Math.max(scene.end - scene.start, 0),
      confidence: scene.confidence,
    })),
  }
  const transcription: VideoTranscription = {
    language: analysis.transcript.language,
    duration: analysis.metadata.duration,
    segments: analysis.transcript.segments.map((segment) => ({
      ...segment,
    })),
  }

  return {
    ...mediaItem,
    metadata: {
      filename: analysis.metadata.filename,
      duration: analysis.metadata.duration,
      width: analysis.metadata.width,
      height: analysis.metadata.height,
      fps: analysis.metadata.fps,
      codec: analysis.metadata.codec,
      bitrate: analysis.metadata.bitrate,
      file_size: analysis.metadata.fileSize,
    },
    sceneState: 'ready',
    scenes,
    sceneError: null,
    transcriptionState: 'ready',
    transcription,
    transcriptionError: null,
  }
}
