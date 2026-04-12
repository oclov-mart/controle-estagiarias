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
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <input required placeholder="Nome" value={nome} onChange={(event) => setNome(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base" />
      <input required placeholder="Faculdade" value={faculdade} onChange={(event) => setFaculdade(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base" />
      <input required placeholder="Dias de estágio (ex: seg, qua, sex)" value={diasEstagio} onChange={(event) => setDiasEstagio(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base md:col-span-2" />
      <textarea placeholder="Observações (opcional)" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-base md:col-span-2" />
      <button type="submit" disabled={loading} className="min-h-12 rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-60 md:col-span-2">
        {loading ? 'Salvando...' : '+ Adicionar estagiária'}
      </button>
    </form>
  )
}
