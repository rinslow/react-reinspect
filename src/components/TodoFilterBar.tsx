import type { TodoFilter } from './types'

interface TodoFilterBarProps {
  filter: TodoFilter
  onFilterChange: (nextFilter: TodoFilter) => void
  counts: {
    all: number
    active: number
    completed: number
  }
}

const FILTER_ORDER: TodoFilter[] = ['all', 'active', 'completed']

export function TodoFilterBar({
  filter,
  onFilterChange,
  counts,
}: TodoFilterBarProps) {
  return (
    <div className="todo-filter-bar" role="toolbar" aria-label="Todo filters">
      {FILTER_ORDER.map((filterName) => (
        <button
          key={filterName}
          type="button"
          data-state={filterName === filter ? 'active' : 'idle'}
          onClick={() => onFilterChange(filterName)}
        >
          <span>{filterName}</span>
          <strong>{counts[filterName]}</strong>
        </button>
      ))}
    </div>
  )
}
