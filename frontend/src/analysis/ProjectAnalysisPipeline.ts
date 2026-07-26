import type { ProjectAnalysis } from './models'
import { uploadProjectAnalysis } from '../services/api'

export type ProjectAnalysisPipelineInput = Readonly<{
  sourceAssetId: string
  file: File
}>

export class ProjectAnalysisPipeline {
  async run(
    input: ProjectAnalysisPipelineInput,
    signal?: AbortSignal,
  ): Promise<ProjectAnalysis> {
    return uploadProjectAnalysis(
      input.file,
      input.sourceAssetId,
      signal,
    )
  }
}
