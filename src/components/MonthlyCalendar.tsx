import type { Registro } from '../types'
import { monthDays, toDateValue } from '../utils'

type MonthlyCalendarProps = {
  registros: Registro[]
  onSetRegistro: (date: string, tipo: Registro['tipo'] | null) => Promise<void>
}

export function MonthlyCalendar({ registros, onSetRegistro }: MonthlyCalendarProps) {
  const today = new Date()
  const todayKey = toDateValue(today)
  const days = monthDays(today)
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7
  const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
  const monthLabel = today.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  const cells = [
    ...Array.from({ length: startOffset }, (_, index) => ({ id: `empty-start-${index}`, day: null as Date | null })),
    ...days.map((day) => ({ id: toDateValue(day), day })),
  ]

  while (cells.length % 7 !== 0) {
    cells.push({ id: `empty-end-${cells.length}`, day: null })
  }

  function findType(dateKey: string): Registro['tipo'] | null {
    return registros.find((registro) => registro.day === dateKey)?.tipo ?? null
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Calendario</p>
          <h3 className="text-xl font-semibold capitalize text-slate-900">{monthLabel}</h3>
        </div>
        <p className="text-xs text-slate-500">Marque falta, extra ou limpe o dia.</p>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {weekDays.map((label) => (
          <div key={label} className="rounded-xl bg-slate-100/80 py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map(({ id, day }) => {
          if (!day) {
            return <div key={id} className="min-h-28 rounded-2xl bg-slate-50/70" aria-hidden="true" />
          }

          const dateKey = toDateValue(day)
          const tipo = findType(dateKey)
          const label = day.getDate()
          const isToday = dateKey === todayKey
          const badgeClass =
            tipo === 'falta'
              ? 'bg-red-100 text-red-700'
              : tipo === 'extra'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
          const cellClass =
            tipo === 'falta'
              ? 'border-red-200 bg-red-50'
              : tipo === 'extra'
                ? 'border-emerald-200 bg-emerald-50'
                : isToday
                  ? 'border-sky-200 bg-sky-50'
                  : 'border-slate-200 bg-white'
          const statusLabel = tipo === 'falta' ? 'Falta' : tipo === 'extra' ? 'Extra' : 'Livre'

          return (
            <div
              key={dateKey}
              className={`flex min-h-28 flex-col justify-between rounded-2xl border p-2 transition-colors ${cellClass}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 shadow-sm">
                  {label}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${badgeClass}`}
                >
                  {statusLabel}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 text-xs font-semibold">
                <button
                  className="rounded-xl border border-red-200 bg-white px-1 py-2 text-red-700 transition hover:bg-red-50"
                  onClick={() => onSetRegistro(dateKey, 'falta')}
                  type="button"
                  aria-label={`Marcar falta no dia ${label}`}
                >
                  F
                </button>
                <button
                  className="rounded-xl border border-emerald-200 bg-white px-1 py-2 text-emerald-700 transition hover:bg-emerald-50"
                  onClick={() => onSetRegistro(dateKey, 'extra')}
                  type="button"
                  aria-label={`Marcar extra no dia ${label}`}
                >
                  E
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-1 py-2 text-[11px] text-slate-600 transition hover:bg-slate-100"
                  onClick={() => onSetRegistro(dateKey, null)}
                  type="button"
                  aria-label={`Limpar registro do dia ${label}`}
                >
                  Limpar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
