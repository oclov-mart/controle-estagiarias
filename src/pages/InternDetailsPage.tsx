import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MonthlyCalendar } from '../components/MonthlyCalendar'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Estagiaria, Formacao, Registro } from '../types'
import {
  capitalizeWords,
  formatDate,
  getStatusPrazo,
  normalizeEstagiaria,
  statusLabel,
  validateDateFlow,
} from '../utils'

const selectFields =
  'id, user_id, nome, faculdade, dias_estagio, observacoes, data_recebimento, data_limite, data_devolucao, registros, formacoes, created_at, updated_at'

function sortRegistros(registros: Registro[]): Registro[] {
  return [...registros].sort((a, b) => a.day.localeCompare(b.day))
}

export function InternDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [item, setItem] = useState<Estagiaria | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [newFormacao, setNewFormacao] = useState<{ nome: string; data: string; presente: boolean }>({
    nome: '',
    data: '',
    presente: true,
  })

  async function fetchOne() {
    if (!id) return
    setLoading(true)
    setError('')
    const { data, error: dbError } = await supabase
      .from('estagiarias')
      .select(selectFields)
      .eq('id', id)
      .single()

    if (dbError) {
      setError('Não foi possível carregar os detalhes.')
      setLoading(false)
      return
    }
    setItem(normalizeEstagiaria(data as Estagiaria))
    setLoading(false)
  }

  useEffect(() => {
    fetchOne()
  }, [id])

  useEffect(() => {
    if (!session?.user.id || !id) return
    const channel = supabase
      .channel(`estagiaria-details-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estagiarias',
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const rowId = (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id
          if (rowId === id) fetchOne()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, session?.user.id])

  async function patch(updates: Partial<Estagiaria>) {
    if (!item) return
    setSaving(true)
    setError('')
    setFeedback('')

    const nextDates = {
      data_recebimento: updates.data_recebimento ?? item.data_recebimento,
      data_limite: updates.data_limite ?? item.data_limite,
      data_devolucao: updates.data_devolucao ?? item.data_devolucao,
    }
    const dateError = validateDateFlow(nextDates)
    if (dateError) {
      setSaving(false)
      setError(dateError)
      return
    }

    const { error: updateError } = await supabase.from('estagiarias').update(updates).eq('id', item.id)
    setSaving(false)
    if (updateError) {
      setError('Falha ao salvar alteração.')
      return
    }
    setFeedback('Alteração salva.')
    await fetchOne()
  }

  async function removeIntern() {
    if (!item) return
    const ok = window.confirm(`Excluir ${item.nome}?`)
    if (!ok) return
    const { error: deleteError } = await supabase.from('estagiarias').delete().eq('id', item.id)
    if (deleteError) {
      setError('Não foi possível excluir.')
      return
    }
    navigate('/')
  }

  const status = useMemo(
    () => getStatusPrazo(item?.data_limite ?? null, item?.data_devolucao ?? null),
    [item?.data_devolucao, item?.data_limite],
  )

  async function saveRegistro(registro: Registro) {
    if (!item) return
    const base = item.registros?.filter((current) => current.day !== registro.day) ?? []
    await patch({ registros: sortRegistros([...base, registro]) })
  }

  async function removeRegistro(day: string) {
    if (!item) return
    const next = (item.registros ?? []).filter((registro) => registro.day !== day)
    await patch({ registros: sortRegistros(next) })
  }

  async function saveManyRegistros(days: string[], draft: Omit<Registro, 'day'>) {
    if (!item || days.length === 0) return
    const registrosMap = new Map((item.registros ?? []).map((registro) => [registro.day, registro]))

    days.forEach((day) => {
      registrosMap.set(day, { day, ...draft })
    })

    await patch({ registros: sortRegistros(Array.from(registrosMap.values())) })
  }

  async function addFormacao(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!item) return
    const payload: Formacao = {
      nome: capitalizeWords(newFormacao.nome),
      data: newFormacao.data,
      presente: newFormacao.presente,
    }
    await patch({ formacoes: [...(item.formacoes ?? []), payload] })
    setNewFormacao({ nome: '', data: '', presente: true })
  }

  async function togglePresenca(index: number, presente: boolean) {
    if (!item) return
    const next = (item.formacoes ?? []).map((formacao, i) => (i === index ? { ...formacao, presente } : formacao))
    await patch({ formacoes: next })
  }

  if (loading) {
    return <main className="mx-auto w-full max-w-5xl p-4">Carregando...</main>
  }

  if (!item) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4">
        <p className="text-red-600">{error || 'Registro não encontrado.'}</p>
        <Link to="/" className="mt-2 inline-block text-sm underline">
          Voltar
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 md:py-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm underline">
          Voltar
        </Link>
        <button onClick={removeIntern} type="button" className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white">
          Excluir
        </button>
      </div>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">{item.nome}</h1>
            <p className="text-sm text-slate-600">{item.faculdade}</p>
          </div>
          <p
            className={`text-sm font-semibold ${
              status === 'atrasado'
                ? 'text-red-700'
                : status === 'em_risco'
                  ? 'text-amber-700'
                  : 'text-emerald-700'
            }`}
          >
            {statusLabel(status)}
          </p>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Nome
            <input
              value={item.nome}
              onChange={(event) => setItem((prev) => (prev ? { ...prev, nome: event.target.value } : prev))}
              onBlur={() => patch({ nome: capitalizeWords(item.nome) })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Faculdade
            <input
              value={item.faculdade}
              onChange={(event) => setItem((prev) => (prev ? { ...prev, faculdade: event.target.value } : prev))}
              onBlur={() => patch({ faculdade: capitalizeWords(item.faculdade) })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Dias de estágio
            <input
              value={item.dias_estagio}
              onChange={(event) => setItem((prev) => (prev ? { ...prev, dias_estagio: event.target.value } : prev))}
              onBlur={() => patch({ dias_estagio: item.dias_estagio })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Documentos</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Recebimento
            <input
              type="date"
              value={item.data_recebimento ?? ''}
              onChange={(event) => patch({ data_recebimento: event.target.value || null })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Data limite
            <input
              type="date"
              value={item.data_limite ?? ''}
              onChange={(event) => patch({ data_limite: event.target.value || null })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Devolução
            <input
              type="date"
              value={item.data_devolucao ?? ''}
              onChange={(event) => patch({ data_devolucao: event.target.value || null })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Recebimento: {formatDate(item.data_recebimento)} | Limite: {formatDate(item.data_limite)} | Devolução:{' '}
          {formatDate(item.data_devolucao)}
        </p>
      </section>

      <MonthlyCalendar
        registros={item.registros ?? []}
        onSaveRegistro={saveRegistro}
        onRemoveRegistro={removeRegistro}
        onSaveManyRegistros={saveManyRegistros}
      />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Formações</h2>
        <form onSubmit={addFormacao} className="grid gap-2 md:grid-cols-5">
          <input
            required
            value={newFormacao.nome}
            onChange={(event) => setNewFormacao((prev) => ({ ...prev, nome: event.target.value }))}
            placeholder="Nome da formação"
            className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-2"
          />
          <input
            required
            type="date"
            value={newFormacao.data}
            onChange={(event) => setNewFormacao((prev) => ({ ...prev, data: event.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={newFormacao.presente}
              onChange={() => setNewFormacao((prev) => ({ ...prev, presente: true }))}
            />
            Presente
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={!newFormacao.presente}
              onChange={() => setNewFormacao((prev) => ({ ...prev, presente: false }))}
            />
            Ausente
          </label>
          <button className="rounded-xl bg-slate-900 px-4 py-2 font-medium text-white md:col-span-5" type="submit">
            Adicionar formação
          </button>
        </form>

        <div className="mt-3 space-y-2">
          {(item.formacoes ?? []).map((formacao, index) => (
            <div key={`${formacao.nome}-${formacao.data}-${index}`} className="rounded-xl border border-slate-200 p-2">
              <p className="font-medium">{formacao.nome}</p>
              <p className="text-sm text-slate-600">{formatDate(formacao.data)}</p>
              <div className="mt-1 flex gap-4 text-sm">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={formacao.presente}
                    onChange={() => togglePresenca(index, true)}
                  />
                  Presente
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={!formacao.presente}
                    onChange={() => togglePresenca(index, false)}
                  />
                  Ausente
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold">Observações</h2>
        <textarea
          value={item.observacoes ?? ''}
          onChange={(event) => setItem((prev) => (prev ? { ...prev, observacoes: event.target.value } : prev))}
          onBlur={(event) => patch({ observacoes: event.target.value || null })}
          className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      </section>

      {saving ? <p className="text-sm text-slate-600">Salvando...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
    </main>
  )
}
