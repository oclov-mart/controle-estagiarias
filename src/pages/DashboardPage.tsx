import { useEffect, useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { InternForm } from '../components/InternForm'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Estagiaria, ReportPeriod, ReportRow } from '../types'
import {
  buildReportLink,
  buildReportRows,
  formatDate,
  formatMinutes,
  getInitialLetter,
  getPeriodLabel,
  getStatusPrazo,
  normalizeEstagiaria,
  statusLabel,
} from '../utils'

type FiltroStatus = 'todas' | 'atrasado' | 'em_risco'
type DashboardTab = 'monitoramento'

type ShareModalState = {
  open: boolean
  reportLink: string
  reportTitle: string
}

type ExportLogEntry = {
  id: string
  action: string
  scope: string
  reportTitle: string
  rowsCount: number
  createdAt: string
}

type ImportDraft = {
  faculdade_global: string
  dias_estagio_global: string
  observacoes_globais: string
  formacao_nome: string
  formacao_data: string
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
    // Mantm auditoria local quando a tabela ainda no existir no banco.
  }
}

function downloadExcel(rows: ReportRow[], reportTitle: string) {
  const worksheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Nome: row.nome,
      Faculdade: row.faculdade,
      'Dias de estgio': row.dias_estagio,
      Presenas: row.presencas,
      Faltas: row.faltas,
      'Horas extras': row.horas_extras,
      'ltimo prazo': row.ultimo_prazo,
      Status: row.status,
    })),
  )
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatrio')
  XLSX.writeFile(workbook, `${reportTitle.replace(/\s+/g, '_').toLowerCase()}.xlsx`)
}

async function readSpreadsheet(file: File): Promise<Array<Record<string, string>>> {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const firstSheet = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheet]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()])),
  )
}

function findColumn(row: Record<string, string>, aliases: string[]): string {
  const key = Object.keys(row).find((column) => aliases.some((alias) => column.includes(alias)))
  return key ?? ''
}

function normalizeImportedRows(rows: Array<Record<string, string>>, draft: ImportDraft): Array<{
  nome: string
  faculdade: string
  dias_estagio: string
  observacoes: string
  formacoes: Array<{ nome: string; data: string; presente: boolean }>
}> {
  if (rows.length === 0) return []

  const sample = rows[0]
  const nomeKey = findColumn(sample, ['nome'])
  const faculdadeKey = findColumn(sample, ['faculdade'])
  const diasKey = findColumn(sample, ['dias', 'estgio', 'estagio'])

  return rows
    .map((row) => {
      const nome = row[nomeKey] || ''
      const faculdade = draft.faculdade_global || row[faculdadeKey] || ''
      const dias_estagio = draft.dias_estagio_global || row[diasKey] || ''
      if (!nome || !faculdade || !dias_estagio) return null

      return {
        nome,
        faculdade,
        dias_estagio,
        observacoes: draft.observacoes_globais,
        formacoes: draft.formacao_nome && draft.formacao_data ? [{ nome: draft.formacao_nome, data: draft.formacao_data, presente: true }] : [],
      }
    })
    .filter(Boolean) as Array<{
    nome: string
    faculdade: string
    dias_estagio: string
    observacoes: string
    formacoes: Array<{ nome: string; data: string; presente: boolean }>
  }>
}

function ShareModal({ state, onClose }: { state: ShareModalState; onClose: () => void }) {
  if (!state.open) return null

  const emailHref = `mailto:?subject=${encodeURIComponent(state.reportTitle)}&body=${encodeURIComponent(`Acesse o relatrio online em: ${state.reportLink}`)}`
  const teamsHref = `https://teams.microsoft.com/share?href=${encodeURIComponent(state.reportLink)}&msgText=${encodeURIComponent(state.reportTitle)}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${state.reportTitle} - ${state.reportLink}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Compartilhar</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">{state.reportTitle}</h3>
            <p className="mt-1 text-sm text-slate-600">Envie por e-mail, copie o link do relatrio online ou compartilhe em ferramentas corporativas.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          <a href={emailHref} className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            Enviar por e-mail (link do relatrio)
          </a>
          <button type="button" onClick={() => void navigator.clipboard.writeText(state.reportLink)} className="min-h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
            Copiar link de acesso ao relatrio online
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

function SummaryPanel({ items, selectedIds, referenceDate, period, savedReports, onPeriodChange, onExport, onShare }: {
  items: Estagiaria[]
  selectedIds: string[]
  referenceDate: Date
  period: ReportPeriod
  savedReports: ExportLogEntry[]
  onPeriodChange: (period: ReportPeriod) => void
  onExport: (scope: 'complete' | 'selected') => void
  onShare: () => void
}) {
  const rows = useMemo(() => {
    const source = selectedIds.length > 0 ? items.filter((item) => selectedIds.includes(item.id)) : items
    return buildReportRows(source, referenceDate, period)
  }, [items, period, referenceDate, selectedIds])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.presencas += row.presencas
          acc.faltas += row.faltas
          const [hours, minutes] = row.horas_extras.split(':').map(Number)
          acc.horasExtras += hours * 60 + minutes
          return acc
        },
        { presencas: 0, faltas: 0, horasExtras: 0 },
      ),
    [rows],
  )

  const prazos = items.filter((item) => item.data_limite && !item.data_devolucao).sort((a, b) => (a.data_limite! < b.data_limite! ? -1 : 1)).slice(0, 3)

  return (
    <aside className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-6 lg:self-start">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Resumo</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{getPeriodLabel(referenceDate, period)}</h2>
      <p className="mt-1 text-sm text-slate-600">Estatsticas mensais e atalhos para exportao e compartilhamento.</p>

      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => onPeriodChange('mes')} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium ${period === 'mes' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
          Ms
        </button>
        <button type="button" onClick={() => onPeriodChange('trimestre')} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium ${period === 'trimestre' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
          Trimestre
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <div className="rounded-[24px] bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Presenas</p>
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
            <p className="text-sm text-slate-500">Alertas prximos para acompanhamento.</p>
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
          ?? Baixar Cpia Local (Excel)
        </button>
        <Link to={`/relatorio?month=${referenceDate.getMonth() + 1}&year=${referenceDate.getFullYear()}&period=${period}`} className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
          Ver Relatrio Mensal
        </Link>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:fixed lg:bottom-6 lg:right-6 lg:z-30 lg:w-[320px] lg:flex-col">
        <button type="button" onClick={() => onExport('selected')} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
          Somente selecionadas
        </button>
        <button type="button" onClick={onShare} className="min-h-12 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm">
          ?? Compartilhar relatrio
        </button>
      </div>

      <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">Relatrios salvos</h3>
            <p className="text-sm text-slate-500">Histrico interno para consulta rpida.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">{savedReports.length}</span>
        </div>
        <div className="mt-4 space-y-3">
          {savedReports.length > 0 ? (
            savedReports.map((entry) => (
              <div key={entry.id} className="rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-sm">
                <p className="font-semibold text-slate-900">{entry.reportTitle}</p>
                <p>{new Date(entry.createdAt).toLocaleDateString('pt-BR')}</p>
                <p className="text-xs text-slate-500">{entry.rowsCount} linha(s)  {entry.scope}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Nenhum relatrio salvo ainda.</p>
          )}
        </div>
      </div>
    </aside>
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('monitoramento')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [period, setPeriod] = useState<ReportPeriod>('mes')
  const [shareModal, setShareModal] = useState<ShareModalState>({ open: false, reportLink: '', reportTitle: '' })
  const [savedReports, setSavedReports] = useState<ExportLogEntry[]>([])
  const [importDraft, setImportDraft] = useState<ImportDraft>({ faculdade_global: '', dias_estagio_global: '', observacoes_globais: '', formacao_nome: '', formacao_data: '' })
  const [importing, setImporting] = useState(false)
  const referenceDate = useMemo(() => new Date(), [])

  async function fetchData() {
    setLoading(true)
    setError('')
    const { data, error: dbError } = await supabase.from('estagiarias').select(selectFields).order('nome', { ascending: true })
    if (dbError) {
      setError('No foi possvel carregar os dados.')
      setLoading(false)
      return
    }
    setItems(((data ?? []) as Estagiaria[]).map(normalizeEstagiaria))
    setLoading(false)
  }

  function loadSavedReports() {
    const logs = JSON.parse(localStorage.getItem('export_logs') ?? '[]') as ExportLogEntry[]
    setSavedReports(logs.slice(0, 6))
  }

  useEffect(() => {
    fetchData()
    loadSavedReports()
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
    if (!session?.user.id) {
      setError('Sesso invlida. Entre novamente para continuar.')
      return
    }
    const { error: insertError } = await supabase.from('estagiarias').insert({
      user_id: session.user.id,
      ...payload,
      observacoes: payload.observacoes || null,
      registros: [],
      formacoes: [],
    })
    if (insertError) {
      setError('No foi possvel salvar.')
      return
    }
    setFeedback('Estagiria salva com sucesso.')
    await fetchData()
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!session?.user.id) {
      setError('Sesso invlida. Entre novamente para continuar.')
      event.target.value = ''
      return
    }
    setImporting(true)
    setError('')
    try {
      const rows = await readSpreadsheet(file)
      const normalized = normalizeImportedRows(rows, importDraft)
      if (normalized.length === 0) {
        setError('Nenhuma linha vlida foi encontrada para importao.')
        return
      }
      const payload = normalized.map((row) => ({ user_id: session.user.id, nome: row.nome, faculdade: row.faculdade, dias_estagio: row.dias_estagio, observacoes: row.observacoes || null, registros: [], formacoes: row.formacoes }))
      const { error: insertError } = await supabase.from('estagiarias').insert(payload)
      if (insertError) {
        setError('No foi possvel concluir a importao.')
        return
      }
      setFeedback(`Sucesso! ${normalized.length} novas estagirias foram cadastradas automaticamente.`)
      await fetchData()
    } finally {
      setImporting(false)
      event.target.value = ''
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  async function handleExport(scope: 'complete' | 'selected') {
    const source = scope === 'selected' ? items.filter((item) => selectedIds.includes(item.id)) : items
    const rows = buildReportRows(source, referenceDate, period)
    const reportTitle = `${scope === 'selected' ? 'relatorio-selecionadas' : 'relatorio-completo'}-${getPeriodLabel(referenceDate, period)}`
    downloadExcel(rows, reportTitle)
    await logExport('export_excel', scope, reportTitle, rows.length)
    loadSavedReports()
    setFeedback('Relatrio gerado com sucesso!')
  }

  async function handleShare() {
    const reportLink = buildReportLink(window.location.origin, selectedIds, referenceDate, period)
    const reportTitle = `Relatrio ${period === 'trimestre' ? 'trimestral' : 'mensal'} - ${getPeriodLabel(referenceDate, period)}`
    await logExport('share_report', selectedIds.length > 0 ? 'selected' : 'complete', reportTitle, selectedIds.length || items.length)
    loadSavedReports()
    setShareModal({ open: true, reportLink, reportTitle })
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 sm:space-y-6 sm:px-5 sm:py-6 lg:px-6">
      <header className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Painel geral</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Controle de Estagirias</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Acompanhe assiduidade, prazos e documentos com uma viso rpida, humana e orientada para ao.</p>
          </div>
          <button type="button" onClick={() => signOut()} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
            Sair
          </button>
        </div>
        {proximoPrazo ? (
          <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <strong className="font-semibold">Prazo prximo:</strong> {proximoPrazo.nome} precisa devolver at {formatDate(proximoPrazo.data_limite)}.
          </section>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActiveTab('monitoramento')} className={`min-h-12 rounded-2xl px-4 py-3 text-sm font-semibold ${activeTab === 'monitoramento' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>
          Monitoramento
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-5">
          <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'todas', label: 'Todas' },
                    { key: 'atrasado', label: 'Atrasadas' },
                    { key: 'em_risco', label: 'Em risco' },
                  ].map((option) => (
                    <button key={option.key} type="button" onClick={() => setFiltro(option.key as FiltroStatus)} className={`min-h-11 rounded-2xl px-4 py-2 text-sm font-medium ${filtro === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {option.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => navigate(`/relatorio?month=${referenceDate.getMonth() + 1}&year=${referenceDate.getFullYear()}&period=${period}`)} className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                  Ver Relatrio Mensal
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
                            {getInitialLetter(item.nome          )}
                          </button>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-slate-900">{item.nome}</h3>
                              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusChip}`}>{statusLabel(status)}</span>
                            </div>
                            <p className="text-sm text-slate-600">{item.faculdade}</p>
                            <p className="mt-1 text-sm text-slate-500">Dias de estgio: {item.dias_estagio}</p>
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
                {!loading && filtradas.length === 0 ? <p className="text-sm text-slate-600">Nenhuma estagiria neste filtro.</p> : null}
              </div>
            </section>

              <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Nova estagiria</h2>
                    <p className="text-sm text-slate-500">Cadastro simples, rpido e preparado para uso no celular.</p>
                  </div>
                  <span className="hidden rounded-full bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 sm:inline-flex">+ Adicionar estagiria</span>
                </div>
                <div className="mt-4">
                  <InternForm onSave={createIntern} />
                </div>
              </section>

              <section className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Importar Estagirias (Excel/CSV)</h2>
                    <p className="text-sm text-slate-500">Aceita `.xlsx` e `.csv`, com mapeamento automtico de Nome, Faculdade e Dias de Estgio.</p>
                  </div>
                  <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
                    {importing ? 'Importando...' : 'Importar Estagirias (Excel/CSV)'}
                    <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleImportFile} disabled={importing} />
                  </label>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="text-sm font-medium text-slate-700">Faculdade global
                    <input value={importDraft.faculdade_global} onChange={(event) => setImportDraft((current) => ({ ...current, faculdade_global: event.target.value }))} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" placeholder="Opcional para aplicar a todas" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Dias de estgio global
                    <input value={importDraft.dias_estagio_global} onChange={(event) => setImportDraft((current) => ({ ...current, dias_estagio_global: event.target.value }))} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" placeholder="Ex: seg, qua, sex" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Formao global
                    <input value={importDraft.formacao_nome} onChange={(event) => setImportDraft((current) => ({ ...current, formacao_nome: event.target.value }))} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" placeholder="Nome da formao para todas" />
                  </label>
                  <label className="text-sm font-medium text-slate-700">Data da formao global
                    <input type="date" value={importDraft.formacao_data} onChange={(event) => setImportDraft((current) => ({ ...current, formacao_data: event.target.value }))} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
                  </label>
                  <label className="text-sm font-medium text-slate-700 lg:col-span-2">Observaes globais
                    <textarea value={importDraft.observacoes_globais} onChange={(event) => setImportDraft((current) => ({ ...current, observacoes_globais: event.target.value }))} className="mt-1 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" placeholder="Notas para aplicar a todas as importadas" />
                  </label>
                </div>
              </section>
        </div>

        <SummaryPanel items={items} selectedIds={selectedIds} referenceDate={referenceDate} period={period} savedReports={savedReports} onPeriodChange={setPeriod} onExport={handleExport} onShare={handleShare} />
      </div>

      {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {feedback ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p> : null}
      <ShareModal state={shareModal} onClose={() => setShareModal((current) => ({ ...current, open: false }))} />
    </main>
  )
}

