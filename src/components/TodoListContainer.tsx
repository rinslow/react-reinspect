import type { ReactNode } from 'react'

interface TodoListContainerProps {
  visibleCount: number
  emptyLabel: string
  children: ReactNode
}

export function TodoListContainer({
  visibleCount,
  emptyLabel,
  children,
}: TodoListContainerProps) {
  return (
    <section className="todo-list-container">
      <header>
        <h2>Visible tasks</h2>
        <span>{visibleCount}</span>
      </header>
      <div className="todo-list-body">
        {visibleCount === 0 ? <p className="todo-empty">{emptyLabel}</p> : children}
      </div>
    </section>
  )
}
