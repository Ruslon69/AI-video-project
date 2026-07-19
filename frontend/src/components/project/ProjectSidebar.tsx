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
import {
  customAspectRatioOptions,
  targetDurationOptions,
  targetPlatformOptions,
} from '../../utils/projectSettings'
import { EditingStageList } from './EditingStageList'
import { MediaLibraryList } from './MediaLibraryList'

type ProjectSidebarProps = {
  stages: EditingStage[]
  selectedStageId: string
  selectedSubstageId: string
  expandedStageIds: string[]
  mediaItems: MediaItem[]
  activeMediaItemId: string | null
  fileRejections: MediaFileRejection[]
  outputSettings: ProjectOutputSettings
  stats: ProjectStats
  openHelpId: string | null
  onFilesAdd: (files: FileList) => void
  onMediaSelect: (itemId: string) => void
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
  fileRejections,
  outputSettings,
  stats,
  openHelpId,
  onFilesAdd,
  onMediaSelect,
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
        <label className="upload-button" htmlFor="media-upload">
          Добавить медиа
        </label>
        <input
          className="visually-hidden"
          id="media-upload"
          type="file"
          accept="video/*,video/quicktime,.mov,image/*,audio/*"
          multiple
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
            disabled={mediaItems.length === 0}
          >
            Очистить
          </button>
        </div>
        <MediaLibraryList
          items={mediaItems}
          activeItemId={activeMediaItemId}
          onSelect={onMediaSelect}
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
