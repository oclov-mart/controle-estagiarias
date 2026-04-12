import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Registro, RegistroTipo } from '../types'
import { createEmptyRegistro, toDateValue } from '../utils'


type MonthlyCalendarProps = {
  month: Date
  registros: Record<string, Registro>
  onSaveRegistro: (registro: Registro) => Promise<void>
  onRemoveRegistro: (day: string) => Promise<void>
  onSaveManyRegistros: (days: string[], base: Partial<Registro>) => Promise<void>
}

export function MonthlyCalendar({ month, registros, onSaveRegistro, onRemoveRegistro, onSaveManyRegistros }: MonthlyCalendarProps) {
  const [referenceDate, setReferenceDate] = useState(month)
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [batchDraft, setBatchDraft] = useState<Partial<Registro>>(createEmptyRegistro('', 'presenca'))
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null)
  const [editorDay, setEditorDay] = useState<string | null>(null)
  const [editorDraft, setEditorDraft] = useState<Partial<Registro> | null>(null)
  const gesture = useRef({ active: false, value: true, sourceDay: null as string | null, pointerType: null as string | null })
  const holdTimer = useRef<number | null>(null)

  const todayKey = toDateValue(new Date())
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(referenceDate)

  const effectiveMap = useMemo(() => {
    const map = new Map(Object.entries(registros))
    selectedDays.forEach((day) => {
      if (!map.has(day)) {
        map.set(day, createEmptyRegistro(day, 'presenca'))
      }
    })
    return map
  }, [registros, selectedDays])

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  const dotStyles: Record<RegistroTipo, string> = {
    presenca: 'bg-green-500',
    falta: 'bg-red-500',
    formacao: 'bg-slate-400',
  }

  const cells = useMemo(() => {
    const year = referenceDate.getFullYear()
    const month = referenceDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const totalDays = lastDay.getDate()
    const totalCells = Math.ceil((startPadding + totalDays) / 7) * 7

    return Array.from({ length: totalCells }, (_, index) => {
      const id = `cell-${index}`
      if (index < startPadding) {
        return { id, day: null }
      }
      const dayNumber = index - startPadding + 1
      if (dayNumber > totalDays) {
        return { id, day: null }
      }
      return { id, day: new Date(year, month, dayNumber) }
    })
  }, [referenceDate])

  function toggleDaySelection(day: string, value = true) {
    setSelectedDays((prev) => {
      if (value) {
        return prev.includes(day) ? prev : [...prev, day]
      }
      return prev.filter((d) => d !== day)
    })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, day: string) {
    const isEditable = true
    if (!isEditable) return
    gesture.current = { active: false, value: !selectedDays.includes(day), sourceDay: day, pointerType: event.pointerType }
    if (event.pointerType === 'touch') {
      holdTimer.current = window.setTimeout(() => {
        gesture.current.active = true
        toggleDaySelection(gesture.current.sourceDay!, gesture.current.value)
      }, 500)
    }
  }

  function handlePointerEnter(event: ReactPointerEvent<HTMLDivElement>, day: string) {
    if (gesture.current.pointerType === 'mouse' && event.buttons === 1 && !gesture.current.active && gesture.current.sourceDay && gesture.current.sourceDay !== day) {
      gesture.current.active = true
      toggleDaySelection(gesture.current.sourceDay, gesture.current.value)
    }
    if (!gesture.current.active) return
    toggleDaySelection(day, gesture.current.value)
  }

  function resetPointerState(day?: string) {
    if (day && gesture.current.sourceDay === day && !gesture.current.active) {
      toggleDaySelection(day, gesture.current.value)
    }
    gesture.current = { active: false, value: true, sourceDay: null, pointerType: null }
    if (holdTimer.current) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  function openDayEditor(day: string) {
    const registro = effectiveMap.get(day) ?? null
    setEditorDay(day)
    setEditorDraft(registro ? { ...registro } : createEmptyRegistro(day, 'presenca'))
  }

  async function applyBatch() {
    const editableDays = selectedDays
    if (editableDays.length === 0) return
    await onSaveManyRegistros(editableDays, batchDraft)
    setBatchFeedback(`${editableDays.length} dias atualizados com sucesso.`)
    setSelectedDays([])
  }

  return (
    <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700">
          ‹
        </button>
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Assiduidade</p>
          <h3 className="mt-1 text-2xl font-semibold text-slate-900">{monthLabel}</h3>
        </div>
        <button type="button" onClick={() => setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700">
          ›
        </button>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">{selectedDays.length} dias selecionados</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBatchDraft({ ...batchDraft, tipo: 'presenca' })}
              className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${batchDraft.tipo === 'presenca' ? 'border-green-600 bg-green-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              Presença
            </button>
            <button
              type="button"
              onClick={() => setBatchDraft({ ...batchDraft, tipo: 'falta' })}
              className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${batchDraft.tipo === 'falta' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              Falta
            </button>
            <button type="button" onClick={applyBatch} disabled={selectedDays.length === 0} className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              Aplicar aos selecionados
            </button>
          </div>
        </div>
        {batchFeedback && (
          <div className="mt-3 rounded-2xl bg-green-50 px-4 py-3 text-sm font-medium text-green-900">
            {batchFeedback}
          </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {weekDays.map((label) => (
          <div key={label} className="rounded-2xl bg-slate-100 py-3">{label}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {cells.map(({ id, day }) => {
          if (!day) {
            return <div key={id} className="min-h-24 rounded-[24px] bg-slate-50/80 sm:min-h-28" aria-hidden="true" />
          }

          const dateKey = toDateValue(day)
          const registro = effectiveMap.get(dateKey) ?? null
          const isToday = dateKey === todayKey
          const isSelected = selectedDays.includes(dateKey)
          const hasAttachment = Boolean(registro?.anexo_atestado || registro?.atestado_medico)

          return (
            <div
              key={dateKey}
              onPointerDown={(event) => handlePointerDown(event, dateKey)}
              onPointerEnter={(event) => handlePointerEnter(event, dateKey)}
              onPointerUp={() => resetPointerState(dateKey)}
              onPointerCancel={() => resetPointerState()}
              className={`relative min-h-24 rounded-[24px] border p-2 text-left transition sm:min-h-28 ${
                isToday ? 'border-sky-300 shadow-[0_0_0_2px_rgba(14,165,233,0.15)]' : 'border-slate-200'
              } ${registro?.tipo === 'formacao' ? 'bg-[repeating-linear-gradient(135deg,#f8fafc,#f8fafc_10px,#e2e8f0_10px,#e2e8f0_20px)]' : 'bg-white'} ${
                isSelected ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-200 ring-offset-1' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {day.getDate()}
                </span>
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    openDayEditor(dateKey)
                  }}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-sm text-slate-600 shadow-sm"
                  aria-label={`Abrir detalhes de ${day.getDate()}`}
                >
                  +
                </button>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div className="flex items-center gap-1.5">
                  {registro?.tipo ? <span className={`h-3 w-3 rounded-full ${dotStyles[registro.tipo]}`} /> : <span className="h-3 w-3 rounded-full bg-slate-200" />}
                  {registro?.tipo === 'formacao' ? <span className="text-[10px] text-slate-400">?</span> : null}
                </div>
                {hasAttachment ? <span className="text-sm text-slate-500">📎</span> : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500" /> Presença</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Falta</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-400" /> Formação</span>
          <span className="inline-flex items-center gap-2">📎 Atestado</span>
        </div>
      </div>

      {editorDay && editorDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Detalhes do dia</h2>
              <button
                type="button"
                onClick={() => setEditorDay(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  value={editorDraft.tipo || 'presenca'}
                  onChange={(e) => setEditorDraft({ ...editorDraft, tipo: e.target.value as RegistroTipo })}
                  className="mt-1 block w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="presenca">Presença</option>
                  <option value="falta">Falta</option>
                  <option value="formacao">Formação</option>
                </select>
              </div>

              {editorDraft.tipo === 'falta' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Motivo</label>
                  <textarea
                    value={editorDraft.motivo || ''}
                    onChange={(e) => setEditorDraft({ ...editorDraft, motivo: e.target.value })}
                    className="mt-1 block w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await onSaveRegistro({ day: editorDay, ...editorDraft } as Registro)
                    setEditorDay(null)
                  }}
                  className="flex-1 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await onRemoveRegistro(editorDay)
                    setEditorDay(null)
                  }}
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
