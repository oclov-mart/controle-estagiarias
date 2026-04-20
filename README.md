controle-estagiarias 📋
Sistema para gerenciamento de estagiárias com foco em UX e produtividade.

📸 Interface do Sistema
<div align="center">
<img src="./Pagina de Login.png" width="400px" alt="Login" />
<img src="./Interface Principal.png" width="400px" alt="Dashboard" />
</div>

<p align="center">
<a href="./showcase.html"><strong>Ver Apresentação Detalhada</strong></a>
</p>

Este projeto nasceu de uma necessidade real: tirar o controle de prazos e faltas do papel (ou de planilhas confusas) e colocar em um sistema que realmente ajude na supervisão. É uma ferramenta pensada para professores que precisam gerenciar múltiplas estagiárias sem perder o fio da meada.

Fiz esse app para colocar em prática o que estou aprendendo na faculdade, saindo da teoria e indo para algo funcional que usa banco de dados real e autenticação.

### Por que essas tecnologias?
* **React + Vite:** Para ter um dashboard rápido e que não engasga.
* **TypeScript:** Decidi usar aqui para não ficar maluco com erro de "undefined" no meio do código. A tipagem salvou muito tempo de debug.
* **Supabase:** Usei para resolver o backend sem precisar montar uma API do zero, aproveitando o Auth e o Realtime (se eu mudar algo no PC, atualiza no celular na hora).
* **Tailwind:** Para o visual não parecer algo saído de 1998, sem gastar horas escrevendo CSS puro.

### O que o sistema já faz:
* **Dashboard "Sem Susto":** Status coloridos para saber quem está com prazo atrasado ou em risco logo de cara.
* **Gestão de Prazos:** Foco total em não deixar nenhuma entrega passar.
* **Calendário de Faltas/Horas:** Um controle de 30 dias simples de marcar.
* **Segurança:** Cada professor só vê os seus próprios dados. Nada de dados cruzados.

### Como subir o projeto:
1. Instala tudo com `npm install`.
2. Cria um arquivo `.env` seguindo o exemplo do `.env.example` com suas chaves do Supabase.
3. Roda o script que está em `supabase/schema.sql` lá no editor do seu projeto Supabase.
4. Dá um `npm run dev` e pronto.
