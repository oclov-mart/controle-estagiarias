export type RegistroTipo = 'falta' | 'presenca'

export type Registro = {
  // Dia no formato YYYY-MM-DD.
  day: string
  tipo: RegistroTipo
  motivo: string | null
  atestado_medico: boolean
  hora_entrada: string | null
  hora_saida: string | null
  hora_extra: string | null
}

export type Formacao = {
  nome: string
  data: string
  presente: boolean
}

export type Estagiaria = {
  id: string
  user_id: string
  nome: string
  faculdade: string
  dias_estagio: string
  observacoes: string | null
  data_recebimento: string | null
  data_limite: string | null
  data_devolucao: string | null
  registros: Registro[]
  formacoes: Formacao[]
  created_at: string
  updated_at: string
}

export type StatusPrazo = 'atrasado' | 'em_risco' | 'ok' | 'sem_prazo'
