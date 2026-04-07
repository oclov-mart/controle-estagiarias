# Sistema de Controle de Estagiárias

Sistema web operacional para professor supervisionar estagiárias com autenticação, prazos, faltas/extra, formações e sincronização cross-device via Supabase.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- Supabase (Auth, Postgres, Realtime)
- Deploy: Vercel

## Funcionalidades implementadas

- Login com email/senha (Supabase Auth)
- Sessão persistente
- Dashboard com filtros e status colorido (`Atrasado`, `Em risco`, `OK`)
- Ordenação alfabética por nome
- Destaque de próximo prazo
- CRUD completo de estagiárias
- Calendário de 30 dias para faltas e horas extras
- Formações com presença por checkboxes
- Observações editáveis
- Realtime para refletir mudanças entre dispositivos
- RLS por usuário e trigger `updated_at`

## Estrutura principal de arquivos

- `src/App.tsx`
- `src/lib/supabase.ts`
- `src/hooks/useAuth.tsx`
- `src/pages/DashboardPage.tsx`
- `src/pages/InternDetailsPage.tsx`
- `src/components/LoginForm.tsx`
- `src/components/InternForm.tsx`
- `src/components/MonthlyCalendar.tsx`
- `src/types.ts`
- `src/utils.ts`
- `src/index.css`
- `vite.config.ts`
- `supabase/schema.sql`
- `.env.example`

## Como rodar localmente

1. Instale as dependências:

```bash
npm install
```

2. Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

3. Execute:

```bash
npm run dev
```

4. Build de produção:

```bash
npm run build
```

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Em `Authentication > Providers`, mantenha Email habilitado.
3. Em `SQL Editor`, execute `supabase/schema.sql`.
4. Crie usuários (Auth) para testar login.

## Deploy na Vercel

1. Suba o projeto para GitHub.
2. Importe o repositório na Vercel.
3. Configure as variáveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy com comando padrão: `npm run build`.

## Segurança

- RLS ativo na tabela `estagiarias`.
- Políticas de `select/insert/update/delete` bloqueiam acesso entre usuários.
- Cada usuário vê apenas seus próprios dados (`user_id = auth.uid()`).
