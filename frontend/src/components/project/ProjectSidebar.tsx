import type { ChangeEvent } from 'react'
import type { EditingStage } from '../../types'
import type { ProjectStats } from '../../types'
import { EditingStageList } from './EditingStageList'

type ProjectSidebarProps = {
  stages: EditingStage[]
  selectedStageId: string
  selectedSubstageId: string
  expandedStageIds: string[]
  selectedFileName: string | null
  stats: ProjectStats
  openHelpId: string | null
  onFileSelect: (file: File | null) => void
  onStageSelect: (stageId: string, substageId?: string) => void
  onStageToggle: (stageId: string) => void
  onHelpOpenChange: (helpId: string, isOpen: boolean) => void
}

export function ProjectSidebar({
  stages,
  selectedStageId,
  selectedSubstageId,
  expandedStageIds,
  selectedFileName,
  stats,
  openHelpId,
  onFileSelect,
  onStageSelect,
  onStageToggle,
  onHelpOpenChange,
}: ProjectSidebarProps) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(event.target.files?.[0] ?? null)
  }

  return (
    <aside className="panel project-sidebar" aria-label="Проект">
      <section className="project-card">
        <p className="section-label">Проект</p>
        <h2>Мой первый ролик</h2>
        <p className="project-format">YouTube Shorts · 9:16</p>
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
        <label className="upload-button" htmlFor="video-upload">
          Загрузить видео
        </label>
        <input
          className="visually-hidden"
          id="video-upload"
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          aria-label="Выбрать локальный видеофайл"
        />
        {selectedFileName ? (
          <p className="selected-file">Файл: {selectedFileName}</p>
        ) : (
          <p className="selected-file muted">Видео ещё не выбрано</p>
        )}
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
