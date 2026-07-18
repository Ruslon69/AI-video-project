import type { EditingStage, EditingSubstage, ProjectState, StageStatus } from '../types'

const now = new Date().toISOString()

const createSubstage = (
  stageId: string,
  index: number,
  title: string,
  status: StageStatus,
): EditingSubstage => ({
  id: `${stageId}-${index + 1}`,
  title,
  status,
  comment: '',
  selectedVersionId: null,
  versions: [
    {
      id: `${stageId}-${index + 1}-v1`,
      version: 1,
      createdAt: now,
      description: 'Начальное состояние проверки',
      status,
      comment: '',
    },
  ],
})

const createStage = (
  id: string,
  title: string,
  description: string,
  substageTitles: string[],
  stageIndex: number,
): EditingStage => {
  const substages = substageTitles.map((substageTitle, substageIndex) => {
    const isFirstStage = stageIndex === 0
    const status =
      isFirstStage && substageIndex === 0
        ? 'ready'
        : isFirstStage
          ? 'blocked'
          : 'blocked'

    return createSubstage(id, substageIndex, substageTitle, status)
  })

  return {
    id,
    title,
    description,
    status: stageIndex === 0 ? 'ready' : 'blocked',
    substages,
  }
}

export const initialStages: EditingStage[] = [
  createStage(
    'upload',
    'Загрузка материала',
    'Подготовка исходного ролика и создание рабочего проекта.',
    ['Выбор видео', 'Проверка формата', 'Создание проекта'],
    0,
  ),
  createStage(
    'speech',
    'Анализ речи',
    'Расшифровка и смысловая подготовка материала к монтажу.',
    ['Извлечение аудио', 'Расшифровка', 'Поиск пауз', 'Поиск повторов', 'Смысловое разделение'],
    1,
  ),
  createStage(
    'rough-cut',
    'Черновая нарезка',
    'Первичная структура ролика без слабых фрагментов.',
    ['Удаление пауз', 'Удаление повторов', 'Создание структуры', 'Предпросмотр нарезки'],
    2,
  ),
  createStage(
    'zooms',
    'Зумы и динамика',
    'Акценты движения кадра и проверка темпа эффектов.',
    ['Анализ акцентов', 'Zoom in', 'Zoom out', 'Проверка частоты эффектов', 'Предпросмотр динамики'],
    3,
  ),
  createStage(
    'captions',
    'Текст и изображения',
    'Субтитры, ключевые слова и визуальные вставки.',
    ['Создание субтитров', 'Выделение ключевых слов', 'Текстовые вставки', 'Добавление изображений', 'Анимация графики'],
    4,
  ),
  createStage(
    'effects',
    'Звуковые эффекты',
    'Подбор и расстановка точечных звуковых акцентов.',
    ['Анализ событий', 'Подбор эффектов', 'Расстановка эффектов', 'Проверка громкости'],
    5,
  ),
  createStage(
    'music',
    'Фоновая музыка',
    'Музыкальное оформление, синхронизация и проверка лицензии.',
    ['Определение настроения', 'Подбор музыки', 'Синхронизация с монтажом', 'Ducking голоса', 'Проверка лицензии'],
    6,
  ),
  createStage(
    'export',
    'Финальный экспорт',
    'Финальная проверка и подготовка файла к публикации.',
    ['Проверка проекта', 'Выбор формата', 'Экспорт', 'Контроль качества'],
    7,
  ),
]

export const initialProjectState: ProjectState = {
  stages: initialStages,
  selectedStageId: initialStages[0].id,
  selectedSubstageId: initialStages[0].substages[0].id,
  expandedStageIds: [initialStages[0].id],
}
