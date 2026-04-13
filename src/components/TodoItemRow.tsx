import type { TodoItem } from './types'

interface TodoItemRowProps {
  todo: TodoItem
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export function TodoItemRow({ todo, onToggle, onDelete }: TodoItemRowProps) {
  return (
    <article className={`todo-item-row ${todo.completed ? 'is-complete' : ''}`}>
      <label>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
        />
        <span>{todo.text}</span>
      </label>
      <button type="button" onClick={() => onDelete(todo.id)}>
        Delete
      </button>
    </article>
  )
}
