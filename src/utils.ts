import type { Estagiaria, Formacao, Registro, RegistroTipo, ReportPeriod, ReportRow, StatusPrazo } from './types'

export function capitalizeWords(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ')
}

export function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

export function toDateValue(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function createEmptyRegistro(day: string, tipo: RegistroTipo = 'presenca'): Registro {
  return {
    day,
    tipo,
    motivo: null,
    atestado_medico: false,
    hora_entrada: null,
    hora_saida: null,
    hora_extra: null,
    anexo_atestado: null,
  }
}

export function normalizeRegistro(
  raw: Omit<Partial<Registro>, 'tipo'> & { data?: string; tipo?: Registro['tipo'] | 'extra' | 'abono' },
): Registro {
  const legacyTipo = raw.tipo === 'extra' ? 'presenca' : raw.tipo === 'abono' ? 'falta' : raw.tipo
  const tipo: RegistroTipo = legacyTipo === 'falta' || legacyTipo === 'formacao' ? legacyTipo : 'presenca'

  return {
    ...createEmptyRegistro(raw.day ?? raw.data ?? '', tipo),
    motivo: raw.motivo ?? null,
    atestado_medico: raw.atestado_medico ?? false,
    hora_entrada: raw.hora_entrada ?? null,
    hora_saida: raw.hora_saida ?? null,
    hora_extra: raw.hora_extra ?? null,
    anexo_atestado: raw.anexo_atestado ?? null,
  }
}

export function getInitialLetter(value: string): string {
  return value.trim().charAt(0).toUpperCase() || '?'
}

export function getStatusPrazo(dataLimite: string | null, dataDevolucao: string | null): StatusPrazo {
  if (!dataLimite || dataDevolucao) return 'ok'
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const limite = new Date(`${dataLimite}T00:00:00`)
  const diffMs = limite.getTime() - hoje.getTime()
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  if (diffDias < 0) return 'atrasado'
  if (diffDias <= 2) return 'em_risco'
  return 'ok'
}

export function statusLabel(status: StatusPrazo): string {
  switch (status) {
    case 'atrasado':
      return 'Atrasado'
    case 'em_risco':
      return 'Em risco'
    case 'ok':
      return 'OK'
    default:
      return 'Sem prazo'
  }
}

export function monthDays(referenceDate: Date): Date[] {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, index) => new Date(year, month, index + 1))
}

export function validateDateFlow(payload: {
  data_recebimento: string | null
  data_limite: string | null
  data_devolucao: string | null
}): string | null {
  const { data_recebimento, data_limite, data_devolucao } = payload
  if (data_recebimento && data_limite && data_recebimento > data_limite) {
    return 'Recebimento não pode ser depois da data limite.'
  }
  if (data_limite && data_devolucao && data_devolucao < data_limite) {
    return 'Devolução não pode ser antes da data limite.'
  }
  if (data_recebimento && data_devolucao && data_devolucao < data_recebimento) {
    return 'Devolução não pode ser antes do recebimento.'
  }
  return null
}

export function normalizeEstagiaria(raw: Partial<Estagiaria>): Estagiaria {
  const registros = (
    (raw.registros as Array<Omit<Partial<Registro>, 'tipo'> & { data?: string; tipo?: Registro['tipo'] | 'extra' | 'abono' }>) ??
    []
  ).map(normalizeRegistro)
  const formacoes = (
    (raw.formacoes as Array<{ nome: string; data: string; presente?: boolean; presenca?: boolean }>) ?? []
  ).map(
    (item): Formacao => ({
      nome: item.nome,
      data: item.data,
      presente: item.presente ?? item.presenca ?? false,
    }),
  )
  return {
    id: raw.id ?? '',
    user_id: raw.user_id ?? '',
    nome: raw.nome ?? '',
    email: raw.email ?? null,
    telefone: raw.telefone ?? null,
    faculdade: raw.faculdade ?? '',
    dias_estagio: raw.dias_estagio ?? '',
    observacoes: raw.observacoes ?? null,
    data_recebimento: raw.data_recebimento ?? null,
    data_limite: raw.data_limite ?? null,
    data_devolucao: raw.data_devolucao ?? null,
    registros,
    formacoes,
    created_at: raw.created_at ?? '',
    updated_at: raw.updated_at ?? '',
  }
}

export function parseDurationToMinutes(value: string | null): number {
  if (!value) return 0
  const normalized = value.trim()
  const match = normalized.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 0
  const [, hours, minutes] = match
  return Number(hours) * 60 + Number(minutes)
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function getEffectiveRegistros(estagiaria: Estagiaria): Registro[] {
  const registrosMap = new Map<string, Registro>()

  estagiaria.registros.forEach((registro) => {
    registrosMap.set(registro.day, registro)
  })

  estagiaria.formacoes.forEach((formacao) => {
    registrosMap.set(formacao.data, {
      ...createEmptyRegistro(formacao.data, 'formacao'),
      motivo: formacao.nome,
    })
  })

  return Array.from(registrosMap.values()).sort((a, b) => a.day.localeCompare(b.day))
}

export function getPeriodBounds(referenceDate: Date, period: ReportPeriod): { start: string; end: string } {
  const startMonth = period === 'trimestre' ? Math.floor(referenceDate.getMonth() / 3) * 3 : referenceDate.getMonth()
  const start = new Date(referenceDate.getFullYear(), startMonth, 1)
  const end = period === 'trimestre' ? new Date(referenceDate.getFullYear(), startMonth + 3, 0) : new Date(referenceDate.getFullYear(), startMonth + 1, 0)
  return {
    start: toDateValue(start),
    end: toDateValue(end),
  }
}

export function getMonthlyMetrics(estagiaria: Estagiaria, referenceDate: Date, period: ReportPeriod = 'mes'): {
  presencas: number
  faltas: number
  formacoes: number
  horasExtras: number
} {
  const bounds = getPeriodBounds(referenceDate, period)
  const registros = getEffectiveRegistros(estagiaria).filter((registro) => registro.day >= bounds.start && registro.day <= bounds.end)

  return registros.reduce(
    (acc, registro) => {
      if (registro.tipo === 'presenca') acc.presencas += 1
      if (registro.tipo === 'falta') acc.faltas += 1
      if (registro.tipo === 'formacao') acc.formacoes += 1
      acc.horasExtras += parseDurationToMinutes(registro.hora_extra)
      return acc
    },
    { presencas: 0, faltas: 0, formacoes: 0, horasExtras: 0 },
  )
}

export function buildReportRows(items: Estagiaria[], referenceDate: Date, period: ReportPeriod = 'mes'): ReportRow[] {
  return items.map((item) => {
    const metrics = getMonthlyMetrics(item, referenceDate, period)
    return {
      id: item.id,
      nome: item.nome,
      faculdade: item.faculdade,
      dias_estagio: item.dias_estagio,
      presencas: metrics.presencas,
      faltas: metrics.faltas,
      horas_extras: formatMinutes(metrics.horasExtras),
      ultimo_prazo: formatDate(item.data_limite),
      status: statusLabel(getStatusPrazo(item.data_limite, item.data_devolucao)),
    }
  })
}

export function getMonthRangeLabel(referenceDate: Date): string {
  return referenceDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function getPeriodLabel(referenceDate: Date, period: ReportPeriod): string {
  if (period === 'trimestre') {
    const quarter = Math.floor(referenceDate.getMonth() / 3) + 1
    return `${quarter}º trimestre de ${referenceDate.getFullYear()}`
  }
  return getMonthRangeLabel(referenceDate)
}

export function buildReportLink(origin: string, ids: string[], referenceDate: Date, period: ReportPeriod = 'mes'): string {
  const url = new URL('/relatorio', origin)
  url.searchParams.set('month', String(referenceDate.getMonth() + 1))
  url.searchParams.set('year', String(referenceDate.getFullYear()))
  url.searchParams.set('period', period)
  if (ids.length > 0) {
    url.searchParams.set('ids', ids.join(','))
  }
  return url.toString()
}
