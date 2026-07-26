import { useEffect, useRef } from 'react'
import type { MediaItem } from '../types'
import type { ProjectAnalysis, ProjectAnalysisState } from './models'
import { ProjectAnalysisPipeline } from './ProjectAnalysisPipeline'

type UseProjectAnalysisPipelineOptions = Readonly<{
  sourceAssetId: string | null
  primaryItem: MediaItem | null
  analysis: ProjectAnalysisState
  onStart: (sourceAssetId: string) => void
  onComplete: (
    sourceAssetId: string,
    analysis: ProjectAnalysis,
  ) => void
  onFail: (sourceAssetId: string, message: string) => void
}>

type ActiveAnalysisRequest = {
  sourceAssetId: string
  controller: AbortController
}

export function useProjectAnalysisPipeline({
  sourceAssetId,
  primaryItem,
  analysis,
  onStart,
  onComplete,
  onFail,
}: UseProjectAnalysisPipelineOptions) {
  const pipelineRef = useRef(new ProjectAnalysisPipeline())
  const activeRequestRef = useRef<ActiveAnalysisRequest | null>(null)
  const lastFailedMediaItemIdRef = useRef<string | null>(null)

  useEffect(() => {
    const file = primaryItem?.file

    const primaryMediaItemId = primaryItem?.id ?? null
    const hasCompletedAnalysis = analysis.sourceAssetId === sourceAssetId &&
      analysis.status === 'completed'
    const hasActiveRequest = activeRequestRef.current?.sourceAssetId === sourceAssetId
    const failedForCurrentFile = analysis.sourceAssetId === sourceAssetId &&
      analysis.status === 'failed' &&
      lastFailedMediaItemIdRef.current === primaryMediaItemId

    if (!sourceAssetId || !file || hasCompletedAnalysis || hasActiveRequest || failedForCurrentFile) {
      return
    }

    const controller = new AbortController()
    const request = {
      sourceAssetId,
      controller,
    }

    activeRequestRef.current = request
    onStart(sourceAssetId)

    void pipelineRef.current.run(
      {
        sourceAssetId,
        file,
      },
      controller.signal,
    )
      .then((result) => {
        if (
          !controller.signal.aborted &&
          activeRequestRef.current === request
        ) {
          onComplete(sourceAssetId, result)
        }
      })
      .catch((error: unknown) => {
        if (
          !controller.signal.aborted &&
          activeRequestRef.current === request
        ) {
          lastFailedMediaItemIdRef.current = primaryMediaItemId
          onFail(
            sourceAssetId,
            error instanceof Error ? error.message : 'Analysis failed',
          )
        }
      })
      .finally(() => {
        if (activeRequestRef.current === request) {
          activeRequestRef.current = null
        }
      })

  }, [
    analysis.sourceAssetId,
    analysis.status,
    onComplete,
    onFail,
    onStart,
    primaryItem?.file,
    primaryItem?.id,
    sourceAssetId,
  ])

  useEffect(() => () => {
    activeRequestRef.current?.controller.abort()
    activeRequestRef.current = null
  }, [
    primaryItem?.id,
    sourceAssetId,
  ])
}
