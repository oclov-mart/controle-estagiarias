import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Registro, RegistroAnexo } from '../types'
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

function buildDraft(registro: EffectiveRegistro | Registro | null, day: string, tipo: 'presenca' | 'falta' = 'presenca'): RegistroDraft {
  const base = registro ?? createEmptyRegistro(day, tipo)

  if (tipo === 'falta') {
    return {
      tipo: 'falta',
      motivo: base.tipo === 'falta' ? base.motivo : null,
      atestado_medico: base.tipo === 'falta' ? base.atestado_medico : false,
      hora_entrada: null,
      hora_saida: null,
      hora_extra: null,
      anexo_atestado: base.tipo === 'falta' ? base.anexo_atestado : null,
    }
  }

  return {
    tipo: 'presenca',
    motivo: null,
    atestado_medico: false,
    hora_entrada: base.tipo === 'presenca' ? base.hora_entrada : null,
    hora_saida: base.tipo === 'presenca' ? base.hora_saida : null,
    hora_extra: base.tipo === 'presenca' ? base.hora_extra : null,
    anexo_atestado: null,
  }
}

async function fileToAttachment(file: File): Promise<RegistroAnexo> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo.'))
    reader.readAsDataURL(file)
  })

  return {
    file_name: file.name,
    mime_type: file.type,
    data_url: dataUrl,
  }
}

function DayDetailModal({
  day,
  draft,
  locked,
  onClose,
  onChange,
  onSave,
  onRemove,
}: {
  day: string
  draft: RegistroDraft
  locked: boolean
  onClose: () => void
  onChange: (next: RegistroDraft) => void
  onSave: () => Promise<void>
  onRemove: () => Promise<void>
}) {
  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const attachment = await fileToAttachment(file)
    onChange({ ...draft, tipo: 'falta', atestado_medico: true, anexo_atestado: attachment })
    event.target.value = ''
  }

  const hasHoraExtra = Boolean(draft.hora_extra)
  const isImage = Boolean(draft.anexo_atestado?.mime_type.startsWith('image/'))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Detalhes do dia</p>
            <h4 className="text-2xl font-semibold text-slate-900">{new Date(`${day}T00:00:00`).toLocaleDateString('pt-BR')}</h4>
          </div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => onChange(buildDraft({ day, locked, ...draft }, day, 'presenca'))}
            className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${draft.tipo === 'presenca' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:opacity-50`}
          >
            Presença
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => onChange(buildDraft({ day, locked, ...draft }, day, 'falta'))}
            className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${draft.tipo === 'falta' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'} disabled:opacity-50`}
          >
            Falta
          </button>
        </div>

        {draft.tipo === 'falta' ? (
          <div className="mt-4 grid gap-4">
            <label className="text-sm font-medium text-slate-700">
              Justificativa
              <input
                disabled={locked}
                value={draft.motivo ?? ''}
                onChange={(event) => onChange({ ...draft, motivo: event.target.value || null })}
                className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
                placeholder="Ex: consulta, indisposição, universidade"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  disabled={locked}
                  type="checkbox"
                  checked={draft.atestado_medico}
                  onChange={(event) => onChange({ ...draft, atestado_medico: event.target.checked, anexo_atestado: event.target.checked ? draft.anexo_atestado : null })}
                />
                Atestado médico
              </label>
              <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
                <input disabled={locked} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
                📎 Anexar atestado
              </label>
            </div>

            {draft.anexo_atestado ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{draft.anexo_atestado.file_name}</p>
                    <p className="text-sm text-slate-500">📎 Atestado anexado</p>
                  </div>
                  <a href={draft.anexo_atestado.data_url} target="_blank" rel="noreferrer" className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    Abrir anexo
                  </a>
                </div>
                {isImage ? <img src={draft.anexo_atestado.data_url} alt="Atestado anexado" className="mt-4 max-h-72 w-full rounded-2xl object-contain" /> : <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">Arquivo em PDF pronto para visualização em nova guia.</div>}
              </div>
            ) : null}
          </div>
        ) : null}

        {draft.tipo === 'presenca' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Hora de entrada
              <input disabled={locked} type="time" value={draft.hora_entrada ?? ''} onChange={(event) => onChange({ ...draft, hora_entrada: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hora de saída
              <input disabled={locked} type="time" value={draft.hora_saida ?? ''} onChange={(event) => onChange({ ...draft, hora_saida: event.target.value || null })} className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base" />
            </label>
            <div className="space-y-3">
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  disabled={locked}
                  type="checkbox"
                  checked={hasHoraExtra}
                  onChange={(event) => onChange({ ...draft, hora_extra: event.target.checked ? draft.hora_extra ?? '00:00' : null })}
                />
                Hora extra
              </label>
              {hasHoraExtra ? (
                <input
                  disabled={locked}
                  inputMode="numeric"
                  value={draft.hora_extra ?? ''}
                  onChange={(event) => onChange({ ...draft, hora_extra: event.target.value || null })}
                  className="min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
                  placeholder="hh:mm"
                  maxLength={5}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={locked} onClick={() => void onSave()} className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            Salvar
          </button>
          <button type="button" disabled={locked} onClick={() => void onRemove()} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-50">
            Limpar status
          </button>
        </div>
      </div>
    </div>
  )
}

export function MonthlyCalendar({ registros, formacaoDays, onSaveRegistro, onRemoveRegistro, onSaveManyRegistros }: MonthlyCalendarProps) {
  const now = new Date()
  const todayKey = toDateValue(now)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gesture = useRef<{ active: boolean; value: boolean; sourceDay: string | null; pointerType: string | null }>({
    active: false,
    value: true,
    sourceDay: null,
    pointerType: null,
  })

  const [referenceDate, setReferenceDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [editorDay, setEditorDay] = useState<string | null>(null)
  const [editorDraft, setEditorDraft] = useState<RegistroDraft | null>(null)
  const [batchDraft, setBatchDraft] = useState<RegistroDraft>(createEmptyRegistro(todayKey, 'presenca'))
  const [batchFeedback, setBatchFeedback] = useState('')

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
    setEditorDraft(buildDraft(registro, editorDay, registro?.tipo === 'falta' ? 'falta' : 'presenca'))
  }, [editorDay, effectiveMap])

  useEffect(() => {
    if (!batchFeedback) return
    const timer = setTimeout(() => setBatchFeedback(''), 2500)
    return () => clearTimeout(timer)
  }, [batchFeedback])

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

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>, day: string) {
    const registro = effectiveMap.get(day)
    if (registro?.locked) return
    const nextValue = !selectedDays.includes(day)
    gesture.current = { active: false, value: nextValue, sourceDay: day, pointerType: event.pointerType }

    if (event.pointerType === 'mouse') return

    holdTimer.current = setTimeout(() => {
      gesture.current = { active: true, value: nextValue, sourceDay: day, pointerType: event.pointerType }
      toggleDaySelection(day, nextValue)
    }, 320)
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
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  function openDayEditor(day: string) {
    const registro = effectiveMap.get(day) ?? null
    setEditorDay(day)
    setEditorDraft(buildDraft(registro, day, registro?.tipo === 'falta' ? 'falta' : 'presenca'))
  }

  async function applyBatch() {
    const editableDays = selectedDays.filter((day) => !effectiveMap.get(day)?.locked)
    if (editableDays.length === 0) return
    await onSaveManyRegistros(editableDays, batchDraft)
    setBatchFeedback(`${editableDays.length} dias atualizados com sucesso.`)
    setSelectedDays([])
  }

  return (
    <section className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700">
          ◀
        </button>
        <h3 className="text-center text-2xl font-semibold text-slate-900">{monthLabel}</h3>
        <button type="button" onClick={() => setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-700">
          ▶
        </button>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">{selectedDays.length} dias selecionados</div>
          {batchFeedback ? <div className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">{batchFeedback}</div> : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button type="button" onClick={() => setBatchDraft(buildDraft({ day: '', locked: false, ...batchDraft }, '', 'presenca'))} className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${batchDraft.tipo === 'presenca' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
            Presença
          </button>
          <button type="button" onClick={() => setBatchDraft(buildDraft({ day: '', locked: false, ...batchDraft }, '', 'falta'))} className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${batchDraft.tipo === 'falta' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
            Falta
          </button>
          <button type="button" onClick={applyBatch} disabled={selectedDays.length === 0} className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            Aplicar aos selecionados
          </button>
        </div>
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
              className={`relative min-h-24 rounded-[24px] border p-2 text-left transition sm:min-h-28 ${isToday ? 'border-sky-300 shadow-[0_0_0_2px_rgba(14,165,233,0.15)]' : 'border-slate-200'} ${registro?.tipo === 'formacao' ? 'bg-[repeating-linear-gradient(135deg,#f5f3ff,#f5f3ff_10px,#ede9fe_10px,#ede9fe_20px)]' : 'bg-white'} ${isSelected ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-200 ring-offset-1' : ''}`}
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
                <div className="text-lg">
                  {registro?.tipo === 'presenca' ? <span className="text-emerald-600">✔️</span> : null}
                  {registro?.tipo === 'falta' ? <span className="text-red-600">❌</span> : null}
                </div>
                <div className="flex items-center gap-1.5">
                  {registro?.tipo === 'formacao' ? <span className="text-[11px] text-violet-500">✦</span> : null}
                  {hasAttachment ? <span className="text-sm text-slate-500">📎</span> : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {editorDay && editorDraft ? (
        <DayDetailModal
          day={editorDay}
          draft={editorDraft}
          locked={Boolean(effectiveMap.get(editorDay)?.locked)}
          onClose={() => setEditorDay(null)}
          onChange={setEditorDraft}
          onSave={async () => {
            await onSaveRegistro({ day: editorDay, ...editorDraft })
            setEditorDay(null)
          }}
          onRemove={async () => {
            await onRemoveRegistro(editorDay)
            setEditorDay(null)
          }}
        />
      ) : null}
    </section>
  )
}
