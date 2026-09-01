import {useEffect, useState} from 'react'

import type {Workspace} from '@/features/workspace/index.js'
import type {ApplicationServices} from '@/runtime/services.js'

export interface UseWorkspaceOptions {
  readonly cwd: string
  readonly onError?: (error: unknown) => void
  readonly readWorkspace: ApplicationServices['readWorkspace']
}

export interface UseWorkspaceResult {
  readonly error?: string
  readonly loading: boolean
  readonly workspace?: Workspace
}

export function useWorkspace({
  cwd,
  onError,
  readWorkspace,
}: UseWorkspaceOptions): UseWorkspaceResult {
  const [workspace, setWorkspace] = useState<Workspace>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(undefined)

    void readWorkspace(cwd)
      .then((nextWorkspace) => {
        if (active) setWorkspace(nextWorkspace)
      })
      .catch((caught: unknown) => {
        if (active) {
          setWorkspace(undefined)
          setError(caught instanceof Error ? caught.message : String(caught))
          onError?.(caught)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [cwd, onError, readWorkspace])

  return {error, loading, workspace}
}
