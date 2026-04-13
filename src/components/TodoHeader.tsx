interface TodoHeaderProps {
  total: number
  completed: number
}

export function TodoHeader({ total, completed }: TodoHeaderProps) {
  return (
    <header className="todo-header">
      <p className="todo-kicker">Reinspect Playground</p>
      <h1>UI Tweak Todo Board</h1>
      <p className="todo-meta">
        {completed} of {total} tasks completed
      </p>
    </header>
  )
}
