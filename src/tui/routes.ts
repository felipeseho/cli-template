export type ScreenName = 'doctor' | 'help' | 'home' | 'task-list' | 'task-run'

export type ScreenRoute =
  | {readonly screen: 'doctor'}
  | {readonly screen: 'help'}
  | {readonly screen: 'home'}
  | {readonly screen: 'task-list'}
  | {readonly screen: 'task-run'; readonly taskName?: string}

export type InitialRoute = ScreenName | ScreenRoute

export function normalizeRoute(route: InitialRoute = 'home', initialTask?: string): ScreenRoute {
  if (typeof route !== 'string') {
    if (route.screen === 'task-run' && initialTask && !route.taskName) {
      return {screen: 'task-run', taskName: initialTask}
    }

    return route
  }

  return route === 'task-run'
    ? {screen: route, ...(initialTask ? {taskName: initialTask} : {})}
    : {screen: route}
}

export const screenLabel = (route: ScreenRoute): string => {
  switch (route.screen) {
    case 'doctor': {
      return 'Doctor'
    }
    case 'help': {
      return 'Ajuda'
    }
    case 'home': {
      return 'Início'
    }
    case 'task-list': {
      return 'Tarefas'
    }
    case 'task-run': {
      return route.taskName ? `Executar ${route.taskName}` : 'Executar tarefa'
    }
  }
}
