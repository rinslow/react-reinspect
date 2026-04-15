import { useMemo, useState } from 'react'
import { TodoAddForm } from './components/TodoAddForm'
import { TodoFilterBar } from './components/TodoFilterBar'
import { TodoHeader } from './components/TodoHeader'
import { TodoItemRow } from './components/TodoItemRow'
import { TodoListContainer } from './components/TodoListContainer'
import type { TodoFilter, TodoItem } from './components/types'
import './App.css'

function createTodoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const INITIAL_TODOS: TodoItem[] = [
  { id: createTodoId(), text: 'Outline wrapped components', completed: true },
  { id: createTodoId(), text: 'Add style override controls', completed: false },
  { id: createTodoId(), text: 'Stress-test with todo list interactions', completed: false },
]

function App() {
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS)
  const [filter, setFilter] = useState<TodoFilter>('all')

  const counts = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length
    const active = todos.length - completed
    return {
      all: todos.length,
      active,
      completed,
    }
  }, [todos])

  const visibleTodos = useMemo(() => {
    if (filter === 'active') {
      return todos.filter((todo) => !todo.completed)
    }

    if (filter === 'completed') {
      return todos.filter((todo) => todo.completed)
    }

    return todos
  }, [todos, filter])

  const addTodo = (text: string) => {
    setTodos((current) => [
      {
        id: createTodoId(),
        text,
        completed: false,
      },
      ...current,
    ])
  }

  const toggleTodo = (id: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    )
  }

  const deleteTodo = (id: string) => {
    setTodos((current) => current.filter((todo) => todo.id !== id))
  }

  return (
    <main className="todo-page">
      <section className="todo-panel">
        <TodoHeader total={counts.all} completed={counts.completed} />

        <div className="todo-controls">
          <TodoAddForm onAdd={addTodo} />
          <TodoFilterBar
            filter={filter}
            counts={counts}
            onFilterChange={setFilter}
          />
        </div>

        <TodoListContainer
          visibleCount={visibleTodos.length}
          emptyLabel={`No ${filter} tasks right now.`}
        >
          {visibleTodos.map((todo) => (
            <TodoItemRow
              key={todo.id}
              todo={todo}
              onToggle={toggleTodo}
              onDelete={deleteTodo}
            />
          ))}
        </TodoListContainer>
      </section>
    </main>
  )
}

export default App
