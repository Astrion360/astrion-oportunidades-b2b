# Astrion — Gestão de Oportunidades B2B

Aplicação web estática, responsiva e pronta para GitHub Pages, com banco compartilhado, autenticação e regras de acesso pelo Supabase.

> **Status:** o projeto `Astrion360's Project` já está configurado, protegido e conectado no arquivo `config.js`. Para a publicação atual da Astrion, não é necessário criar outro banco nem copiar chaves.

## O que já está incluído

- cadastro detalhado de oportunidades B2B e B2B2C;
- pipeline em Kanban, com movimentação entre etapas;
- visão executiva com pipeline potencial e ponderado;
- prioridade, probabilidade, responsável e previsão de fechamento;
- controle de próxima ação, reunião e compromissos atrasados;
- agenda mensal consolidada;
- cadastro de atividades e histórico automático de alterações;
- busca e filtros por prioridade, responsável e status;
- exportação da carteira em CSV;
- gestão de usuários e três níveis de acesso;
- layout responsivo para computador, tablet e celular;
- modo de demonstração local para avaliação antes da conexão;
- segurança por registro com Row Level Security (RLS).

## Perfis de acesso

| Perfil | Permissões |
| --- | --- |
| Administrador | Acesso total, gestão da equipe, edição e exclusão. |
| Gestor comercial | Visualiza e conduz toda a carteira, pipeline, agenda e atividades. |
| Cadastrador | Cadastra oportunidades e acompanha somente as próprias indicações. |

O primeiro usuário criado depois da instalação da estrutura torna-se administrador. Os demais entram automaticamente como cadastradores. O administrador pode promover usuários pela tela **Equipe e acessos**.

## Arquivos

| Arquivo | Finalidade |
| --- | --- |
| `index.html` | Estrutura da aplicação. |
| `styles.css` | Identidade visual e responsividade. |
| `app.js` | Regras, telas, filtros, agenda e comunicação com a base. |
| `config.js` | URL e chave pública do Supabase. |
| `supabase-schema.sql` | Banco, histórico, perfis e políticas de segurança. |
| `.nojekyll` | Publicação direta dos arquivos estáticos no GitHub Pages. |

## 1. Testar imediatamente

Abra `index.html` no navegador. Sem configuração, a aplicação entra em **modo demonstração** e salva alterações somente no navegador atual.

Esse modo serve para avaliar telas e fluxos. Ele não compartilha dados entre pessoas.

## 2. Supabase já configurado

A estrutura da Astrion já contém:

- quatro tabelas operacionais;
- onze políticas de acesso por usuário;
- quatro gatilhos de cadastro, atualização e auditoria;
- Row Level Security habilitado em todas as tabelas públicas;
- nenhuma função privilegiada exposta publicamente;
- URL e chave pública conectadas em `config.js`.

As instruções abaixo só serão necessárias se a Astrion decidir migrar a ferramenta para outro projeto Supabase no futuro.

### Migrar para outro projeto

1. Acesse [database.new](https://database.new) e crie um projeto da Astrion.
2. No painel do projeto, abra **SQL Editor**.
3. Crie uma nova consulta, cole todo o conteúdo de `supabase-schema.sql` e execute.
4. Confirme que a consulta final mostra quatro tabelas com `rowsecurity = true`.
5. Em **Project Settings → API**, copie:
   - Project URL;
   - chave pública `publishable` ou, em projetos antigos, a chave `anon`.
6. Abra `config.js` e preencha:

```js
window.ASTRION_CONFIG = {
  supabaseUrl: "https://SEU-PROJETO.supabase.co",
  supabasePublishableKey: "SUA_CHAVE_PUBLICA",
  appName: "Astrion | Oportunidades B2B"
};
```

Não use `service_role`, `secret key` nem a senha do banco no navegador ou no GitHub. A chave pública foi criada para uso no front-end; a segurança dos dados depende das políticas RLS incluídas no projeto.

Documentação oficial: [Supabase Auth](https://supabase.com/docs/guides/auth), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) e [segurança da API](https://supabase.com/docs/guides/api/securing-your-api).

## 3. Ajustar autenticação depois da publicação

No Supabase, acesse **Authentication → URL Configuration**:

- em **Site URL**, informe o endereço final do GitHub Pages;
- em **Redirect URLs**, inclua o mesmo endereço com `/**` ao final.

Exemplo:

```text
https://seuusuario.github.io/astrion-oportunidades-b2b/
https://seuusuario.github.io/astrion-oportunidades-b2b/**
```

Em **Authentication → Providers → Email**, escolha se deseja exigir confirmação de e-mail. Para uma operação controlada, mantenha a confirmação ativada.

## 4. Publicar no GitHub Pages

1. Crie um repositório, por exemplo `astrion-oportunidades-b2b`.
2. Envie todos os arquivos deste pacote para a raiz do repositório.
3. No repositório, abra **Settings → Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main`, a pasta `/ (root)` e salve.
6. Aguarde o endereço publicado aparecer na mesma tela.

O GitHub Pages publica HTML, CSS e JavaScript diretamente. Guia oficial: [Configurar uma fonte de publicação](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 5. Criar o primeiro acesso

1. Abra a ferramenta já publicada.
2. Clique em **Ainda não tenho acesso**.
3. Cadastre o e-mail do administrador.
4. Confirme o e-mail, se solicitado.
5. Entre novamente. Como primeiro usuário, esse acesso será administrador.
6. Compartilhe o mesmo link com os cadastradores. Cada um cria seu próprio acesso e entra inicialmente como **Cadastrador**.

## Checklist antes do uso real

- [ ] O modo demonstração desapareceu e o rodapé mostra **Base compartilhada**.
- [ ] O primeiro acesso possui o perfil **Administrador**.
- [ ] Um usuário cadastrador consegue criar uma oportunidade.
- [ ] O cadastrador não visualiza oportunidades de outras pessoas.
- [ ] O administrador visualiza a nova oportunidade no pipeline.
- [ ] A mudança de status aparece no histórico.
- [ ] A próxima ação aparece na agenda.
- [ ] A exportação CSV abre corretamente no Excel.
- [ ] O endereço do GitHub Pages foi incluído nas URLs de autenticação.

## Evoluções recomendadas

- integração com Google Calendar;
- notificações por e-mail ou WhatsApp para ações vencidas;
- anexos no Supabase Storage;
- painel de metas por responsável;
- relatório de conversão por origem, segmento e solução;
- integração com CRM, quando a operação crescer.

---

**Astrion Assessoria**  
Experiência que entende. Estratégia que transforma.


## Modelo econômico

O CRM possui uma camada executiva de modelagem econômica padronizada. Para oportunidades de consórcios, todas as premissas operacionais, comerciais, tributárias e de portfólio são mantidas; o único input econômico que varia por parceiro é a quantidade de clientes.

O modelo considera 120 meses de novas vendas, capacidade de 50 operadores, 250 clientes tratados por operador/mês, ramp-up de 6 meses, conversão de 1,75%, sazonalidade, mix de portfólio, reajuste nominal de 4,5% a.a., remuneração Astrion de 0,25%, tributação, custos e run-off integral.

Ouribank permanece segregado por utilizar BP próprio de administradora de consórcios.

