import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { InternForm } from '../components/InternForm'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Estagiaria, ReportRow } from '../types'
import {
  buildReportLink,
  buildReportRows,
  formatDate,
  formatMinutes,
  getInitialLetter,
  getMonthRangeLabel,
  getMonthlyMetrics,
  getStatusPrazo,
  normalizeEstagiaria,
  statusLabel,
} from '../utils'

type FiltroStatus = 'todas' | 'atrasado' | 'em_risco'

type ShareModalState = {
  open: boolean
  reportLink: string
  reportTitle: string
}

const selectFields =
  'id, user_id, nome, faculdade, dias_estagio, observacoes, data_recebimento, data_limite, data_devolucao, registros, formacoes, created_at, updated_at'

function getPhotoGradient(name: string): string {
  const palettes = [
    'from-sky-500 to-blue-700',
    'from-emerald-500 to-teal-700',
    'from-amber-400 to-orange-600',
    'from-rose-400 to-pink-600',
  ]
  const code = name.trim().charCodeAt(0) || 0
  return palettes[code % palettes.length]
}

async function logExport(action: string, scope: string, reportTitle: string, rowsCount: number) {
  const entry = {
    id: crypto.randomUUID(),
    action,
    scope,
    reportTitle,
    rowsCount,
    createdAt: new Date().toISOString(),
  }

  const current = JSON.parse(localStorage.getItem('export_logs') ?? '[]') as typeof entry[]
  localStorage.setItem('export_logs', JSON.stringify([entry, ...current].slice(0, 100)))

  try {
    await supabase.from('export_logs').insert({
      action,
      scope,
      report_title: reportTitle,
      rows_count: rowsCount,
    })
  } catch {
    // Mantém auditoria local quando a tabela ainda não existir no banco.
  }
}

function downloadExcel(rows: ReportRow[], reportTitle: string) {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Nome: row.nome,
      Faculdade: row.faculdade,
      'Dias de estágio': row.dias_estagio,
      Presenças: row.presencas,
      Faltas: row.faltas,
      'Horas extras': row.horas_extras,
      'Último prazo': row.ultimo_prazo,
      Status: row.status,
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório')
  XLSX.writeFile(workbook, `${reportTitle.replace(/\s+/g, '_').toLowerCase()}.xlsx`)
}

function SummaryPanel({
  items,
  selectedIds,
  referenceDate,
  onExport,
  onShare,
}: {
  items: Estagiaria[]
  selectedIds: string[]
  referenceDate: Date
  onExport: (scope: 'complete' | 'selected') => void
  onShare: () => void
}) {
  const source = selectedIds.length > 0 ? items.filter((item) => selectedIds.includes(item.id)) : items
  const totals = source.reduce(
    (acc, item) => {
      const metrics = getMonthlyMetrics(item, referenceDate)
      acc.presencas += metrics.presencas
      acc.faltas += metrics.faltas
      acc.horasExtras += metrics.horasExtras
      return acc
    },
    { presencas: 0, faltas: 0, horasExtras: 0 },
  )

  const prazos = source.filter((item) => item.data_limite && !item.data_devolucao).sort((a, b) => (a.data_limite! < b.data_limite! ? -1 : 1)).slice(0, 3)

  return (
    <aside className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6 lg:self-start">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Resumo mensal</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{getMonthRangeLabel(referenceDate)}</h2>
      <p className="mt-1 text-sm text-slate-600">Visão rápida de assiduidade, horas extras e prazos de documentos.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <div className="rounded-[24px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Presenças</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totals.presencas}</p>
        </div>
        <div className="rounded-[24px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Faltas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{totals.faltas}</p>
        </div>
        <div className="rounded-[24px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Horas extras</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatMinutes(totals.horasExtras)}</p>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Prazos de documentos</h3>
            <p className="text-sm text-slate-500">Alertas próximos para acompanhamento.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{prazos.length}</span>
        </div>

        <div className="mt-4 space-y-3">
          {prazos.length > 0 ? (
            prazos.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-900">{item.nome}</p>
                <p>Prazo: {formatDate(item.data_limite)}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Nenhum prazo pendente no momento.</p>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <button type="button" onClick={() => onExport('complete')} className="min-h-12 w-full rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
          📤 Exportar para Excel
        </button>
        <Link to="/relatorio" className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          Ver Relatório Mensal
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:fixed lg:bottom-6 lg:right-6 lg:z-30 lg:w-[320px] lg:flex-col">
        <button type="button" onClick={() => onExport('selected')} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          Somente selecionadas
        </button>
        <button type="button" onClick={onShare} className="min-h-12 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm">
          🔗 Compartilhar relatório
        </button>
      </div>
    </aside>
  )
}

function ShareModal({ state, onClose }: { state: ShareModalState; onClose: () => void }) {
  if (!state.open) return null

  const emailHref = `mailto:?subject=${encodeURIComponent(state.reportTitle)}&body=${encodeURIComponent(`Acesse o relatório online em: ${state.reportLink}`)}`
  const teamsHref = `https://teams.microsoft.com/share?href=${encodeURIComponent(state.reportLink)}&msgText=${encodeURIComponent(state.reportTitle)}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${state.reportTitle} - ${state.reportLink}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Compartilhar</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{state.reportTitle}</h3>
            <p className="mt-1 text-sm text-slate-600">Envie por e-mail, copie o link do relatório online ou compartilhe em ferramentas corporativas.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <a href={emailHref} className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            Enviar por e-mail (link do relatório)
          </a>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(state.reportLink)}
            className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700"
          >
            Copiar link de acesso ao relatório online
          </button>
          <a href={teamsHref} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            Compartilhar via Teams
          </a>
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            Compartilhar via WhatsApp corporativo
          </a>
        </div>
      </div>
    </div>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { signOut, session } = useAuth()
  const [items, setItems] = useState<Estagiaria[]>([])
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [shareModal, setShareModal] = useState<ShareModalState>({ open: false, reportLink: '', reportTitle: '' })
  const referenceDate = useMemo(() => new Date(), [])

  async function fetchData() {
    setLoading(true)
    setError('')
    const { data, error: dbError } = await supabase.from('estagiarias').select(selectFields).order('nome', { ascending: true })

    if (dbError) {
      setError('Não foi possível carregar os dados.')
      setLoading(false)
      return
    }
    setItems(((data ?? []) as Estagiaria[]).map(normalizeEstagiaria))
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!session?.user.id) return
    const channel = supabase
      .channel(`estagiarias-dashboard-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estagiarias', filter: `user_id=eq.${session.user.id}` }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user.id])

  const filtradas = useMemo(() => {
    if (filtro === 'todas') return items
    return items.filter((item) => getStatusPrazo(item.data_limite, item.data_devolucao) === filtro)
  }, [filtro, items])

  const proximoPrazo = useMemo(() => {
    const candidatas = items.filter((item) => item.data_limite && !item.data_devolucao).sort((a, b) => (a.data_limite! < b.data_limite! ? -1 : 1))
    return candidatas[0] ?? null
  }, [items])

  async function createIntern(payload: { nome: string; faculdade: string; dias_estagio: string; observacoes: string }) {
    setError('')
    const { error: insertError } = await supabase.from('estagiarias').insert({
      ...payload,
      observacoes: payload.observacoes || null,
      registros: [],
      formacoes: [],
    })
    if (insertError) {
      setError('Não foi possível salvar.')
      return
    }
    setFeedback('Estagiária salva com sucesso.')
    await fetchData()
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function handleExport(scope: 'complete' | 'selected') {
    const source = scope === 'selected' ? items.filter((item) => selectedIds.includes(item.id)) : items
    const rows = buildReportRows(source, referenceDate)
    const reportTitle = `${scope === 'selected' ? 'relatorio-selecionadas' : 'relatorio-completo'}-${getMonthRangeLabel(referenceDate)}`
    downloadExcel(rows, reportTitle)
    await logExport('export_excel', scope, reportTitle, rows.length)
    setFeedback('Relatório gerado com sucesso!')
  }

  async function handleShare() {
    const reportLink = buildReportLink(window.location.origin, selectedIds, referenceDate)
    const reportTitle = `Relatório mensal - ${getMonthRangeLabel(referenceDate)}`
    await logExport('share_report', selectedIds.length > 0 ? 'selected' : 'complete', reportTitle, selectedIds.length || items.length)
    setShareModal({ open: true, reportLink, reportTitle })
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 sm:space-y-6 sm:px-5 sm:py-6 lg:px-6">
      <header className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Painel geral</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Controle de Estagiárias</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Acompanhe assiduidade, prazos e documentos com uma visão rápida, humana e orientada para ação.</p>
          </div>
          <button type="button" onClick={() => signOut()} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
            Sair
          </button>
        </div>

        {proximoPrazo ? (
          <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <strong className="font-semibold">Prazo próximo:</strong> {proximoPrazo.nome} precisa devolver até {formatDate(proximoPrazo.data_limite)}.
          </section>
        ) : null}
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-5">
          <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Nova estagiária</h2>
                <p className="text-sm text-slate-500">Cadastro simples, rápido e preparado para uso no celular.</p>
              </div>
              <span className="hidden rounded-full bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 sm:inline-flex">+ Adicionar estagiária</span>
            </div>
            <div className="mt-4">
              <InternForm onSave={createIntern} />
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'todas', label: 'Todas' },
                  { key: 'atrasado', label: 'Atrasadas' },
                  { key: 'em_risco', label: 'Em risco' },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFiltro(option.key as FiltroStatus)}
                    className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium ${filtro === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => navigate('/relatorio')} className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                Ver Relatório Mensal
              </button>
            </div>

            {loading ? <p className="mt-4 text-sm text-slate-600">Carregando...</p> : null}
            {error ? <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
            {feedback ? <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p> : null}

            <div className="mt-5 space-y-3">
              {filtradas.map((item) => {
                const status = getStatusPrazo(item.data_limite, item.data_devolucao)
                const statusChip = status === 'atrasado' ? 'bg-red-50 text-red-700' : status === 'em_risco' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                const isSelected = selectedIds.includes(item.id)
                const avatarGradient = getPhotoGradient(item.nome)

                return (
                  <article key={item.id} className={`rounded-[28px] border p-4 transition ${isSelected ? 'border-sky-300 bg-sky-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <button type="button" onClick={() => toggleSelected(item.id)} className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-2xl font-semibold text-white shadow-sm`}>
                          {getInitialLetter(item.nome)}
                        </button>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">{item.nome}</h3>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusChip}`}>{statusLabel(status)}</span>
                          </div>
                          <p className="text-sm text-slate-600">{item.faculdade}</p>
                          <p className="mt-1 text-sm text-slate-500">Dias de estágio: {item.dias_estagio}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:items-end">
                        <p className="text-sm font-medium text-slate-700">Prazo: {formatDate(item.data_limite)}</p>
                        <label className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelected(item.id)} />
                          Selecionar
                        </label>
                        <Link to={`/estagiaria/${item.id}`} className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                          Abrir ficha
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })}

              {!loading && filtradas.length === 0 ? <p className="text-sm text-slate-600">Nenhuma estagiária neste filtro.</p> : null}
            </div>
          </section>
        </div>

        <SummaryPanel items={items} selectedIds={selectedIds} referenceDate={referenceDate} onExport={handleExport} onShare={handleShare} />
      </div>

      <ShareModal state={shareModal} onClose={() => setShareModal((current) => ({ ...current, open: false }))} />
    </main>
  )
}
