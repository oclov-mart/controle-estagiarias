import type { Estagiaria, Formacao, Registro, StatusPrazo } from './types'

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
  const registros = ((raw.registros as Array<{ day?: string; data?: string; tipo: Registro['tipo'] }>) ?? []).map(
    (item) => ({
      day: item.day ?? item.data ?? '',
      tipo: item.tipo,
    }),
  )
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
