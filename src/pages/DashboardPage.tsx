import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { InternForm } from '../components/InternForm'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Estagiaria } from '../types'
import { formatDate, getStatusPrazo, normalizeEstagiaria, statusLabel } from '../utils'

type FiltroStatus = 'todas' | 'atrasado' | 'em_risco'

const selectFields =
  'id, user_id, nome, faculdade, dias_estagio, observacoes, data_recebimento, data_limite, data_devolucao, registros, formacoes, created_at, updated_at'

export function DashboardPage() {
  const { signOut, session } = useAuth()
  const [items, setItems] = useState<Estagiaria[]>([])
  const [filtro, setFiltro] = useState<FiltroStatus>('todas')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  async function fetchData() {
    setLoading(true)
    setError('')
    const { data, error: dbError } = await supabase
      .from('estagiarias')
      .select(selectFields)
      // Requisito: ordenação alfabética por nome.
      .order('nome', { ascending: true })

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
    // Realtime para refletir alterações feitas em outros dispositivos.
    const channel = supabase
      .channel(`estagiarias-dashboard-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'estagiarias', filter: `user_id=eq.${session.user.id}` },
        () => fetchData(),
      )
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
    const candidatas = items
      .filter((item) => item.data_limite && !item.data_devolucao)
      .sort((a, b) => (a.data_limite! < b.data_limite! ? -1 : 1))
    return candidatas[0] ?? null
  }, [items])

  async function createIntern(payload: {
    nome: string
    faculdade: string
    dias_estagio: string
    observacoes: string
  }) {
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

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 md:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-semibold">Controle de estagiárias</h1>
          <p className="text-sm text-slate-600">Quem está atrasada, em risco ou precisa de atenção.</p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm"
        >
          Sair
        </button>
      </header>

      {proximoPrazo ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <strong>Próximo prazo:</strong> {proximoPrazo.nome} - {formatDate(proximoPrazo.data_limite)}
        </section>
      ) : null}

      <InternForm onSave={createIntern} />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          {[
            { key: 'todas', label: 'Todas' },
            { key: 'atrasado', label: 'Atrasadas' },
            { key: 'em_risco', label: 'Em risco' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setFiltro(option.key as FiltroStatus)}
              className={`rounded-xl px-3 py-2 text-sm ${
                filtro === option.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-slate-600">Carregando...</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}

        <div className="mt-3 space-y-2">
          {filtradas.map((item) => {
            const status = getStatusPrazo(item.data_limite, item.data_devolucao)
            const statusClass =
              status === 'atrasado'
                ? 'text-red-700'
                : status === 'em_risco'
                  ? 'text-amber-700'
                  : 'text-emerald-700'

            return (
              <Link
                key={item.id}
                to={`/estagiaria/${item.id}`}
                className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.nome}</p>
                    <p className="text-sm text-slate-600">{item.faculdade}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${statusClass}`}>{statusLabel(status)}</p>
                    <p className="text-xs text-slate-500">Prazo: {formatDate(item.data_limite)}</p>
                  </div>
                </div>
              </Link>
            )
          })}
          {!loading && filtradas.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhuma estagiária neste filtro.</p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
