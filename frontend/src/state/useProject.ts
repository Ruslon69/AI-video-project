import { useContext } from 'react'
import { ProjectContext } from './ProjectState'

export function useProject() {
  const projectContext = useContext(ProjectContext)

  if (!projectContext) {
    throw new Error('useProject must be used within ProjectProvider')
  }

  return projectContext
}
