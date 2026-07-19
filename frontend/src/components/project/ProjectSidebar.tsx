import type { ChangeEvent } from 'react'
import type {
  EditingStage,
  MediaItem,
  ProjectStats,
  TargetOutputDuration,
} from '../../types'
import { EditingStageList } from './EditingStageList'
import { MediaLibraryList } from './MediaLibraryList'

const targetDurationOptions: Array<{
  value: TargetOutputDuration
  label: string
}> = [
  { value: 30, label: '30 секунд' },
  { value: 60, label: '60 секунд' },
  { value: 180, label: '3 минуты' },
  { value: 300, label: '5 минут' },
  { value: 600, label: '10 минут' },
]

type ProjectSidebarProps = {
  stages: EditingStage[]
  selectedStageId: string
  selectedSubstageId: string
  expandedStageIds: string[]
  mediaItems: MediaItem[]
  activeMediaItemId: string | null
  targetOutputDuration: TargetOutputDuration
  stats: ProjectStats
  openHelpId: string | null
  onFilesAdd: (files: FileList) => void
  onMediaSelect: (itemId: string) => void
  onMediaRemove: (itemId: string) => void
  onMediaClear: () => void
  onTargetOutputDurationChange: (duration: TargetOutputDuration) => void
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
  targetOutputDuration,
  stats,
  openHelpId,
  onFilesAdd,
  onMediaSelect,
  onMediaRemove,
  onMediaClear,
  onTargetOutputDurationChange,
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
    onTargetOutputDurationChange(
      Number(event.target.value) as TargetOutputDuration,
    )
  }

  return (
    <aside className="panel project-sidebar" aria-label="Проект">
      <section className="project-card">
        <p className="section-label">Проект</p>
        <h2>Мой первый ролик</h2>
        <p className="project-format">
          TikTok · Reels · YouTube Shorts · до 10 минут
        </p>
        <label className="project-setting" htmlFor="target-output-duration">
          <span>Целевая длительность</span>
          <select
            id="target-output-duration"
            value={targetOutputDuration}
            onChange={handleTargetDurationChange}
          >
            {targetDurationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
          accept="video/*,image/*,audio/*"
          multiple
          onChange={handleFileChange}
          aria-label="Выбрать медиафайлы"
        />
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
