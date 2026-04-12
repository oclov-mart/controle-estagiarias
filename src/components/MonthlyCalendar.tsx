import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { Registro, RegistroAnexo, RegistroTipo } from '../types'
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

const dotStyles: Record<RegistroTipo, string> = {
  presenca: 'bg-emerald-500',
  falta: 'bg-red-500',
  abono: 'bg-amber-400',
  formacao: 'bg-slate-400',
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
      anexo_atestado: base.tipo === 'falta' ? base.anexo_atestado : null,
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
      anexo_atestado: null,
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

function statusLabel(tipo: RegistroTipo | null): string {
  switch (tipo) {
    case 'presenca':
      return 'Presença'
    case 'falta':
      return 'Falta'
    case 'abono':
      return 'Abono'
    case 'formacao':
      return 'Formação'
    default:
      return 'Sem registro'
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
    onChange({ ...draft, atestado_medico: true, anexo_atestado: attachment, tipo: 'falta' })
    event.target.value = ''
  }

  const isImage = Boolean(draft.anexo_atestado?.mime_type.startsWith('image/'))

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[28px] bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Detalhes do dia</p>
            <h4 className="text-2xl font-semibold text-slate-900">{new Date(`${day}T00:00:00`).toLocaleDateString('pt-BR')}</h4>
            <p className="mt-1 text-sm text-slate-600">
              {locked ? 'Dia vinculado a formação. Consulta liberada, edição manual bloqueada.' : 'Edite horários, observações e anexo de atestado neste painel.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
            Fechar
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {(['presenca', 'falta', 'abono'] as RegistroTipo[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              disabled={locked}
              onClick={() => onChange(buildDraft({ day, locked, ...draft }, day, tipo))}
              className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                draft.tipo === tipo ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {statusLabel(tipo)}
            </button>
          ))}
        </div>

        {(draft.tipo === 'falta' || draft.tipo === 'abono') && (
          <div className="mt-4 grid gap-4">
            <label className="text-sm font-medium text-slate-700">
              Motivo
              <input
                disabled={locked}
                value={draft.motivo ?? ''}
                onChange={(event) => onChange({ ...draft, motivo: event.target.value || null })}
                className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
                placeholder={draft.tipo === 'abono' ? 'Ex: folga compensada, autorização' : 'Ex: consulta, indisposição, universidade'}
              />
            </label>

            {draft.tipo === 'falta' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    disabled={locked}
                    type="checkbox"
                    checked={draft.atestado_medico}
                    onChange={(event) => onChange({ ...draft, atestado_medico: event.target.checked })}
                  />
                  Possui atestado médico
                </label>
                <label className="flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
                  <input disabled={locked} type="file" accept="application/pdf,image/*" className="hidden" onChange={handleFileChange} />
                  Anexar PDF ou imagem
                </label>
              </div>
            )}

            {draft.anexo_atestado ? (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{draft.anexo_atestado.file_name}</p>
                    <p className="text-sm text-slate-500">Pré-visualização do atestado</p>
                  </div>
                  <a
                    href={draft.anexo_atestado.data_url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-11 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    Abrir anexo
                  </a>
                </div>
                {isImage ? (
                  <img src={draft.anexo_atestado.data_url} alt="Atestado anexado" className="mt-4 max-h-72 w-full rounded-2xl object-contain" />
                ) : (
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">Arquivo em PDF pronto para visualização em nova guia.</div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {draft.tipo === 'presenca' && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Hora de entrada
              <input
                disabled={locked}
                type="time"
                value={draft.hora_entrada ?? ''}
                onChange={(event) => onChange({ ...draft, hora_entrada: event.target.value || null })}
                className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hora de saída
              <input
                disabled={locked}
                type="time"
                value={draft.hora_saida ?? ''}
                onChange={(event) => onChange({ ...draft, hora_saida: event.target.value || null })}
                className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Hora extra
              <input
                disabled={locked}
                value={draft.hora_extra ?? ''}
                onChange={(event) => onChange({ ...draft, hora_extra: event.target.value || null })}
                className="mt-1 min-h-12 w-full rounded-2xl border border-slate-200 px-4 py-3 text-base"
                placeholder="Ex: 01:30"
              />
            </label>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={locked}
            onClick={() => void onSave()}
            className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => void onRemove()}
            className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Remover registro
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
  const gesture = useRef<{ active: boolean; value: boolean }>({ active: false, value: true })

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

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, day: string) {
    const registro = effectiveMap.get(day)
    if (registro?.locked) return
    const nextValue = !selectedDays.includes(day)

    if (event.pointerType === 'mouse') {
      gesture.current = { active: true, value: nextValue }
      toggleDaySelection(day, nextValue)
      return
    }

    holdTimer.current = setTimeout(() => {
      gesture.current = { active: true, value: nextValue }
      toggleDaySelection(day, nextValue)
    }, 320)
  }

  function handlePointerEnter(day: string) {
    if (!gesture.current.active) return
    toggleDaySelection(day, gesture.current.value)
  }

  function resetPointerState() {
    gesture.current = { active: false, value: true }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }

  function openDayEditor(day: string) {
    const registro = effectiveMap.get(day) ?? null
    setEditorDay(day)
    setEditorDraft(buildDraft(registro, day, registro?.tipo))
  }

  async function applyBatch() {
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
          <p className="mt-1 text-sm text-slate-600">Cores e ícones mostram o status do mês. Toque no dia para abrir os detalhes.</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={() => setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium">
            Mês anterior
          </button>
          <button type="button" onClick={() => setReferenceDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium">
            Próximo mês
          </button>
          <select value={referenceDate.getMonth()} onChange={(event) => setReferenceDate(new Date(referenceDate.getFullYear(), Number(event.target.value), 1))} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            {monthNames.map((label, index) => (
              <option key={label} value={index}>{label}</option>
            ))}
          </select>
          <select value={referenceDate.getFullYear()} onChange={(event) => setReferenceDate(new Date(Number(event.target.value), referenceDate.getMonth(), 1))} className="min-h-12 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            {yearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-slate-900">Ações em lote</h4>
            <p className="text-sm text-slate-600">Selecione vários dias e aplique rapidamente presença, falta ou abono.</p>
          </div>
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700">{selectedDays.length} dia(s) selecionado(s)</div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(['presenca', 'falta', 'abono'] as RegistroTipo[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => setBatchDraft(buildDraft({ day: '', locked: false, ...batchDraft }, '', tipo))}
              className={`min-h-12 rounded-2xl border px-4 py-3 text-sm font-semibold ${batchDraft.tipo === tipo ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700'}`}
            >
              {statusLabel(tipo)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={applyBatch} disabled={selectedDays.length === 0} className="min-h-12 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
            Aplicar aos selecionados
          </button>
          <button type="button" onClick={() => setSelectedDays([])} className="min-h-12 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium">
            Limpar seleção
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
          const hasAttachment = Boolean(registro?.anexo_atestado)
          const hasMedical = Boolean(registro?.atestado_medico)

          return (
            <button
              key={dateKey}
              type="button"
              onPointerDown={(event) => handlePointerDown(event, dateKey)}
              onPointerEnter={() => handlePointerEnter(dateKey)}
              onPointerUp={resetPointerState}
              onPointerCancel={resetPointerState}
              onClick={() => openDayEditor(dateKey)}
              className={`relative min-h-24 rounded-[24px] border p-2 text-left transition sm:min-h-28 ${
                isToday ? 'border-sky-300 shadow-[0_0_0_2px_rgba(14,165,233,0.15)]' : 'border-slate-200'
              } ${registro?.tipo === 'formacao' ? 'bg-[repeating-linear-gradient(135deg,#f5f3ff,#f5f3ff_10px,#ede9fe_10px,#ede9fe_20px)]' : 'bg-white'} ${
                isSelected ? 'ring-2 ring-slate-900 ring-offset-2' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  {day.getDate()}
                </span>
                <div className="flex items-center gap-1">
                  {registro ? <span className={`h-3 w-3 rounded-full ${dotStyles[registro.tipo]}`} /> : null}
                  {hasAttachment ? <span className="text-xs text-slate-600">📎</span> : null}
                  {hasMedical && !hasAttachment ? <span className="text-xs text-red-500">✚</span> : null}
                </div>
              </div>

              <div className="mt-3 flex min-h-8 items-end justify-between">
                <div className="flex items-center gap-1">
                  {registro?.tipo ? <span className={`h-2.5 w-2.5 rounded-full ${dotStyles[registro.tipo]}`} /> : <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />}
                  <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{registro ? statusLabel(registro.tipo) : 'Livre'}</span>
                </div>
                {registro?.tipo === 'formacao' ? <span className="text-[10px] text-slate-400">✦</span> : null}
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        <div className="flex flex-wrap gap-4">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Presença</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" /> Falta</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> Abono</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-400" /> Formação</span>
          <span className="inline-flex items-center gap-2">📎 Atestado anexado</span>
        </div>
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
