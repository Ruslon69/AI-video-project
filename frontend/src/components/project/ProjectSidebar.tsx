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
  analysis: ProjectAnalysisState
  isPrimarySourceAvailable: boolean
  onAnalysisRetry: () => void
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
  onSwapPrimaryAndReference: () => void
  onClearReference: () => void
  onReconnectMedia: () => void
  onMediaRemove: (itemId: string) => void
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
  analysis,
  isPrimarySourceAvailable,
  onAnalysisRetry,
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
  onSwapPrimaryAndReference,
  onClearReference,
  onReconnectMedia,
  onMediaRemove,
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
        <div className="project-media-roles" aria-label="Роли видео проекта">
          <div className="project-media-role">
            <span>Главное видео</span>
            <strong>{primaryAsset?.filename ?? 'Не выбрано'}</strong>
            <small>
              {primaryMediaItemId
                ? 'Единственный источник для таймлайна.'
                : 'Выберите видео, которое хотите смонтировать.'}
            </small>
          </div>
          <div className="project-media-role">
            <span>Пример монтажа</span>
            <strong>{referenceAsset?.filename ?? 'Не выбран'}</strong>
            <small>
              Помогает изучить стиль монтажа. Не добавляется на таймлайн.
            </small>
          </div>
        </div>
        {primaryMediaItemId && referenceMediaItemId ? (
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={onSwapPrimaryAndReference}
          >
            Поменять местами
          </button>
        ) : null}
        {primarySourceError ? (
          <p className="project-media-role-error" role="alert">
            {primarySourceError}
          </p>
        ) : null}
        <ProjectAnalysisStatus
          analysis={analysis}
          isSourceAvailable={isPrimarySourceAvailable}
          onRetry={onAnalysisRetry}
        />
        <button
          type="button"
          className="upload-button"
          disabled={isPrimarySourceConnecting}
          onClick={() => document.getElementById('media-upload')?.click()}
        >
          {isPrimarySourceConnecting
            ? 'Подключаем видео...'
            : primaryMediaItemId
              ? 'Добавить видео'
              : 'Выбрать главное видео'}
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
        </div>
        <MediaLibraryList
          items={mediaItems}
          activeItemId={activeMediaItemId}
          primaryMediaItemId={primaryMediaItemId}
          referenceMediaItemId={referenceMediaItemId}
          assetPresentations={assetPresentations}
          onSelect={onMediaSelect}
          onPrimaryChoose={onPrimaryMediaChoose}
          onReferenceChoose={onReferenceMediaChoose}
          onSwapPrimaryAndReference={onSwapPrimaryAndReference}
          onClearReference={onClearReference}
          onReconnect={onReconnectMedia}
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
