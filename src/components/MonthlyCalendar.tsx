import type { Registro } from '../types'
import { monthDays, toDateValue } from '../utils'

type MonthlyCalendarProps = {
  registros: Registro[]
  onSetRegistro: (date: string, tipo: Registro['tipo'] | null) => Promise<void>
}

export function MonthlyCalendar({ registros, onSetRegistro }: MonthlyCalendarProps) {
  // Calendário operacional: janela fixa de 30 dias do mês atual.
  const days = monthDays(new Date())

  function findType(dateKey: string): Registro['tipo'] | null {
    return registros.find((registro) => registro.day === dateKey)?.tipo ?? null
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Calendário mensal</h3>
        <p className="text-xs text-slate-500">Clique: Falta, Extra ou Remover</p>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateKey = toDateValue(day)
          const tipo = findType(dateKey)
          const label = day.getDate()
          const commonClass = 'rounded-lg border px-2 py-3 text-center text-sm font-medium'
          const colorClass =
            tipo === 'falta'
              ? 'border-red-200 bg-red-100 text-red-700'
              : tipo === 'extra'
                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                : 'border-slate-200 bg-slate-50 text-slate-700'

          return (
            <div key={dateKey} className="space-y-1">
              <div className={`${commonClass} ${colorClass}`}>{label}</div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  className="rounded bg-red-100 px-1 py-1 text-xs text-red-700"
                  onClick={() => onSetRegistro(dateKey, 'falta')}
                  type="button"
                >
                  F
                </button>
                <button
                  className="rounded bg-emerald-100 px-1 py-1 text-xs text-emerald-700"
                  onClick={() => onSetRegistro(dateKey, 'extra')}
                  type="button"
                >
                  E
                </button>
                <button
                  className="rounded bg-slate-200 px-1 py-1 text-xs text-slate-700"
                  onClick={() => onSetRegistro(dateKey, null)}
                  type="button"
                >
                  X
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
