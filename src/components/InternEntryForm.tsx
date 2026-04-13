import { useState } from 'react'
import type { FormEvent } from 'react'
import { capitalizeWords } from '../utils'

type InternEntryFormProps = {
  onSave: (payload: {
    nome: string
    email: string
    telefone: string
    faculdade: string
    dias_estagio: string
    observacoes: string
  }) => Promise<void>
}

export function InternEntryForm({ onSave }: InternEntryFormProps) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
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
        email: email.trim(),
        telefone: telefone.trim(),
        faculdade: capitalizeWords(faculdade),
        dias_estagio: diasEstagio.trim(),
        observacoes,
      })
      setNome('')
      setEmail('')
      setTelefone('')
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
      <input type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base" />
      <input placeholder="Telefone" value={telefone} onChange={(event) => setTelefone(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base" />
      <input required placeholder="Faculdade" value={faculdade} onChange={(event) => setFaculdade(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base" />
      <input required placeholder="Dias de estagio (ex: seg, qua, sex)" value={diasEstagio} onChange={(event) => setDiasEstagio(event.target.value)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base md:col-span-2" />
      <textarea placeholder="Observacoes (opcional)" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} className="min-h-24 rounded-2xl border border-slate-200 px-4 py-3 text-base md:col-span-2" />
      <button type="submit" disabled={loading} className="min-h-12 rounded-2xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-sm disabled:opacity-60 md:col-span-2">
        {loading ? 'Salvando...' : '+ Adicionar estagiaria'}
      </button>
    </form>
  )
}
