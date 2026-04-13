export type TodoFilter = 'all' | 'active' | 'completed'

export interface TodoItem {
  id: string
  text: string
  completed: boolean
}
