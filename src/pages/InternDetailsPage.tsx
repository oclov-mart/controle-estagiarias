import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { MonthlyCalendar } from '../components/MonthlyCalendar'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Estagiaria, Formacao, Registro } from '../types'
import {
  capitalizeWords,
  formatDate,
  formatMinutes,
  getEffectiveRegistros,
  getInitialLetter,
  getStatusPrazo,
  normalizeEstagiaria,
  parseDurationToMinutes,
  statusLabel,
  validateDateFlow,
} from '../utils'

const selectFields =
  'id, user_id, nome, email, telefone, faculdade, dias_estagio, observacoes, data_recebimento, data_limite, data_devolucao, registros, formacoes, created_at, updated_at'

type SectionKey = 'info' | 'assiduidade' | 'documentos'

type AccordionSectionProps = {
  title: string
  subtitle: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}

function sortRegistros(registros: Registro[]): Registro[] {
  return [...registros].sort((a, b) => a.day.localeCompare(b.day))
}

function Chevron({ isOpen }: { isOpen: boolean }) {
  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
      ˅
    </span>
  )
}

function AccordionSection({ title, subtitle, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5 sm:py-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        </div>
        <Chevron isOpen={isOpen} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function DiagnosticCard({ presencas, faltas }: { presencas: number; faltas: number }) {
  const total = presencas + faltas
  const percentPresencas = total === 0 ? 0 : Math.round((presencas / total) * 100)
  const percentFaltas = total === 0 ? 0 : 100 - percentPresencas

  let title = 'Aguardando histórico'
  let description = 'Ainda não há registros suficientes para gerar uma leitura confiável da assiduidade.'

  if (total > 0 && percentPresencas >= 90) {
    title = 'Assiduidade excelente'
    description = 'A frequência está muito consistente e o histórico mostra boa regularidade.'
  } else if (total > 0 && percentPresencas >= 75) {
    title = 'Assiduidade estável'
    description = 'A frequência está dentro do esperado, mas vale acompanhar para evitar quedas.'
  } else if (total > 0 && percentPresencas >= 60) {
    title = 'Atenção: frequência abaixo do esperado'
    description = 'O histórico já mostra um volume relevante de faltas e merece acompanhamento mais próximo.'
  } else if (total > 0) {
    title = 'Este(a) estagiário(a) possui muitas faltas'
    description = 'O percentual de faltas está alto e pede ação rápida para entender causas e recorrência.'
  }

  const pieStyle = {
    background: total === 0 ? 'conic-gradient(#e2e8f0 0deg 360deg)' : `conic-gradient(#10b981 0deg ${percentPresencas * 3.6}deg, #ef4444 ${percentPresencas * 3.6}deg 360deg)`,
  }

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Diagnóstico</p>
          <h2 className="text-2xl font-semibold text-slate-900">Leitura automática da assiduidade</h2>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
          <div className="flex flex-wrap gap-3 pt-2 text-sm font-medium">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">Presenças: {presencas}</span>
            <span className="rounded-full bg-red-50 px-3 py-2 text-red-700">Faltas: {faltas}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="relative h-44 w-44 rounded-full" style={pieStyle}>
            <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-center shadow-inner">
              <div>
                <p className="text-3xl font-semibold text-slate-900">{percentPresencas}%</p>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Presença</p>
              </div>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">Faltas: {percentFaltas}%</p>
        </div>
      </div>
    </section>
  )
}

function HoursExtraCard({ registros }: { registros: Registro[] }) {
  const monthlyData = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const totals = Array.from({ length: 12 }, (_, index) => ({
      label: new Date(currentYear, index, 1).toLocaleDateString('pt-BR', { month: 'short' }),
      minutes: 0,
    }))

    registros.forEach((registro) => {
      if (registro.tipo !== 'presenca') return
      const monthIndex = new Date(`${registro.day}T00:00:00`).getMonth()
      totals[monthIndex].minutes += parseDurationToMinutes(registro.hora_extra)
    })

    return totals
  }, [registros])

  const totalMinutes = monthlyData.reduce((sum, item) => sum + item.minutes, 0)
  const maxMinutes = Math.max(...monthlyData.map((item) => item.minutes), 1)

  return (
    <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Horas extras</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">{formatMinutes(totalMinutes)}</h3>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700">Acumulado</span>
      </div>

      <div className="mt-5 flex h-40 items-end gap-2">
        {monthlyData.map((item) => (
          <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-28 w-full items-end rounded-full bg-slate-100 px-1 py-1">
              <div
                className="w-full rounded-full bg-sky-500 transition-all"
                style={{ height: `${item.minutes === 0 ? 8 : Math.max((item.minutes / maxMinutes) * 100, 12)}%` }}
              />
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{item.label}</span>
          </div>
        ))}
      </div>
    </aside>
  )
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
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    info: true,
    assiduidade: true,
    documentos: false,
  })
  const [newFormacao, setNewFormacao] = useState<{ nome: string; data: string; presente: boolean }>({
    nome: '',
    data: '',
    presente: true,
  })

  async function fetchOne() {
    if (!id) return
    setLoading(true)
    setError('')
    const { data, error: dbError } = await supabase.from('estagiarias').select(selectFields).eq('id', id).single()

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
        { event: '*', schema: 'public', table: 'estagiarias', filter: `user_id=eq.${session.user.id}` },
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

  const status = useMemo(() => getStatusPrazo(item?.data_limite ?? null, item?.data_devolucao ?? null), [item?.data_devolucao, item?.data_limite])

  const formacaoDays = useMemo(() => Array.from(new Set((item?.formacoes ?? []).map((formacao) => formacao.data).filter(Boolean))).sort(), [item?.formacoes])

  const diagnostico = useMemo(() => {
    const registros = item ? getEffectiveRegistros(item) : []
    return registros.reduce(
      (acc, registro) => {
        if (registro.tipo === 'presenca') acc.presencas += 1
        if (registro.tipo === 'falta') acc.faltas += 1
        return acc
      },
      { presencas: 0, faltas: 0 },
    )
  }, [item])

  async function saveRegistro(registro: Registro) {
    if (!item || formacaoDays.includes(registro.day)) return
    const base = item.registros?.filter((current) => current.day !== registro.day) ?? []
    await patch({ registros: sortRegistros([...base, registro]) })
  }

  async function removeRegistro(day: string) {
    if (!item || formacaoDays.includes(day)) return
    const next = (item.registros ?? []).filter((registro) => registro.day !== day)
    await patch({ registros: sortRegistros(next) })
  }

  async function saveManyRegistros(days: string[], draft: Omit<Registro, 'day'>) {
    if (!item || days.length === 0) return
    const registrosMap = new Map((item.registros ?? []).map((registro) => [registro.day, registro]))

    days.forEach((day) => {
      if (!formacaoDays.includes(day)) {
        registrosMap.set(day, { day, tipo: draft.tipo ?? 'presenca', motivo: draft.motivo ?? null, atestado_medico: draft.atestado_medico ?? false, hora_entrada: draft.hora_entrada ?? null, hora_saida: draft.hora_saida ?? null, hora_extra: draft.hora_extra ?? null, anexo_atestado: draft.anexo_atestado ?? null })
      }
    })

    await patch({ registros: sortRegistros(Array.from(registrosMap.values())) })
    setFeedback(`${days.length} dias atualizados com sucesso.`)
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

  function toggleSection(section: SectionKey) {
    setOpenSections((current) => ({ ...current, [section]: !current[section] }))
  }

  if (loading) {
    return <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">Carregando...</main>
  }

  if (!item) {
    return (
      <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
        <p className="text-red-600">{error || 'Registro não encontrado.'}</p>
        <Link to="/" className="mt-3 inline-flex min-h-11 items-center rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
          Voltar
        </Link>
      </main>
    )
  }

  const avatarLetter = getInitialLetter(item.nome)

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:space-y-6 sm:px-5 sm:py-6 lg:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          Voltar
        </Link>
        <button onClick={removeIntern} type="button" className="min-h-12 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
          Excluir estagiária
        </button>
      </div>

      <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-2xl font-semibold text-white sm:h-20 sm:w-20 sm:text-3xl">{avatarLetter}</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Perfil</p>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{item.nome || 'Sem nome'}</h1>
              <p className="mt-1 text-sm text-slate-600">{item.faculdade || 'Faculdade não informada'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">Dias: {item.dias_estagio || '-'}</span>
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${status === 'atrasado' ? 'bg-red-50 text-red-700' : status === 'em_risco' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
              {statusLabel(status)}
            </span>
          </div>
        </div>
      </section>

      <AccordionSection title="Informações da Estagiária" subtitle="Dados principais." isOpen={openSections.info} onToggle={() => toggleSection('info')}>
        <div className="space-y-5">
          <div className="flex items-center gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-xl font-semibold text-white">{avatarLetter}</div>
            <div>
              <p className="text-lg font-semibold text-slate-900">{item.nome || 'Sem nome'}</p>
              <p className="text-sm text-slate-600">{item.faculdade || 'Faculdade não informada'}</p>
              <p className="text-sm text-slate-500">Dias de estágio: {item.dias_estagio || '-'}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">Nome
              <input value={item.nome} onChange={(event) => setItem((prev) => (prev ? { ...prev, nome: event.target.value } : prev))} onBlur={() => patch({ nome: capitalizeWords(item.nome) })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">E-mail
              <input value={item.email ?? ''} onChange={(event) => setItem((prev) => (prev ? { ...prev, email: event.target.value } : prev))} onBlur={(event) => patch({ email: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">Telefone
              <input value={item.telefone ?? ''} onChange={(event) => setItem((prev) => (prev ? { ...prev, telefone: event.target.value } : prev))} onBlur={(event) => patch({ telefone: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">Faculdade
              <input value={item.faculdade} onChange={(event) => setItem((prev) => (prev ? { ...prev, faculdade: event.target.value } : prev))} onBlur={() => patch({ faculdade: capitalizeWords(item.faculdade) })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">Dias de estágio
              <input value={item.dias_estagio} onChange={(event) => setItem((prev) => (prev ? { ...prev, dias_estagio: event.target.value } : prev))} onBlur={() => patch({ dias_estagio: item.dias_estagio })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base lg:col-span-2" />
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">Observações
            <textarea value={item.observacoes ?? ''} onChange={(event) => setItem((prev) => (prev ? { ...prev, observacoes: event.target.value } : prev))} onBlur={(event) => patch({ observacoes: event.target.value || null })} className="mt-1 min-h-32 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
          </label>
        </div>
      </AccordionSection>

      <AccordionSection title="Assiduidade" subtitle="Controle mensal." isOpen={openSections.assiduidade} onToggle={() => toggleSection('assiduidade')}>
        <div className="space-y-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start">
            <MonthlyCalendar registros={item.registros ?? []} formacaoDays={formacaoDays} onSaveRegistro={saveRegistro} onRemoveRegistro={removeRegistro} onSaveManyRegistros={saveManyRegistros} />
            <HoursExtraCard registros={item.registros ?? []} />
          </div>

          <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Formações</h3>
                <p className="text-sm text-slate-600">Ao cadastrar uma formação, o dia correspondente fica marcado automaticamente no calendário e deixa de aceitar edição manual.</p>
              </div>
              <span className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">{formacaoDays.length} dia(s) de formação</span>
            </div>

            <form onSubmit={addFormacao} className="mt-4 grid gap-3 lg:grid-cols-5">
              <input required value={newFormacao.nome} onChange={(event) => setNewFormacao((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Nome da formação" className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base lg:col-span-2" />
              <input required type="date" value={newFormacao.data} onChange={(event) => setNewFormacao((prev) => ({ ...prev, data: event.target.value }))} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-base" />
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={newFormacao.presente} onChange={() => setNewFormacao((prev) => ({ ...prev, presente: true }))} />
                Presente
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={!newFormacao.presente} onChange={() => setNewFormacao((prev) => ({ ...prev, presente: false }))} />
                Ausente
              </label>
              <button className="min-h-12 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white lg:col-span-5" type="submit">Adicionar formação</button>
            </form>

            <div className="mt-4 space-y-3">
              {(item.formacoes ?? []).map((formacao, index) => (
                <div key={`${formacao.nome}-${formacao.data}-${index}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{formacao.nome}</p>
                      <p className="text-sm text-slate-600">{formatDate(formacao.data)}</p>
                    </div>
                    <span className="rounded-full bg-violet-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Formação</span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={formacao.presente} onChange={() => togglePresenca(index, true)} />Presente</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={!formacao.presente} onChange={() => togglePresenca(index, false)} />Ausente</label>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </AccordionSection>

      <AccordionSection title="Documentos" subtitle="Datas principais." isOpen={openSections.documentos} onToggle={() => toggleSection('documentos')}>
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">Recebimento
              <input type="date" value={item.data_recebimento ?? ''} onChange={(event) => patch({ data_recebimento: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">Data limite
              <input type="date" value={item.data_limite ?? ''} onChange={(event) => patch({ data_limite: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">Devolução
              <input type="date" value={item.data_devolucao ?? ''} onChange={(event) => patch({ data_devolucao: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">Recebimento: {formatDate(item.data_recebimento)} | Limite: {formatDate(item.data_limite)} | Devolução: {formatDate(item.data_devolucao)}</div>
        </div>
      </AccordionSection>

      <DiagnosticCard presencas={diagnostico.presencas} faltas={diagnostico.faltas} />

      {saving ? <p className="text-sm text-slate-600">Salvando...</p> : null}
      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {feedback ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p> : null}
    </main>
  )
}
