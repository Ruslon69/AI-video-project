import type { ChangeEvent } from 'react'
import type {
  EditingStage,
  MediaFileRejection,
  MediaItem,
  ProjectOutputSettings,
  ProjectStats,
  TargetAspectRatio,
  TargetPlatform,
} from '../../types'
import type { ProjectAsset } from '../../models/Project'
import {
  customAspectRatioOptions,
  targetDurationOptions,
  targetPlatformOptions,
} from '../../utils/projectSettings'
import { EditingStageList } from './EditingStageList'
import { MediaLibraryList } from './MediaLibraryList'
import type { MediaLibraryAssetPresentation } from '../../selectors/mediaAssetSelectors'
import type { ProjectAnalysisState } from '../../analysis/models'
import { ProjectAnalysisStatus } from './ProjectAnalysisStatus'

type ProjectSidebarProps = {
  stages: EditingStage[]
  selectedStageId: string
  selectedSubstageId: string
  expandedStageIds: string[]
  mediaItems: MediaItem[]
  activeMediaItemId: string | null
  primaryAsset: ProjectAsset | null
  referenceAsset: ProjectAsset | null
  primaryMediaItemId: string | null
  referenceMediaItemId: string | null
  primaryCandidateItemIds: string[]
  referenceCandidateItemIds: string[]
  analysis: ProjectAnalysisState
  isPrimarySourceConnecting: boolean
  primarySourceError: string | null
  assetPresentations: Record<string, MediaLibraryAssetPresentation>
  fileRejections: MediaFileRejection[]
  outputSettings: ProjectOutputSettings
  stats: ProjectStats
  openHelpId: string | null
  onFilesAdd: (files: FileList) => void
  onMediaSelect: (itemId: string) => void
  onPrimaryMediaChoose: (itemId: string) => void
  onReferenceMediaChoose: (itemId: string) => void
  onMediaRemove: (itemId: string) => void
  onMediaClear: () => void
  onOutputSettingsChange: (settings: ProjectOutputSettings) => void
  onStageSelect: (stageId: string, substageId?: string) => void
  onStageToggle: (stageId: string) => void
  onHelpOpenChange: (helpId: string, isOpen: boolean) => void
}

export function ProjectSidebar({
  stages,
  selectedStageId,
  selectedSubstageId,
  expandedStageIds,
  mediaItems,
  activeMediaItemId,
  primaryAsset,
  referenceAsset,
  primaryMediaItemId,
  referenceMediaItemId,
  primaryCandidateItemIds,
  referenceCandidateItemIds,
  analysis,
  isPrimarySourceConnecting,
  primarySourceError,
  assetPresentations,
  fileRejections,
  outputSettings,
  stats,
  openHelpId,
  onFilesAdd,
  onMediaSelect,
  onPrimaryMediaChoose,
  onReferenceMediaChoose,
  onMediaRemove,
  onMediaClear,
  onOutputSettingsChange,
  onStageSelect,
  onStageToggle,
  onHelpOpenChange,
}: ProjectSidebarProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files

    if (files) {
      onFilesAdd(files)
    }

    event.target.value = ''
  }

  const handleClearLibrary = () => {
    if (
      mediaItems.length > 0 &&
      window.confirm('Очистить всю медиатеку проекта?')
    ) {
      onMediaClear()
    }
  }

  const handleTargetDurationChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onOutputSettingsChange({
      ...outputSettings,
      duration: Number(event.target.value) as ProjectOutputSettings['duration'],
    })
  }

  const handlePlatformChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onOutputSettingsChange({
      ...outputSettings,
      platform: event.target.value as TargetPlatform,
    })
  }

  const handleAspectRatioChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onOutputSettingsChange({
      ...outputSettings,
      aspectRatio: event.target.value as TargetAspectRatio,
    })
  }

  return (
    <aside className="panel project-sidebar" aria-label="Проект">
      <section className="project-card">
        <p className="section-label">Проект</p>
        <h2>Мой первый ролик</h2>
        <p className="project-format">
          TikTok · Reels · YouTube Shorts · до 10 минут
        </p>
        <div className="project-settings-grid">
          <label className="project-setting" htmlFor="target-output-duration">
            <span>Целевая длительность</span>
            <select
              id="target-output-duration"
              value={outputSettings.duration}
              onChange={handleTargetDurationChange}
            >
              {targetDurationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="project-setting" htmlFor="target-platform">
            <span>Платформа</span>
            <select
              id="target-platform"
              value={outputSettings.platform}
              onChange={handlePlatformChange}
            >
              {targetPlatformOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="project-setting" htmlFor="target-aspect-ratio">
            <span>Соотношение сторон</span>
            <select
              id="target-aspect-ratio"
              value={outputSettings.aspectRatio}
              onChange={handleAspectRatioChange}
              disabled={outputSettings.platform !== 'custom'}
            >
              {customAspectRatioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="project-output-summary">
            {outputSettings.resolution.width} x {outputSettings.resolution.height} ·{' '}
            {outputSettings.container} · {outputSettings.videoCodec} ·{' '}
            {outputSettings.audioCodec}
          </p>
        </div>
        <div className="progress-block" aria-label="Общий прогресс проекта">
          <div className="progress-line">
            <span>Прогресс</span>
            <strong>{stats.progress}%</strong>
          </div>
          <div className="progress-track">
            <span style={{ width: `${stats.progress}%` }} />
          </div>
          <p className="progress-meta">
            Принято этапов: {stats.approvedStages} из {stats.totalStages}
          </p>
          <p className="progress-meta">
            Подэтапов: {stats.approvedSubstages} из {stats.totalSubstages}
          </p>
        </div>
        <div className="project-media-roles" aria-label="Project video roles">
          <div className="project-media-role">
            <span>Main video</span>
            <strong>{primaryAsset?.filename ?? 'Not selected'}</strong>
            <small>
              {primaryMediaItemId
                ? 'The only source used by the edit timeline.'
                : 'Choose the video you want to edit.'}
            </small>
          </div>
          <div className="project-media-role">
            <span>Editing reference</span>
            <strong>{referenceAsset?.filename ?? 'Optional'}</strong>
            <small>
              Used to learn the editing style. It will not be added to the timeline.
            </small>
          </div>
        </div>
        {primarySourceError ? (
          <p className="project-media-role-error" role="alert">
            {primarySourceError}
          </p>
        ) : null}
        <ProjectAnalysisStatus analysis={analysis} />
        <button
          type="button"
          className="upload-button"
          disabled={isPrimarySourceConnecting}
          onClick={() => document.getElementById('media-upload')?.click()}
        >
          {isPrimarySourceConnecting
            ? 'Connecting main video...'
            : primaryMediaItemId
            ? referenceMediaItemId
              ? 'Import another video'
              : 'Add reference'
            : 'Choose main video'}
        </button>
        <input
          className="visually-hidden"
          id="media-upload"
          type="file"
          accept="video/*,video/quicktime,.mov,image/*,audio/*"
          multiple
          disabled={isPrimarySourceConnecting}
          onChange={handleFileChange}
          aria-label="Выбрать медиафайлы"
        />
        {fileRejections.length > 0 ? (
          <div className="upload-rejections" role="status" aria-live="polite">
            {fileRejections.map((rejection) => (
              <p key={`${rejection.filename}-${rejection.reason}`}>
                {rejection.filename}: {rejection.reason}
              </p>
            ))}
          </div>
        ) : null}
        <div className="media-library-head">
          <p className="section-label">Медиатека</p>
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={handleClearLibrary}
            disabled={
              mediaItems.length === 0 ||
              Boolean(primaryMediaItemId || referenceMediaItemId)
            }
            title={
              primaryMediaItemId || referenceMediaItemId
                ? 'Assigned project videos cannot be cleared'
                : undefined
            }
          >
            Очистить
          </button>
        </div>
        <MediaLibraryList
          items={mediaItems}
          activeItemId={activeMediaItemId}
          primaryMediaItemId={primaryMediaItemId}
          referenceMediaItemId={referenceMediaItemId}
          primaryCandidateItemIds={primaryCandidateItemIds}
          referenceCandidateItemIds={referenceCandidateItemIds}
          assetPresentations={assetPresentations}
          onSelect={onMediaSelect}
          onPrimaryChoose={onPrimaryMediaChoose}
          onReferenceChoose={onReferenceMediaChoose}
          onRemove={onMediaRemove}
        />
      </section>

      <section>
        <p className="section-label">Этапы монтажа</p>
        <EditingStageList
          stages={stages}
          selectedStageId={selectedStageId}
          selectedSubstageId={selectedSubstageId}
          expandedStageIds={expandedStageIds}
          openHelpId={openHelpId}
          onStageSelect={onStageSelect}
          onStageToggle={onStageToggle}
          onHelpOpenChange={onHelpOpenChange}
        />
      </section>
    </aside>
  )
}
