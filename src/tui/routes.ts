export type ScreenName = 'doctor' | 'help' | 'home' | 'task-list' | 'task-run'

export type ScreenRoute =
  | {readonly screen: 'doctor'}
  | {readonly screen: 'help'}
  | {readonly screen: 'home'}
  | {readonly screen: 'task-list'}
  | {readonly screen: 'task-run'; readonly taskName?: string}

export type InitialRoute = ScreenName | ScreenRoute

export interface RouteBreadcrumb {
  readonly label: string
  readonly route: ScreenRoute
}

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

export function routeBreadcrumbs(route: ScreenRoute): readonly RouteBreadcrumb[] {
  const home: RouteBreadcrumb = {label: 'Home', route: {screen: 'home'}}

  switch (route.screen) {
    case 'home': {
      return [home]
    }
    case 'doctor': {
      return [home, {label: 'Doctor', route: {screen: 'doctor'}}]
    }
    case 'help': {
      return [home, {label: 'Help', route: {screen: 'help'}}]
    }
    case 'task-list': {
      return [home, {label: 'Tasks', route: {screen: 'task-list'}}]
    }
    case 'task-run': {
      return [
        home,
        {label: 'Tasks', route: {screen: 'task-list'}},
        {
          label: route.taskName ?? 'Run',
          route,
        },
      ]
    }
  }
}
