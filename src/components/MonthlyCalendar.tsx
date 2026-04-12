import { useEffect, useMemo, useState } from 'react'
import type { Registro, RegistroTipo } from '../types'
import { createEmptyRegistro, monthDays, toDateValue } from '../utils'

type RegistroDraft = Omit<Registro, 'day'>

type MonthlyCalendarProps = {
  registros: Registro[]
  onSaveRegistro: (registro: Registro) => Promise<void>
  onRemoveRegistro: (day: string) => Promise<void>
  onSaveManyRegistros: (days: string[], draft: RegistroDraft) => Promise<void>
}

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function toDraft(registro: Registro | null, day: string, tipo?: RegistroTipo): RegistroDraft {
  const base = registro ?? createEmptyRegistro(day, tipo ?? 'presenca')
  if ((tipo ?? base.tipo) === 'falta') {
    return {
      tipo: 'falta',
      motivo: base.tipo === 'falta' ? base.motivo : null,
      atestado_medico: base.tipo === 'falta' ? base.atestado_medico : false,
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

function registroSummary(registro: Registro | null): string {
  if (!registro) return 'Sem registro'
  if (registro.tipo === 'falta') {
    if (registro.motivo) return registro.motivo
    return registro.atestado_medico ? 'Falta com atestado' : 'Falta'
  }

  if (registro.hora_extra) return `Extra: ${registro.hora_extra}`
  if (registro.hora_entrada && registro.hora_saida) return `${registro.hora_entrada} - ${registro.hora_saida}`
  return 'Presença'
}

function RegistroFields({
  draft,
  onChange,
}: {
  draft: RegistroDraft
  onChange: (next: RegistroDraft) => void
}) {
  function setTipo(tipo: RegistroTipo) {
    onChange({
      tipo,
      motivo: tipo === 'falta' ? draft.motivo : null,
      atestado_medico: tipo === 'falta' ? draft.atestado_medico : false,
      hora_entrada: tipo === 'presenca' ? draft.hora_entrada : null,
      hora_saida: tipo === 'presenca' ? draft.hora_saida : null,
      hora_extra: tipo === 'presenca' ? draft.hora_extra : null,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setTipo('presenca')}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
            draft.tipo === 'presenca'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          Presença
        </button>
        <button
          type="button"
          onClick={() => setTipo('falta')}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
            draft.tipo === 'falta' ? 'border-red-300 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600'
          }`}
        >
          Falta
        </button>
      </div>

      {draft.tipo === 'falta' ? (
        <>
          <label className="block text-sm">
            Motivo da falta
            <input
              value={draft.motivo ?? ''}
              onChange={(event) => onChange({ ...draft, motivo: event.target.value || null })}
              placeholder="Ex: consulta, faculdade, indisposição"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.atestado_medico}
              onChange={(event) => onChange({ ...draft, atestado_medico: event.target.checked })}
            />
            Tem atestado médico
          </label>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Hora de entrada
            <input
              type="time"
              value={draft.hora_entrada ?? ''}
              onChange={(event) => onChange({ ...draft, hora_entrada: event.target.value || null })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Hora de saída
            <input
              type="time"
              value={draft.hora_saida ?? ''}
              onChange={(event) => onChange({ ...draft, hora_saida: event.target.value || null })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            Hora extra
            <input
              value={draft.hora_extra ?? ''}
              onChange={(event) => onChange({ ...draft, hora_extra: event.target.value || null })}
              placeholder="Ex: 01:30"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
      )}
    </div>
  )
}

export function MonthlyCalendar({ registros, onSaveRegistro, onRemoveRegistro, onSaveManyRegistros }: MonthlyCalendarProps) {
  const now = new Date()
  const [referenceDate, setReferenceDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [editorDay, setEditorDay] = useState<string | null>(null)
  const [editorDraft, setEditorDraft] = useState<RegistroDraft | null>(null)
  const [batchDraft, setBatchDraft] = useState<RegistroDraft>(createEmptyRegistro(toDateValue(now), 'presenca'))

  const registrosMap = useMemo(() => new Map(registros.map((registro) => [registro.day, registro])), [registros])
  const days = monthDays(referenceDate)
  const firstDayOfMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7
  const monthLabel = `${monthNames[referenceDate.getMonth()]} ${referenceDate.getFullYear()}`
  const yearOptions = Array.from({ length: 7 }, (_, index) => now.getFullYear() - 3 + index)
  const cells = [
    ...Array.from({ length: startOffset }, (_, index) => ({ id: `empty-start-${index}`, day: null as Date | null })),
    ...days.map((day) => ({ id: toDateValue(day), day })),
  ]

  while (cells.length % 7 !== 0) {
    cells.push({ id: `empty-end-${cells.length}`, day: null })
  }

  useEffect(() => {
    if (!editorDay) return
    const current = registrosMap.get(editorDay) ?? null
    setEditorDraft(toDraft(current, editorDay, current?.tipo))
  }, [editorDay, registrosMap])

  function changeMonth(step: number) {
    setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() + step, 1))
  }

  function openDayEditor(day: string) {
    const current = registrosMap.get(day) ?? null
    setEditorDay(day)
    setEditorDraft(toDraft(current, day, current?.tipo))
  }

  function toggleDaySelection(day: string) {
    setSelectedDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]))
  }

  async function quickSave(day: string, tipo: RegistroTipo) {
    const current = registrosMap.get(day) ?? null
    await onSaveRegistro({ day, ...toDraft(current, day, tipo) })
  }

  async function saveEditor() {
    if (!editorDay || !editorDraft) return
    await onSaveRegistro({ day: editorDay, ...editorDraft })
  }

  async function applyBatch() {
    if (selectedDays.length === 0) return
    await onSaveManyRegistros(selectedDays, batchDraft)
    setSelectedDays([])
  }

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Calendário</p>
          <h3 className="text-xl font-semibold text-slate-900">{monthLabel}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => changeMonth(-1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Mês anterior
          </button>
          <select
            value={referenceDate.getMonth()}
            onChange={(event) => setReferenceDate(new Date(referenceDate.getFullYear(), Number(event.target.value), 1))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => changeMonth(1)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
            Próximo mês
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold text-slate-900">Marcação em lote</h4>
            <p className="text-sm text-slate-600">
              Selecione vários dias no calendário e aplique falta ou presença de uma vez.
            </p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
            {selectedDays.length} dia(s) selecionado(s)
          </span>
        </div>
        <div className="mt-3">
          <RegistroFields draft={batchDraft} onChange={setBatchDraft} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyBatch}
            disabled={selectedDays.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Aplicar aos selecionados
          </button>
          <button
            type="button"
            onClick={() => setSelectedDays([])}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
          >
            Limpar seleção
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {weekDays.map((label) => (
          <div key={label} className="rounded-xl bg-slate-100/80 py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {cells.map(({ id, day }) => {
          if (!day) {
            return <div key={id} className="min-h-32 rounded-2xl bg-slate-50/70" aria-hidden="true" />
          }

          const dateKey = toDateValue(day)
          const registro = registrosMap.get(dateKey) ?? null
          const isToday = dateKey === toDateValue(now)
          const isSelected = selectedDays.includes(dateKey)
          const cellClass =
            registro?.tipo === 'falta'
              ? 'border-red-200 bg-red-50'
              : registro?.tipo === 'presenca'
                ? 'border-emerald-200 bg-emerald-50'
                : isToday
                  ? 'border-sky-200 bg-sky-50'
                  : 'border-slate-200 bg-white'

          return (
            <div key={dateKey} className={`rounded-2xl border p-2 ${cellClass}`}>
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openDayEditor(dateKey)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-semibold text-slate-900 shadow-sm"
                >
                  {day.getDate()}
                </button>
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <input type="checkbox" checked={isSelected} onChange={() => toggleDaySelection(dateKey)} />
                  Lote
                </label>
              </div>

              <button type="button" onClick={() => openDayEditor(dateKey)} className="mt-2 block w-full text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {registro?.tipo === 'falta' ? 'Falta' : registro?.tipo === 'presenca' ? 'Presença' : 'Sem registro'}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-slate-700">{registroSummary(registro)}</p>
              </button>

              <div className="mt-3 grid grid-cols-3 gap-1 text-xs font-semibold">
                <button
                  className="rounded-xl border border-red-200 bg-white px-1 py-2 text-red-700 transition hover:bg-red-50"
                  onClick={() => quickSave(dateKey, 'falta')}
                  type="button"
                >
                  Falta
                </button>
                <button
                  className="rounded-xl border border-emerald-200 bg-white px-1 py-2 text-emerald-700 transition hover:bg-emerald-50"
                  onClick={() => quickSave(dateKey, 'presenca')}
                  type="button"
                >
                  Presença
                </button>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-1 py-2 text-slate-600 transition hover:bg-slate-100"
                  onClick={() => onRemoveRegistro(dateKey)}
                  type="button"
                >
                  Limpar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {editorDay && editorDraft ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-slate-900">Detalhes do dia {new Date(`${editorDay}T00:00:00`).toLocaleDateString('pt-BR')}</h4>
              <p className="text-sm text-slate-600">Registre motivo da falta ou horário da presença.</p>
            </div>
            <button type="button" onClick={() => setEditorDay(null)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              Fechar
            </button>
          </div>
          <div className="mt-3">
            <RegistroFields draft={editorDraft} onChange={setEditorDraft} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={saveEditor} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Salvar dia
            </button>
            <button
              type="button"
              onClick={() => onRemoveRegistro(editorDay)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
            >
              Remover registro
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
