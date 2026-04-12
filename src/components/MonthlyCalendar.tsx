import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Registro, RegistroTipo } from '../types'
import { createEmptyRegistro, monthDays, toDateValue } from '../utils'

type RegistroDraft = Omit<Registro, 'day'>

type EffectiveRegistro = Registro & {
  locked: boolean
}

type MonthlyCalendarProps = {
  registros: Registro[]
  formacaoDays: string[]
  onSaveRegistro: (registro: Registro) => Promise<void>
  onRemoveRegistro: (day: string) => Promise<void>
  onSaveManyRegistros: (days: string[], draft: RegistroDraft) => Promise<void>
}

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const statusStyles: Record<RegistroTipo, string> = {
  presenca: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  falta: 'border-red-200 bg-red-50 text-red-900',
  abono: 'border-amber-200 bg-amber-50 text-amber-950',
  formacao: 'border-violet-200 bg-violet-50 text-violet-900',
}

function buildDraft(registro: EffectiveRegistro | Registro | null, day: string, tipo?: RegistroTipo): RegistroDraft {
  const base = registro ?? createEmptyRegistro(day, tipo ?? 'presenca')
  const nextTipo = tipo ?? base.tipo

  if (nextTipo === 'falta' || nextTipo === 'abono') {
    return {
      tipo: nextTipo,
      motivo: base.tipo === nextTipo ? base.motivo : null,
      atestado_medico: nextTipo === 'falta' ? base.atestado_medico : false,
      hora_entrada: null,
      hora_saida: null,
      hora_extra: null,
    }
  }

  if (nextTipo === 'formacao') {
    return {
      tipo: 'formacao',
      motivo: 'Formação',
      atestado_medico: false,
      hora_entrada: null,
      hora_saida: null,
      hora_extra: null,
    }
  }

  return {
    tipo: 'presenca',
    motivo: null,
    atestado_medico: false,
    hora_entrada: base.tipo === 'presenca' ? base.hora_entrada : null,
    hora_saida: base.tipo === 'presenca' ? base.hora_saida : null,
    hora_extra: base.tipo === 'presenca' ? base.hora_extra : null,
  }
}

function summaryLabel(registro: EffectiveRegistro | null): string {
  if (!registro) return 'Sem registro'
  if (registro.tipo === 'falta') return registro.motivo || (registro.atestado_medico ? 'Falta com atestado' : 'Falta')
  if (registro.tipo === 'abono') return registro.motivo || 'Abono'
  if (registro.tipo === 'formacao') return 'Formação programada'
  if (registro.hora_extra) return `Extra: ${registro.hora_extra}`
  if (registro.hora_entrada && registro.hora_saida) return `${registro.hora_entrada} às ${registro.hora_saida}`
  return 'Presença'
}

function DayEditor({
  draft,
  disabled,
  onChange,
}: {
  draft: RegistroDraft
  disabled?: boolean
  onChange: (next: RegistroDraft) => void
}) {
  function setTipo(tipo: RegistroTipo) {
    onChange(buildDraft({ day: '', locked: false, ...draft }, '', tipo))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {(['presenca', 'falta', 'abono'] as RegistroTipo[]).map((tipo) => (
          <button
            key={tipo}
            type="button"
            disabled={disabled}
            onClick={() => setTipo(tipo)}
            className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              draft.tipo === tipo ? statusStyles[tipo] : 'border-slate-200 bg-white text-slate-600'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {tipo === 'presenca' ? 'Presença' : tipo === 'falta' ? 'Falta' : 'Abono'}
          </button>
        ))}
      </div>

      {(draft.tipo === 'falta' || draft.tipo === 'abono') && (
        <div className="grid gap-3">
          <label className="text-sm font-medium text-slate-700">
            Motivo
            <input
              disabled={disabled}
              value={draft.motivo ?? ''}
              onChange={(event) => onChange({ ...draft, motivo: event.target.value || null })}
              placeholder={draft.tipo === 'abono' ? 'Ex: compensação, folga autorizada' : 'Ex: consulta, faculdade, indisposição'}
              className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
            />
          </label>

          {draft.tipo === 'falta' && (
            <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              <input
                disabled={disabled}
                type="checkbox"
                checked={draft.atestado_medico}
                onChange={(event) => onChange({ ...draft, atestado_medico: event.target.checked })}
              />
              Possui atestado médico
            </label>
          )}
        </div>
      )}

      {draft.tipo === 'presenca' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Hora de entrada
            <input
              disabled={disabled}
              type="time"
              value={draft.hora_entrada ?? ''}
              onChange={(event) => onChange({ ...draft, hora_entrada: event.target.value || null })}
              className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hora de saída
            <input
              disabled={disabled}
              type="time"
              value={draft.hora_saida ?? ''}
              onChange={(event) => onChange({ ...draft, hora_saida: event.target.value || null })}
              className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Hora extra
            <input
              disabled={disabled}
              value={draft.hora_extra ?? ''}
              onChange={(event) => onChange({ ...draft, hora_extra: event.target.value || null })}
              placeholder="Ex: 01:30"
              className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function MonthlyCalendar({
  registros,
  formacaoDays,
  onSaveRegistro,
  onRemoveRegistro,
  onSaveManyRegistros,
}: MonthlyCalendarProps) {
  const now = new Date()
  const todayKey = toDateValue(now)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gesture = useRef<{ active: boolean; pointerId: number | null; mode: 'select' | null; value: boolean }>({
    active: false,
    pointerId: null,
    mode: null,
    value: true,
  })

  const [referenceDate, setReferenceDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [editorDay, setEditorDay] = useState<string | null>(null)
  const [editorDraft, setEditorDraft] = useState<RegistroDraft | null>(null)
  const [batchDraft, setBatchDraft] = useState<RegistroDraft>(createEmptyRegistro(todayKey, 'presenca'))

  const effectiveMap = useMemo(() => {
    const map = new Map<string, EffectiveRegistro>()

    registros.forEach((registro) => {
      map.set(registro.day, { ...registro, locked: false })
    })

    formacaoDays.forEach((day) => {
      map.set(day, {
        ...createEmptyRegistro(day, 'formacao'),
        motivo: 'Formação',
        locked: true,
      })
    })

    return map
  }, [formacaoDays, registros])

  const days = monthDays(referenceDate)
  const firstDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7
  const monthLabel = `${monthNames[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`
  const yearOptions = Array.from({ length: 9 }, (_, index) => now.getFullYear() - 4 + index)
  const cells = [
    ...Array.from({ length: startOffset }, (_, index) => ({ id: `empty-start-${index}`, day: null as Date | null })),
    ...days.map((day) => ({ id: toDateValue(day), day })),
  ]

  while (cells.length % 7 !== 0) {
    cells.push({ id: `empty-end-${cells.length}`, day: null })
  }

  useEffect(() => {
    if (!editorDay) return
    const registro = effectiveMap.get(editorDay) ?? null
    setEditorDraft(buildDraft(registro, editorDay, registro?.tipo))
  }, [editorDay, effectiveMap])

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
    }
  }, [])

  function toggleDaySelection(day: string, value?: boolean) {
    const registro = effectiveMap.get(day)
    if (registro?.locked) return

    setSelectedDays((current) => {
      const hasDay = current.includes(day)
      const shouldSelect = value ?? !hasDay
      if (shouldSelect && !hasDay) return [...current, day]
      if (!shouldSelect && hasDay) return current.filter((item) => item !== day)
      return current
    })
  }

  function startGesture(pointerId: number, value: boolean) {
    gesture.current = { active: true, pointerId, mode: 'select', value }
  }

  function clearGesture() {
    gesture.current = { active: false, pointerId: null, mode: null, value: true }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, day: string) {
    const target = event.target as HTMLElement
    if (target.closest('button, input, select, textarea, label')) return
    const registro = effectiveMap.get(day)
    if (registro?.locked) return

    const nextValue = !selectedDays.includes(day)

    if (event.pointerType === 'mouse') {
      startGesture(event.pointerId, nextValue)
      toggleDaySelection(day, nextValue)
      return
    }

    holdTimer.current = setTimeout(() => {
      startGesture(event.pointerId, nextValue)
      toggleDaySelection(day, nextValue)
    }, 320)
  }

  function handlePointerEnter(day: string) {
    if (!gesture.current.active || gesture.current.mode !== 'select') return
    toggleDaySelection(day, gesture.current.value)
  }

  function handlePointerUp() {
    clearGesture()
  }

  function openDayEditor(day: string) {
    const registro = effectiveMap.get(day) ?? null
    setEditorDay(day)
    setEditorDraft(buildDraft(registro, day, registro?.tipo))
  }

  function changeMonth(step: number) {
    setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() + step, 1))
  }

  async function quickSave(day: string, tipo: RegistroTipo) {
    const registro = effectiveMap.get(day)
    if (registro?.locked || tipo === 'formacao') return
    await onSaveRegistro({ day, ...buildDraft(registro ?? null, day, tipo) })
  }

  async function saveEditor() {
    if (!editorDay || !editorDraft) return
    const registro = effectiveMap.get(editorDay)
    if (registro?.locked) return
    await onSaveRegistro({ day: editorDay, ...editorDraft })
  }

  async function applyBatch() {
    if (selectedDays.length === 0) return
    const editableDays = selectedDays.filter((day) => !effectiveMap.get(day)?.locked)
    if (editableDays.length === 0) return
    await onSaveManyRegistros(editableDays, batchDraft)
    setSelectedDays([])
  }

  return (
    <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Assiduidade</p>
          <h3 className="text-2xl font-semibold text-slate-900">{monthLabel}</h3>
          <p className="mt-1 text-sm text-slate-600">Arraste no desktop ou pressione e segure no celular para selecionar vários dias.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={() => changeMonth(-1)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium">
            Mês anterior
          </button>
          <button type="button" onClick={() => changeMonth(1)} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium">
            Próximo mês
          </button>
          <select
            value={referenceDate.getMonth()}
            onChange={(event) => setReferenceDate(new Date(referenceDate.getFullYear(), Number(event.target.value), 1))}
            className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          >
            {monthNames.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={referenceDate.getFullYear()}
            onChange={(event) => setReferenceDate(new Date(Number(event.target.value), referenceDate.getMonth(), 1))}
            className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-slate-900">Ações em lote</h4>
            <p className="text-sm text-slate-600">Depois de selecionar os dias, aplique presença, falta ou abono de uma vez.</p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            {selectedDays.length} dia(s) selecionado(s)
          </div>
        </div>

        <div className="mt-4">
          <DayEditor draft={batchDraft} onChange={setBatchDraft} />
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={applyBatch}
            disabled={selectedDays.length === 0}
            className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Aplicar aos selecionados
          </button>
          <button
            type="button"
            onClick={() => setSelectedDays([])}
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium"
          >
            Limpar seleção
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {weekDays.map((label) => (
          <div key={label} className="rounded-2xl bg-slate-100 py-3">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {cells.map(({ id, day }) => {
          if (!day) {
            return <div key={id} className="min-h-32 rounded-[24px] bg-slate-50/80 sm:min-h-40" aria-hidden="true" />
          }

          const dateKey = toDateValue(day)
          const registro = effectiveMap.get(dateKey) ?? null
          const isToday = dateKey === todayKey
          const isSelected = selectedDays.includes(dateKey)
          const appearance =
            registro?.tipo ? statusStyles[registro.tipo] : isToday ? 'border-sky-300 bg-sky-50 text-slate-900' : 'border-slate-200 bg-white text-slate-900'

          return (
            <div
              key={dateKey}
              onPointerDown={(event) => handlePointerDown(event, dateKey)}
              onPointerEnter={() => handlePointerEnter(dateKey)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`min-h-36 rounded-[24px] border p-3 transition sm:min-h-44 ${appearance} ${
                isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
              } ${registro?.locked ? 'opacity-95' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm ${
                    isToday ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {registro?.locked ? (
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-700">
                      Congelado
                    </span>
                  ) : null}
                  {isToday ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                      Hoje
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {registro?.tipo === 'presenca'
                    ? 'Presença'
                    : registro?.tipo === 'falta'
                      ? 'Falta'
                      : registro?.tipo === 'abono'
                        ? 'Abono'
                        : registro?.tipo === 'formacao'
                          ? 'Formação'
                          : 'Sem registro'}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-700">{summaryLabel(registro)}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openDayEditor(dateKey)}
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                >
                  Detalhes
                </button>
                <button
                  type="button"
                  disabled={registro?.locked}
                  onClick={() => toggleDaySelection(dateKey)}
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSelected ? 'Selecionado' : 'Selecionar'}
                </button>
                <button
                  type="button"
                  disabled={registro?.locked}
                  onClick={() => quickSave(dateKey, 'presenca')}
                  className="min-h-11 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Presença
                </button>
                <button
                  type="button"
                  disabled={registro?.locked}
                  onClick={() => quickSave(dateKey, 'falta')}
                  className="min-h-11 rounded-2xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Falta
                </button>
                <button
                  type="button"
                  disabled={registro?.locked}
                  onClick={() => quickSave(dateKey, 'abono')}
                  className="min-h-11 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Abono
                </button>
                <button
                  type="button"
                  disabled={registro?.locked}
                  onClick={() => onRemoveRegistro(dateKey)}
                  className="min-h-11 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Limpar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editorDay && editorDraft ? (
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-lg font-semibold text-slate-900">
                Detalhes do dia {new Date(`${editorDay}T00:00:00`).toLocaleDateString('pt-BR')}
              </h4>
              <p className="text-sm text-slate-600">
                {effectiveMap.get(editorDay)?.locked
                  ? 'Este dia está congelado porque foi marcado como formação.'
                  : 'Preencha os detalhes de assiduidade para esse dia.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditorDay(null)}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium"
            >
              Fechar
            </button>
          </div>

          <div className="mt-4">
            <DayEditor draft={editorDraft} disabled={effectiveMap.get(editorDay)?.locked} onChange={setEditorDraft} />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={effectiveMap.get(editorDay)?.locked}
              onClick={saveEditor}
              className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Salvar dia
            </button>
            <button
              type="button"
              disabled={effectiveMap.get(editorDay)?.locked}
              onClick={() => onRemoveRegistro(editorDay)}
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium disabled:opacity-50"
            >
              Remover registro
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
