import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Estagiaria } from '../types'
import { buildReportRows, formatMinutes, getMonthRangeLabel, getMonthlyMetrics, normalizeEstagiaria } from '../utils'

const selectFields =
  'id, user_id, nome, faculdade, dias_estagio, observacoes, data_recebimento, data_limite, data_devolucao, registros, formacoes, created_at, updated_at'

export function MonthlyReportPage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [items, setItems] = useState<Estagiaria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const month = Number(params.get('month') ?? new Date().getMonth() + 1)
  const year = Number(params.get('year') ?? new Date().getFullYear())
  const selectedIds = (params.get('ids') ?? '').split(',').filter(Boolean)
  const referenceDate = useMemo(() => new Date(year, month - 1, 1), [month, year])

  useEffect(() => {
    async function fetchData() {
      if (!session?.user.id) return
      setLoading(true)
      setError('')
      const { data, error: dbError } = await supabase.from('estagiarias').select(selectFields).order('nome', { ascending: true })
      if (dbError) {
        setError('Não foi possível carregar o relatório.')
        setLoading(false)
        return
      }
      setItems(((data ?? []) as Estagiaria[]).map(normalizeEstagiaria))
      setLoading(false)
    }

    fetchData()
  }, [session?.user.id])

  const filteredItems = useMemo(() => {
    if (selectedIds.length === 0) return items
    return items.filter((item) => selectedIds.includes(item.id))
  }, [items, selectedIds])

  const rows = useMemo(() => buildReportRows(filteredItems, referenceDate), [filteredItems, referenceDate])
  const totalHoras = useMemo(() => filteredItems.reduce((acc, item) => acc + getMonthlyMetrics(item, referenceDate).horasExtras, 0), [filteredItems, referenceDate])

  return (
    <main className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 sm:px-5 sm:py-6 lg:px-6">
      <header className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Relatório online</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">Relatório Mensal</h1>
            <p className="mt-2 text-sm text-slate-600">{getMonthRangeLabel(referenceDate)} • {selectedIds.length > 0 ? 'Somente selecionadas' : 'Relatório completo'}</p>
          </div>
          <Link to="/" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
            Voltar ao painel
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Estagiárias</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{filteredItems.length}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Linhas no relatório</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Horas extras somadas</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatMinutes(totalHoras)}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Faculdade</th>
                <th className="px-4 py-3 font-medium">Dias de estágio</th>
                <th className="px-4 py-3 font-medium">Presenças</th>
                <th className="px-4 py-3 font-medium">Faltas</th>
                <th className="px-4 py-3 font-medium">Horas extras</th>
                <th className="px-4 py-3 font-medium">Último prazo</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 text-slate-700">
                  <td className="px-4 py-3 font-medium text-slate-900">{row.nome}</td>
                  <td className="px-4 py-3">{row.faculdade}</td>
                  <td className="px-4 py-3">{row.dias_estagio}</td>
                  <td className="px-4 py-3">{row.presencas}</td>
                  <td className="px-4 py-3">{row.faltas}</td>
                  <td className="px-4 py-3">{row.horas_extras}</td>
                  <td className="px-4 py-3">{row.ultimo_prazo}</td>
                  <td className="px-4 py-3">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {loading ? <p className="px-4 py-4 text-sm text-slate-600">Carregando...</p> : null}
        {error ? <p className="px-4 py-4 text-sm text-red-700">{error}</p> : null}
      </section>
    </main>
  )
}
