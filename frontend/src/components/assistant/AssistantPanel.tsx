import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { ChatMessage } from '../../types'

type AssistantPanelProps = {
  isOpen: boolean
  onClose: () => void
  draftQuestion?: string
}

const quickQuestions = [
  'Как загрузить видео?',
  'Как принять этап?',
  'Что означает заблокировано?',
  'Как откатить версию?',
]

const fallbackAnswer =
  'Я пока работаю в демонстрационном режиме. Попробуйте спросить о загрузке видео, этапах, статусах, теме или откате версии.'

function getAssistantAnswer(question: string) {
  const normalized = question.toLowerCase()

  if (normalized.includes('загруз')) {
    return 'Нажмите «Загрузить видео» в панели проекта и выберите локальный видеофайл. Сам файл не сохраняется в localStorage.'
  }

  if (normalized.includes('прин') || normalized.includes('accept')) {
    return 'Откройте нужный подэтап и нажмите «Принять подэтап». Заблокированный подэтап принять нельзя.'
  }

  if (normalized.includes('доработ')) {
    return 'Выберите подэтап, добавьте комментарий и нажмите «Отправить на доработку». В истории появится новая версия.'
  }

  if (normalized.includes('заблок')) {
    return 'Заблокировано означает, что подэтап или этап ещё недоступен. Следующий подэтап открывается после принятия текущего.'
  }

  if (normalized.includes('провер')) {
    return 'Ожидает проверки означает, что результат готов к просмотру: его можно принять, отправить на доработку или создать новую проверку.'
  }

  if (normalized.includes('тем')) {
    return 'Тему можно изменить в верхней панели: светлая, тёмная или системная. Системная тема следует настройкам устройства.'
  }

  if (normalized.includes('подэтап') || normalized.includes('раскры')) {
    return 'Нажмите стрелку рядом с основным этапом в боковой панели, чтобы раскрыть или скрыть его подэтапы.'
  }

  if (normalized.includes('откат') || normalized.includes('верси')) {
    return 'В блоке «История версий» можно просмотреть запись, восстановить её или нажать «Вернуться к предыдущей версии».'
  }

  if (normalized.includes('зачем') || normalized.includes('этап')) {
    return 'Этапы делят монтаж на понятные части: загрузка, анализ, нарезка, динамика, текст, звук, музыка и экспорт.'
  }

  if (normalized.includes('прогресс')) {
    return 'Общий прогресс и количество принятых этапов отображаются в левой панели проекта.'
  }

  return fallbackAnswer
}

export function AssistantPanel({
  isOpen,
  onClose,
  draftQuestion = '',
}: AssistantPanelProps) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Здравствуйте. Я помогу разобраться с этапами, статусами, темой и версиями.',
    },
  ])
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const panelClassName = useMemo(
    () => `assistant-panel${isOpen ? ' assistant-panel-open' : ''}`,
    [isOpen],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, isOpen])

  useEffect(() => {
    if (draftQuestion) {
      setInput(draftQuestion)
    }
  }, [draftQuestion])

  const sendQuestion = (question: string) => {
    const trimmedQuestion = question.trim()

    if (!trimmedQuestion) {
      return
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmedQuestion,
    }
    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      text: getAssistantAnswer(trimmedQuestion),
    }

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      assistantMessage,
    ])
    setInput('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    sendQuestion(input)
  }

  return (
    <aside
      className={panelClassName}
      aria-label="AI-помощник"
      aria-hidden={!isOpen}
    >
      <div className="assistant-header">
        <div>
          <p className="section-label">AI-помощник</p>
          <h2>Вопросы по проекту</h2>
        </div>
        <button
          type="button"
          className="icon-only-button"
          onClick={onClose}
          aria-label="Закрыть AI-помощник"
        >
          <CloseIcon />
        </button>
      </div>

      <div className="quick-questions" aria-label="Быстрые вопросы">
        {quickQuestions.map((question) => (
          <button
            key={question}
            type="button"
            className="quick-question"
            onClick={() => sendQuestion(question)}
          >
            {question}
          </button>
        ))}
      </div>

      <div className="assistant-messages" role="log" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className="chat-message"
            data-role={message.role}
          >
            {message.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="assistant-form" onSubmit={handleSubmit}>
        <label className="visually-hidden" htmlFor="assistant-input">
          Сообщение AI-помощнику
        </label>
        <input
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Спросите о теме, этапах или версиях"
          aria-label="Введите вопрос AI-помощнику"
        />
        <button className="primary-button" type="submit">
          Отправить
        </button>
      </form>
    </aside>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="button-icon">
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}
