import { useState } from 'react'
import type { FormEvent } from 'react'
import { capitalizeWords } from '../utils'

type InternFormProps = {
  onSave: (payload: {
    nome: string
    faculdade: string
    dias_estagio: string
    observacoes: string
  }) => Promise<void>
}

export function InternForm({ onSave }: InternFormProps) {
  const [nome, setNome] = useState('')
  const [faculdade, setFaculdade] = useState('')
  const [diasEstagio, setDiasEstagio] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    try {
      // Capitaliza automaticamente campos de texto obrigatórios.
      await onSave({
        nome: capitalizeWords(nome),
        faculdade: capitalizeWords(faculdade),
        dias_estagio: diasEstagio,
        observacoes,
      })
      setNome('')
      setFaculdade('')
      setDiasEstagio('')
      setObservacoes('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-4 shadow-sm md:grid-cols-2">
      <input
        required
        placeholder="Nome"
        value={nome}
        onChange={(event) => setNome(event.target.value)}
        className="rounded-xl border border-slate-200 px-3 py-2"
      />
      <input
        required
        placeholder="Faculdade"
        value={faculdade}
        onChange={(event) => setFaculdade(event.target.value)}
        className="rounded-xl border border-slate-200 px-3 py-2"
      />
      <input
        required
        placeholder="Dias de estágio (ex: seg, qua, sex)"
        value={diasEstagio}
        onChange={(event) => setDiasEstagio(event.target.value)}
        className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
      />
      <textarea
        placeholder="Observações (opcional)"
        value={observacoes}
        onChange={(event) => setObservacoes(event.target.value)}
        className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60 md:col-span-2"
      >
        {loading ? 'Salvando...' : 'Adicionar estagiária'}
      </button>
    </form>
  )
}
