import { useState, type FormEvent } from 'react'

interface TodoAddFormProps {
  onAdd: (text: string) => void
}

export function TodoAddForm({ onAdd }: TodoAddFormProps) {
  const [draft, setDraft] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmed = draft.trim()
    if (!trimmed) {
      return
    }

    onAdd(trimmed)
    setDraft('')
  }

  return (
    <form className="todo-add-form" onSubmit={handleSubmit}>
      <label htmlFor="todo-draft" className="sr-only">
        Add a task
      </label>
      <input
        id="todo-draft"
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        placeholder="Ship reinspect panel"
      />
      <button type="submit">Add</button>
    </form>
  )
}
