const CONFIG = window.ASTRION_CONFIG || {};

const STATUSES = [
  { value: "Nova", color: "#3b75ff", probability: 10 },
  { value: "Qualificação", color: "#12b9d5", probability: 20 },
  { value: "Diagnóstico", color: "#7a5af8", probability: 35 },
  { value: "Proposta", color: "#f79009", probability: 50 },
  { value: "Negociação", color: "#ee5f2a", probability: 70 },
  { value: "Jurídico / Compliance", color: "#ab47bc", probability: 85 },
  { value: "Implantação", color: "#079455", probability: 95 },
  { value: "Ganha", color: "#05603a", probability: 100 },
  { value: "Pausada", color: "#98a2b3", probability: 25 },
  { value: "Perdida", color: "#d92d20", probability: 0 }
];

const ACTIVE_STATUSES = STATUSES.filter(s => !["Ganha", "Perdida", "Pausada"].includes(s.value));
const ROLE_LABELS = { admin: "Administrador", collaborator: "Gestor comercial", submitter: "Cadastrador" };
const STORAGE_KEY = "astrion_b2b_demo_v1";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const number = new Intl.NumberFormat("pt-BR");

const state = {
  online: false,
  supabase: null,
  currentUser: null,
  profile: null,
  profiles: [],
  opportunities: [],
  activities: [],
  history: [],
  accessAllowlist: [],
  view: "dashboard",
  search: "",
  priority: "",
  owner: "",
  status: "",
  calendarCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: null,
  authMode: "login"
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const toISO = value => value ? new Date(value).toISOString() : null;
const toLocalInput = value => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};
const dateKey = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const parseDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
const formatDate = (value, options = {}) => value ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: options.year ? "numeric" : undefined, hour: options.time ? "2-digit" : undefined, minute: options.time ? "2-digit" : undefined }).format(parseDate(value)).replace(" de ", " ") : "A definir";
const initials = value => String(value || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
const roleIsManager = () => state.profile?.active !== false && ["admin", "collaborator"].includes(state.profile?.role);
const roleIsAdmin = () => state.profile?.active !== false && state.profile?.role === "admin";
const statusMeta = status => STATUSES.find(item => item.value === status) || STATUSES[0];
const isClosed = opportunity => ["Ganha", "Perdida"].includes(opportunity.status);
const isOverdue = opportunity => opportunity.next_action_date && new Date(opportunity.next_action_date) < new Date() && !isClosed(opportunity);
const ownerFor = id => state.profiles.find(profile => profile.id === id);
const ownerName = id => ownerFor(id)?.full_name || (id ? "Usuário" : "A definir");
const money = value => value === null || value === undefined || value === "" ? "—" : currency.format(Number(value));
const normalizeCNPJ = value => { const digits = String(value || "").replace(/\\D/g, "").slice(0, 14); return digits.length === 14 ? digits.replace(/^(\\d{2})(\\d{3})(\\d{3})(\\d{4})(\\d{2})$/, "$1.$2.$3/$4-$5") : digits; };
const safeHttpUrl = value => { if (!value) return null; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } };
const strongPassword = value => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(value);

function demoSeed() {
  const now = new Date();
  const addDays = days => new Date(now.getTime() + days * 86400000).toISOString();
  const profiles = [
    { id: "demo-admin", full_name: "Wellington Mendes", email: "wellington@astrion.com.br", role: "admin", active: true },
    { id: "demo-collab", full_name: "Jayme Akito", email: "jayme@astrion.com.br", role: "collaborator", active: true },
    { id: "demo-source", full_name: "Parceiro Indicador", email: "parceiro@empresa.com", role: "submitter", active: true }
  ];
  const opportunities = [
    { id: "opp-1", company: "Banco Aurora", segment: "Serviços financeiros", channel: "B2B2C", source: "Relacionamento direto", contact_name: "Marina Alves", contact_role: "Diretora de Produtos", contact_email: "marina@exemplo.com", contact_phone: "+55 11 99999-1001", summary: "Estruturar uma operação white label de consórcios para a base de clientes do banco.", particularities: "Necessidade de integração por API, esteira de compliance e definição de exclusividade.", interests: ["Consórcios", "Seguros"], potential_revenue: 1800000, expected_sales: 120000000, client_base: 850000, status: "Negociação", priority: "Alta", probability: 70, owner_id: "demo-admin", next_action: "Validar premissas econômicas com a administradora", next_action_date: addDays(1), meeting_date: addDays(4), expected_close_date: addDays(38).slice(0,10), document_link: "", created_by: "demo-admin", created_at: addDays(-32), updated_at: addDays(-1) },
    { id: "opp-2", company: "Varejo Prime", segment: "Varejo", channel: "B2B2C", source: "Indicação", contact_name: "Ricardo Nunes", contact_role: "Head de Serviços Financeiros", contact_email: "ricardo@exemplo.com", contact_phone: "+55 11 99999-1002", summary: "Incluir consórcios no ecossistema financeiro e nos canais físicos da rede.", particularities: "Projeto-piloto em 20 lojas antes da expansão nacional.", interests: ["Consórcios"], potential_revenue: 920000, expected_sales: 65000000, client_base: 1200000, status: "Proposta", priority: "Alta", probability: 50, owner_id: "demo-collab", next_action: "Apresentar proposta comercial revisada", next_action_date: addDays(3), meeting_date: null, expected_close_date: addDays(52).slice(0,10), document_link: "", created_by: "demo-source", created_at: addDays(-18), updated_at: addDays(-2) },
    { id: "opp-3", company: "Grupo Horizonte", segment: "Educação", channel: "Parceria de distribuição", source: "Evento setorial", contact_name: "Clara Mota", contact_role: "Gerente de Parcerias", contact_email: "clara@exemplo.com", contact_phone: "+55 11 99999-1003", summary: "Avaliar produtos financeiros para colaboradores, alunos e rede de fornecedores.", particularities: "A área jurídica solicitou clareza sobre tratamento de dados e jornada de contratação.", interests: ["Consórcios", "Seguros", "Tecnologia"], potential_revenue: 480000, expected_sales: 32000000, client_base: 430000, status: "Diagnóstico", priority: "Média", probability: 35, owner_id: "demo-admin", next_action: "Receber dados da base e mapear jornadas", next_action_date: addDays(-2), meeting_date: null, expected_close_date: addDays(70).slice(0,10), document_link: "", created_by: "demo-admin", created_at: addDays(-13), updated_at: addDays(-4) },
    { id: "opp-4", company: "Saúde Integral", segment: "Saúde", channel: "B2B", source: "Parceiro comercial", contact_name: "André Barros", contact_role: "Diretor Financeiro", contact_email: "andre@exemplo.com", contact_phone: "+55 11 99999-1004", summary: "Desenvolver solução de proteção patrimonial para unidades próprias e franqueadas.", particularities: "Mapear concentrações e histórico de sinistros antes da modelagem.", interests: ["Seguros", "Resseguros"], potential_revenue: 310000, expected_sales: 0, client_base: 240, status: "Qualificação", priority: "Média", probability: 20, owner_id: "demo-collab", next_action: "Solicitar relação de unidades e valores em risco", next_action_date: addDays(6), meeting_date: addDays(8), expected_close_date: addDays(82).slice(0,10), document_link: "", created_by: "demo-source", created_at: addDays(-7), updated_at: addDays(-1) },
    { id: "opp-5", company: "Fintech Vértice", segment: "Tecnologia", channel: "B2B2C", source: "Site Astrion", contact_name: "Paula Lima", contact_role: "COO", contact_email: "paula@exemplo.com", contact_phone: "+55 11 99999-1005", summary: "Conectar oferta de consórcios à plataforma por meio de APIs.", particularities: "Contato inicial; confirmar base ativa, canais e capacidade de desenvolvimento.", interests: ["Consórcios", "Tecnologia"], potential_revenue: 260000, expected_sales: 18000000, client_base: 95000, status: "Nova", priority: "Baixa", probability: 10, owner_id: null, next_action: "Realizar contato de qualificação", next_action_date: addDays(2), meeting_date: null, expected_close_date: addDays(95).slice(0,10), document_link: "", created_by: "demo-source", created_at: addDays(-2), updated_at: addDays(-2) }
  ];
  const activities = [
    { id: "act-1", opportunity_id: "opp-1", type: "Reunião", description: "Reunião de alinhamento com Produtos e Canais", activity_date: addDays(-4), created_by: "demo-admin", created_at: addDays(-4) },
    { id: "act-2", opportunity_id: "opp-2", type: "Nota", description: "Parceiro enviou projeção de lojas para o piloto", activity_date: addDays(-2), created_by: "demo-collab", created_at: addDays(-2) }
  ];
  const history = opportunities.map(opportunity => ({ id: `hist-${opportunity.id}`, opportunity_id: opportunity.id, event_type: "created", description: "Oportunidade cadastrada", changed_by: opportunity.created_by, created_at: opportunity.created_at }));
  return { profiles, opportunities, activities, history };
}

function loadDemo() {
  const stored = localStorage.getItem(STORAGE_KEY);
  let data;
  try { data = stored ? JSON.parse(stored) : demoSeed(); } catch { data = demoSeed(); }
  if (!data?.opportunities) data = demoSeed();
  state.profiles = data.profiles;
  state.opportunities = data.opportunities;
  state.activities = data.activities || [];
  state.history = data.history || [];
  state.currentUser = { id: "demo-admin", email: "wellington@astrion.com.br" };
  state.profile = state.profiles[0];
  persistDemo();
}

function persistDemo() {
  if (state.online) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ profiles: state.profiles, opportunities: state.opportunities, activities: state.activities, history: state.history }));
}

async function initialize() {
  populateStaticSelects();
  bindEvents();
  const hasConnection = CONFIG.supabaseUrl && CONFIG.supabasePublishableKey && !CONFIG.supabaseUrl.includes("SEU_");
  if (hasConnection) {
    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm");
      state.supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey);
      state.online = true;

      state.supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          state.authMode = "recovery";
          showAuth();
          renderAuthMode();
        }
      });

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search);
      const recoveryReturn = hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery";
      const { data: { session } } = await state.supabase.auth.getSession();

      if (recoveryReturn) {
        state.authMode = "recovery";
        showAuth();
        renderAuthMode();
        return;
      }

      if (!session) {
        const inviteMode = queryParams.get("invite") === "1" && queryParams.get("email");
        state.authMode = inviteMode ? "signup" : "login";
        showAuth();
        renderAuthMode();
        return;
      }
      await hydrateOnline(session.user);
    } catch (error) {
      console.error(error);
      toast("Não foi possível conectar à base. O modo demonstração foi ativado.", "error");
      state.online = false;
      loadDemo();
    }
  } else {
    loadDemo();
  }
  startApp();
}

async function hydrateOnline(user) {
  state.currentUser = user;
  const { data: profile, error: profileError } = await state.supabase.from("profiles").select("*").eq("id", user.id).single();
  if (profileError) throw profileError;
  state.profile = profile;
  await refreshOnlineData();
}

async function refreshOnlineData() {
  const queries = [
    state.supabase.from("opportunities").select("*").order("updated_at", { ascending: false }),
    state.supabase.from("profiles").select("*").order("full_name")
  ];
  if (roleIsAdmin()) queries.push(state.supabase.from("access_allowlist").select("*").order("created_at", { ascending: false }));
  const [opportunitiesResult, profilesResult, allowlistResult] = await Promise.all(queries);
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  state.opportunities = opportunitiesResult.data || [];
  state.profiles = profilesResult.error ? [state.profile] : (profilesResult.data || [state.profile]);
  state.accessAllowlist = allowlistResult?.error ? [] : (allowlistResult?.data || []);
}

function showAuth() {
  $("#app").classList.add("hidden");
  $("#auth-screen").classList.remove("hidden");
  renderAuthMode();
}

function startApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  applyPermissions();
  updateIdentity();
  if (!roleIsManager()) state.view = "opportunities";
  switchView(state.view);
  renderAll();
}

function applyPermissions() {
  $$(".manager-only").forEach(element => element.classList.toggle("permission-hidden", !roleIsManager()));
  $$(".admin-only").forEach(element => element.classList.toggle("permission-hidden", !roleIsAdmin()));
  $$(".manager-fields").forEach(element => element.classList.toggle("permission-hidden", !roleIsManager()));
  $("#next-action").required = false;
  $("#next-action-date").required = false;
}

function updateIdentity() {
  const profile = state.profile;
  $("#user-name").textContent = profile?.full_name || state.currentUser?.email || "Usuário";
  $("#user-role").textContent = ROLE_LABELS[profile?.role] || "Usuário";
  $("#user-avatar").textContent = initials(profile?.full_name || state.currentUser?.email);
  $("#logout-button").classList.toggle("hidden", !state.online);
  $("#demo-banner").classList.toggle("hidden", state.online);
  $("#mode-card").classList.toggle("connected", state.online);
  $("#mode-title").textContent = state.online ? "Base compartilhada" : "Modo demonstração";
  $("#mode-text").textContent = state.online ? "Dados protegidos e sincronizados" : "Dados salvos neste navegador";
  $("#opportunities-title").textContent = roleIsManager() ? "Todas as oportunidades" : "Minhas oportunidades cadastradas";
  $("#today-chip").textContent = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
}

function populateStaticSelects() {
  const options = STATUSES.map(status => `<option value="${status.value}">${status.value}</option>`).join("");
  $("#status").innerHTML = options;
  $("#table-status-filter").insertAdjacentHTML("beforeend", options);
}

function filteredOpportunities(extra = {}) {
  return state.opportunities.filter(opportunity => {
    const haystack = normalize([opportunity.company, opportunity.cnpj, opportunity.contact_name, opportunity.contact_email, opportunity.summary, opportunity.segment, opportunity.source, ...(opportunity.interests || [])].join(" "));
    return (!state.search || haystack.includes(normalize(state.search)))
      && (!state.priority || opportunity.priority === state.priority)
      && (!state.owner || opportunity.owner_id === state.owner)
      && (!state.status || opportunity.status === state.status)
      && (!extra.status || opportunity.status === extra.status);
  });
}

function renderAll() {
  populatePeopleSelects();
  renderDashboard();
  renderPipeline();
  renderOpportunityTable();
  renderCalendar();
  renderTeam();
}

function populatePeopleSelects() {
  const managers = state.profiles.filter(profile => profile.active !== false && ["admin", "collaborator"].includes(profile.role));
  const ownerOptions = managers.map(profile => `<option value="${profile.id}">${escapeHTML(profile.full_name)}</option>`).join("");
  const currentOwner = $("#owner-id").value;
  $("#owner-id").innerHTML = `<option value="">A definir</option>${ownerOptions}`;
  $("#owner-id").value = currentOwner;
  $$(".filter-owner").forEach(select => {
    const selected = select.value;
    select.innerHTML = `<option value="">Todos os responsáveis</option>${ownerOptions}`;
    select.value = selected;
  });
}

function renderDashboard() {
  if (!roleIsManager()) return;
  const active = state.opportunities.filter(opportunity => !["Ganha", "Perdida", "Pausada"].includes(opportunity.status));
  const potential = active.reduce((sum, opportunity) => sum + Number(opportunity.potential_revenue || 0), 0);
  const weighted = active.reduce((sum, opportunity) => sum + Number(opportunity.potential_revenue || 0) * Number(opportunity.probability || 0) / 100, 0);
  const inSevenDays = new Date(Date.now() + 7 * 86400000);
  const nextCount = active.filter(opportunity => opportunity.next_action_date && new Date(opportunity.next_action_date) >= new Date() && new Date(opportunity.next_action_date) <= inSevenDays).length;
  const overdue = active.filter(isOverdue);
  $("#kpi-potential").textContent = currency.format(potential);
  $("#kpi-potential-detail").textContent = `${active.length} ${active.length === 1 ? "oportunidade ativa" : "oportunidades ativas"}`;
  $("#kpi-weighted").textContent = currency.format(weighted);
  $("#kpi-next").textContent = number.format(nextCount);
  $("#kpi-overdue").textContent = number.format(overdue.length);

  const rows = ACTIVE_STATUSES.map(meta => {
    const items = active.filter(opportunity => opportunity.status === meta.value);
    return { ...meta, count: items.length, totalValue: items.reduce((sum, opportunity) => sum + Number(opportunity.potential_revenue || 0), 0) };
  });
  const max = Math.max(...rows.map(row => row.totalValue), 1);
  $("#funnel-chart").innerHTML = rows.map(row => `<div class="funnel-row"><span class="funnel-row__label">${row.value}</span><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(row.totalValue / max * 100, row.count ? 3 : 0)}%"></div></div><span class="funnel-value">${row.count} · ${currency.format(row.totalValue)}</span></div>`).join("");

  const priorities = [
    { label: "Alta", color: "#d92d20", count: active.filter(item => item.priority === "Alta").length },
    { label: "Média", color: "#f79009", count: active.filter(item => item.priority === "Média").length },
    { label: "Baixa", color: "#079455", count: active.filter(item => item.priority === "Baixa").length }
  ];
  const total = Math.max(active.length, 1);
  let start = 0;
  const stops = priorities.map(item => { const from = start; start += item.count / total * 100; return `${item.color} ${from}% ${start}%`; }).join(", ");
  $("#health-chart").innerHTML = `<div class="donut" style="background:conic-gradient(${active.length ? stops : "#e9edf3 0 100%"})"><div class="donut__center"><strong>${active.length}</strong><small>ativas</small></div></div><div class="health-legend">${priorities.map(item => `<span><i style="background:${item.color}"></i>${item.label}: ${item.count}</span>`).join("")}</div>`;

  const actions = active.filter(item => item.next_action_date).sort((a, b) => new Date(a.next_action_date) - new Date(b.next_action_date)).slice(0, 5);
  $("#next-actions").innerHTML = actions.length ? actions.map(actionRowTemplate).join("") : emptyTemplate("Nenhuma próxima ação cadastrada.");

  const noOwner = active.filter(item => !item.owner_id).length;
  const noNext = active.filter(item => !item.next_action_date || !item.next_action).length;
  const stale = active.filter(item => Date.now() - new Date(item.updated_at).getTime() > 14 * 86400000).length;
  const alerts = [
    overdue.length && { title: `${overdue.length} ${overdue.length === 1 ? "ação atrasada" : "ações atrasadas"}`, text: "Repriorize os compromissos que já venceram." },
    noOwner && { title: `${noOwner} sem responsável`, text: "Defina a pessoa que conduzirá cada oportunidade." },
    noNext && { title: `${noNext} sem próximo passo`, text: "Todo negócio ativo deve ter ação e prazo definidos." },
    stale && { title: `${stale} sem atualização recente`, text: "Revise oportunidades sem movimentação há mais de 14 dias." }
  ].filter(Boolean);
  $("#pipeline-alerts").innerHTML = alerts.length ? alerts.map((alert, index) => `<div class="alert-item"><span>${index + 1}</span><div><strong>${alert.title}</strong><p>${alert.text}</p></div></div>`).join("") : `<div class="alert-item"><span>✓</span><div><strong>Pipeline em dia</strong><p>Nenhum alerta crítico foi identificado.</p></div></div>`;
}

function actionRowTemplate(opportunity) {
  const date = new Date(opportunity.next_action_date);
  return `<div class="action-row open-detail" data-id="${opportunity.id}"><span class="action-date"><strong>${String(date.getDate()).padStart(2,"0")}</strong>${date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span><div><h4>${escapeHTML(opportunity.company)}</h4><p>${escapeHTML(opportunity.next_action)}</p></div><span class="time-tag ${isOverdue(opportunity) ? "overdue" : ""}">${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>`;
}

function renderPipeline() {
  if (!roleIsManager()) return;
  const items = filteredOpportunities();
  const pipelineStatuses = STATUSES.filter(status => !["Perdida", "Pausada"].includes(status.value));
  const total = items.filter(item => !isClosed(item)).reduce((sum, item) => sum + Number(item.potential_revenue || 0), 0);
  $("#pipeline-summary").innerHTML = `<span><strong>${items.length}</strong> registros visíveis</span><span>·</span><span><strong>${currency.format(total)}</strong> em pipeline ativo</span>`;
  $("#kanban").innerHTML = pipelineStatuses.map(meta => {
    const lane = items.filter(item => item.status === meta.value);
    const laneTotal = lane.reduce((sum, item) => sum + Number(item.potential_revenue || 0), 0);
    return `<section class="kanban-lane" data-status="${meta.value}" style="--status-color:${meta.color}"><header class="lane-head"><span class="lane-title"><i class="lane-dot"></i>${meta.value}</span><span class="lane-count">${lane.length}</span></header><div class="lane-total">${currency.format(laneTotal)} em potencial</div><div class="lane-cards">${lane.map(kanbanCardTemplate).join("") || `<div class="empty-state">Nenhuma oportunidade</div>`}</div></section>`;
  }).join("");
  bindKanbanDrag();
}

function kanbanCardTemplate(opportunity) {
  const owner = ownerFor(opportunity.owner_id);
  return `<article class="kanban-card open-detail" draggable="true" data-id="${opportunity.id}"><div class="kanban-card__top"><span class="company-initial">${initials(opportunity.company)}</span><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></div><h4>${escapeHTML(opportunity.company)}</h4><span class="contact-line">${escapeHTML(opportunity.contact_name || opportunity.segment || "Contato a confirmar")}</span><p class="summary-line">${escapeHTML(opportunity.summary)}</p><div class="owner-cell"><span class="mini-avatar">${initials(owner?.full_name || "AD")}</span><span>${escapeHTML(owner?.full_name || "A definir")}</span></div><div class="kanban-card__meta"><strong>${currency.format(Number(opportunity.potential_revenue || 0))}</strong><span class="due ${isOverdue(opportunity) ? "overdue" : ""}">${opportunity.next_action_date ? formatDate(opportunity.next_action_date) : "Sem prazo"}</span></div></article>`;
}

function bindKanbanDrag() {
  $$(".kanban-card").forEach(card => {
    card.addEventListener("dragstart", event => { event.dataTransfer.setData("text/plain", card.dataset.id); setTimeout(() => card.classList.add("dragging")); });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  $$(".kanban-lane").forEach(lane => {
    lane.addEventListener("dragover", event => { event.preventDefault(); lane.classList.add("drag-over"); });
    lane.addEventListener("dragleave", () => lane.classList.remove("drag-over"));
    lane.addEventListener("drop", async event => {
      event.preventDefault();
      lane.classList.remove("drag-over");
      const id = event.dataTransfer.getData("text/plain");
      const opportunity = state.opportunities.find(item => item.id === id);
      if (!opportunity || opportunity.status === lane.dataset.status) return;
      await updateOpportunity(id, { status: lane.dataset.status, probability: statusMeta(lane.dataset.status).probability }, `Status alterado para ${lane.dataset.status}`);
    });
  });
}

function renderOpportunityTable() {
  const items = filteredOpportunities();
  $("#opportunity-count").textContent = `${items.length} ${items.length === 1 ? "registro" : "registros"}`;
  $("#opportunity-table").innerHTML = items.length ? items.map(opportunityRowTemplate).join("") : `<tr><td colspan="7">${emptyTemplate("Nenhuma oportunidade encontrada.")}</td></tr>`;
  $("#mobile-opportunity-list").innerHTML = items.length ? items.map(mobileOpportunityTemplate).join("") : emptyTemplate("Nenhuma oportunidade encontrada.");
}

function opportunityRowTemplate(opportunity) {
  const meta = statusMeta(opportunity.status);
  const owner = ownerFor(opportunity.owner_id);
  return `<tr class="open-detail" data-id="${opportunity.id}"><td><div class="company-cell"><span class="company-initial">${initials(opportunity.company)}</span><div><strong>${escapeHTML(opportunity.company)}</strong><small>${escapeHTML(opportunity.summary)}</small></div></div></td><td><span class="status-pill" style="--status-color:${meta.color}">${opportunity.status}</span></td><td><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></td><td><strong>${currency.format(Number(opportunity.potential_revenue || 0))}</strong></td><td><div class="owner-cell"><span class="mini-avatar">${initials(owner?.full_name || "AD")}</span>${escapeHTML(owner?.full_name || "A definir")}</div></td><td><span class="due ${isOverdue(opportunity) ? "overdue" : ""}">${opportunity.next_action_date ? formatDate(opportunity.next_action_date) : "Sem prazo"}</span></td><td><button class="row-action" aria-label="Abrir oportunidade">→</button></td></tr>`;
}

function mobileOpportunityTemplate(opportunity) {
  const meta = statusMeta(opportunity.status);
  return `<article class="mobile-record open-detail" data-id="${opportunity.id}"><div class="mobile-record__head"><span class="status-pill" style="--status-color:${meta.color}">${opportunity.status}</span><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></div><h3>${escapeHTML(opportunity.company)}</h3><p>${escapeHTML(opportunity.summary)}</p><div class="mobile-record__foot"><strong>${currency.format(Number(opportunity.potential_revenue || 0))}</strong><span>${opportunity.next_action_date ? formatDate(opportunity.next_action_date) : "Sem prazo"}</span></div></article>`;
}

function calendarEvents() {
  return state.opportunities.flatMap(opportunity => {
    const events = [];
    if (opportunity.next_action_date && !isClosed(opportunity)) events.push({ date: opportunity.next_action_date, type: "action", label: opportunity.next_action || "Próxima ação", opportunity });
    if (opportunity.meeting_date) events.push({ date: opportunity.meeting_date, type: "meeting", label: "Reunião", opportunity });
    if (opportunity.expected_close_date && !isClosed(opportunity)) events.push({ date: `${opportunity.expected_close_date}T12:00:00`, type: "close", label: "Fechamento previsto", opportunity });
    return events;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderCalendar() {
  if (!roleIsManager()) return;
  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  const events = calendarEvents();
  $("#calendar-month").textContent = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor);
  const monthEvents = events.filter(event => { const date = new Date(event.date); return date.getMonth() === month && date.getFullYear() === year; });
  $("#calendar-total").textContent = `${monthEvents.length} ${monthEvents.length === 1 ? "compromisso" : "compromissos"}`;
  const days = [];
  for (let index = 0; index < 42; index++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dateKey(date);
    const dayEvents = events.filter(event => dateKey(event.date) === key);
    days.push(`<button class="calendar-day ${date.getMonth() !== month ? "muted" : ""} ${key === dateKey(new Date()) ? "today" : ""} ${key === state.selectedDate ? "selected" : ""}" data-date="${key}"><span class="day-number">${date.getDate()}</span><span class="day-events">${dayEvents.slice(0,3).map(event => `<span class="day-event ${event.type}" title="${escapeHTML(event.opportunity.company)} — ${escapeHTML(event.label)}">${escapeHTML(event.opportunity.company)}</span>`).join("")}${dayEvents.length > 3 ? `<span class="more-events">+${dayEvents.length - 3}</span>` : ""}</span></button>`);
  }
  $("#calendar-grid").innerHTML = days.join("");
  renderAgendaList(events);
}

function renderAgendaList(events = calendarEvents()) {
  let selected;
  if (state.selectedDate) {
    selected = events.filter(event => dateKey(event.date) === state.selectedDate);
    $("#selected-date-title").textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" }).format(new Date(`${state.selectedDate}T12:00:00`));
  } else {
    const today = new Date();
    today.setHours(0,0,0,0);
    selected = events.filter(event => new Date(event.date) >= today).slice(0, 10);
    $("#selected-date-title").textContent = "Próximos compromissos";
  }
  const typeLabel = { action: "Próxima ação", meeting: "Reunião", close: "Previsão" };
  $("#agenda-list").innerHTML = selected.length ? selected.map(event => `<article class="agenda-item open-detail" data-id="${event.opportunity.id}"><span class="agenda-item__type">${typeLabel[event.type]}</span><h4>${escapeHTML(event.opportunity.company)}</h4><p>${escapeHTML(event.label)}</p><time>${formatDate(event.date, { time: event.type !== "close", year: true })}</time></article>`).join("") : emptyTemplate("Nenhum compromisso nesta data.");
}

function renderTeam() {
  if (!roleIsAdmin()) return;
  $("#team-count").textContent = `${state.profiles.length} ${state.profiles.length === 1 ? "usuário" : "usuários"}`;
  $("#team-table").innerHTML = state.profiles.map(profile => `<tr data-id="${profile.id}"><td><div class="owner-cell"><span class="mini-avatar">${initials(profile.full_name)}</span><strong>${escapeHTML(profile.full_name || "Sem nome")}</strong></div></td><td>${escapeHTML(profile.email || "—")}</td><td><select class="field-select role-select" ${profile.id === state.profile.id ? "disabled" : ""}><option value="admin" ${profile.role === "admin" ? "selected" : ""}>Administrador</option><option value="collaborator" ${profile.role === "collaborator" ? "selected" : ""}>Gestor comercial</option><option value="submitter" ${profile.role === "submitter" ? "selected" : ""}>Cadastrador</option></select></td><td><span class="status-pill" style="--status-color:${profile.active !== false ? "#079455" : "#98a2b3"}">${profile.active !== false ? "Ativo" : "Inativo"}</span></td><td>${profile.id === state.profile.id ? "" : `<button class="row-action toggle-user" title="${profile.active !== false ? "Desativar" : "Ativar"}">${profile.active !== false ? "×" : "✓"}</button>`}</td></tr>`).join("");
}

function emptyTemplate(message) { return `<div class="empty-state">${escapeHTML(message)}</div>`; }

function switchView(view) {
  if (!roleIsManager() && view !== "opportunities") view = "opportunities";
  if (!roleIsAdmin() && view === "team") view = roleIsManager() ? "dashboard" : "opportunities";
  state.view = view;
  $$(".view").forEach(section => section.classList.toggle("active", section.id === `view-${view}`));
  $$(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  const titles = { dashboard: "Visão geral", pipeline: "Pipeline", agenda: "Agenda", opportunities: roleIsManager() ? "Oportunidades" : "Meus cadastros", team: "Equipe e acessos" };
  $("#page-title").textContent = titles[view];
  closeMobileMenu();
  if (view === "agenda") renderCalendar();
}

function openOpportunityModal(opportunity = null) {
  const form = $("#opportunity-form");
  form.reset();
  $("#opportunity-id").value = opportunity?.id || "";
  $("#opportunity-modal-title").textContent = opportunity ? "Editar oportunidade B2B" : "Nova oportunidade B2B";
  const fields = ["company", "cnpj", "website", "segment", "channel", "source", "client_base", "contact_name", "contact_role", "contact_email", "contact_phone", "summary", "particularities", "potential_revenue", "expected_sales", "status", "priority", "probability", "owner_id", "next_action", "expected_close_date", "document_link", "loss_reason"];
  fields.forEach(key => {
    const element = $(`#${key.replaceAll("_", "-")}`);
    if (element) element.value = opportunity?.[key] ?? "";
  });
  $("#status").value = opportunity?.status || "Nova";
  $("#priority").value = opportunity?.priority || "Média";
  $("#probability").value = opportunity?.probability ?? 10;
  $("#next-action-date").value = toLocalInput(opportunity?.next_action_date);
  $("#meeting-date").value = toLocalInput(opportunity?.meeting_date);
  $$('input[name="interests"]').forEach(input => input.checked = (opportunity?.interests || []).includes(input.value));
  openLayer("opportunity-modal");
  setTimeout(() => $("#company").focus(), 100);
}

function opportunityPayload() {
  const get = id => $(id).value.trim();
  const optionalNumber = id => get(id) === "" ? null : Number(get(id));
  const website = get("#website");
  const documentLink = get("#document-link");
  if (website && !safeHttpUrl(website)) throw new Error("O site deve começar com http:// ou https://.");
  if (documentLink && !safeHttpUrl(documentLink)) throw new Error("O link do documento deve começar com http:// ou https://.");
  return {
    company: get("#company"), cnpj: normalizeCNPJ(get("#cnpj")) || null, website: website || null,
    segment: get("#segment") || null, channel: get("#channel") || "B2B", source: get("#source") || null,
    client_base: optionalNumber("#client-base"), contact_name: get("#contact-name") || null,
    contact_role: get("#contact-role") || null, contact_email: get("#contact-email") || null,
    contact_phone: get("#contact-phone") || null, summary: get("#summary"), particularities: get("#particularities") || null,
    interests: $('input[name="interests"]:checked').map(input => input.value),
    potential_revenue: optionalNumber("#potential-revenue"), expected_sales: optionalNumber("#expected-sales"),
    status: roleIsManager() ? get("#status") : "Nova", priority: roleIsManager() ? get("#priority") : "Média",
    probability: roleIsManager() ? Number(get("#probability")) || 0 : 10, owner_id: roleIsManager() ? (get("#owner-id") || null) : null,
    next_action: roleIsManager() ? (get("#next-action") || null) : null, next_action_date: roleIsManager() ? toISO(get("#next-action-date")) : null,
    meeting_date: roleIsManager() ? toISO(get("#meeting-date")) : null, expected_close_date: roleIsManager() ? (get("#expected-close-date") || null) : null,
    document_link: roleIsManager() ? (documentLink || null) : null,
    loss_reason: roleIsManager() ? (get("#loss-reason") || null) : null
  };
}

async function saveOpportunity(payload, id = null) {
  if (state.online) {
    const query = id ? state.supabase.from("opportunities").update(payload).eq("id", id) : state.supabase.from("opportunities").insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    await refreshOnlineData();
    return data;
  }
  const now = new Date().toISOString();
  if (id) {
    const index = state.opportunities.findIndex(item => item.id === id);
    if (index < 0) throw new Error("Oportunidade não encontrada.");
    state.opportunities[index] = { ...state.opportunities[index], ...payload, updated_at: now };
    state.history.unshift({ id: crypto.randomUUID(), opportunity_id: id, event_type: "updated", description: "Cadastro atualizado", changed_by: state.currentUser.id, created_at: now });
    persistDemo();
    return state.opportunities[index];
  }
  const item = { id: crypto.randomUUID(), ...payload, created_by: state.currentUser.id, created_at: now, updated_at: now };
  state.opportunities.unshift(item);
  state.history.unshift({ id: crypto.randomUUID(), opportunity_id: item.id, event_type: "created", description: "Oportunidade cadastrada", changed_by: state.currentUser.id, created_at: now });
  persistDemo();
  return item;
}

async function updateOpportunity(id, changes, description = "Oportunidade atualizada") {
  try {
    if (state.online) {
      const { error } = await state.supabase.from("opportunities").update(changes).eq("id", id);
      if (error) throw error;
      await refreshOnlineData();
    } else {
      const index = state.opportunities.findIndex(item => item.id === id);
      if (index < 0) return;
      state.opportunities[index] = { ...state.opportunities[index], ...changes, updated_at: new Date().toISOString() };
      state.history.unshift({ id: crypto.randomUUID(), opportunity_id: id, event_type: "updated", description, changed_by: state.currentUser.id, created_at: new Date().toISOString() });
      persistDemo();
    }
    renderAll();
    toast(description, "success");
    if ($("#detail-drawer").classList.contains("open")) await openDetail(id);
  } catch (error) { handleError(error); }
}

async function deleteOpportunity(id) {
  const accepted = await confirmAction("Excluir oportunidade?", "O cadastro, as atividades e o histórico serão removidos. Esta ação não pode ser desfeita.", "Excluir");
  if (!accepted) return;
  try {
    if (state.online) {
      const { error } = await state.supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
      await refreshOnlineData();
    } else {
      state.opportunities = state.opportunities.filter(item => item.id !== id);
      state.activities = state.activities.filter(item => item.opportunity_id !== id);
      state.history = state.history.filter(item => item.opportunity_id !== id);
      persistDemo();
    }
    closeLayer("detail-drawer");
    renderAll();
    toast("Oportunidade excluída.", "success");
  } catch (error) { handleError(error); }
}

async function openDetail(id) {
  const opportunity = state.opportunities.find(item => item.id === id);
  if (!opportunity) return;
  let activities, history;
  if (state.online) {
    const [activitiesResult, historyResult] = await Promise.all([
      state.supabase.from("activities").select("*").eq("opportunity_id", id).order("activity_date", { ascending: false }),
      state.supabase.from("opportunity_history").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }).limit(25)
    ]);
    activities = activitiesResult.data || [];
    history = historyResult.data || [];
  } else {
    activities = state.activities.filter(item => item.opportunity_id === id);
    history = state.history.filter(item => item.opportunity_id === id);
  }
  $("#detail-title").textContent = opportunity.company;
  $("#detail-eyebrow").textContent = opportunity.channel || "Oportunidade B2B";
  const meta = statusMeta(opportunity.status);
  const owner = ownerFor(opportunity.owner_id);
  const timeline = [
    ...activities.map(item => ({ kind: item.type, text: item.description, date: item.activity_date || item.created_at, user: ownerName(item.created_by) })),
    ...history.map(item => ({ kind: item.event_type === "created" ? "Cadastro" : "Alteração", text: item.description || historyDescription(item), date: item.created_at, user: ownerName(item.changed_by) }))
  ].sort((a,b) => new Date(b.date) - new Date(a.date));
  $("#detail-content").innerHTML = `
    <section class="detail-hero"><div class="detail-hero__top"><span class="status-pill" style="--status-color:${meta.color}">${opportunity.status}</span><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></div><p>${escapeHTML(opportunity.summary)}</p><div class="detail-metrics"><div><small>Potencial</small><strong>${currency.format(Number(opportunity.potential_revenue || 0))}</strong></div><div><small>Probabilidade</small><strong>${opportunity.probability || 0}%</strong></div><div><small>Ponderado</small><strong>${currency.format(Number(opportunity.potential_revenue || 0) * Number(opportunity.probability || 0) / 100)}</strong></div></div></section>
    ${roleIsManager() ? `<section class="detail-section"><h3>Condução comercial</h3><div class="inline-edit"><label>Etapa<select id="detail-status">${STATUSES.map(item => `<option ${item.value === opportunity.status ? "selected" : ""}>${item.value}</option>`).join("")}</select></label><label>Próxima ação<input id="detail-next-action" value="${escapeHTML(opportunity.next_action || "")}" placeholder="Defina o próximo passo"></label><label>Prazo<input id="detail-next-date" type="datetime-local" value="${toLocalInput(opportunity.next_action_date)}"></label><button class="btn btn--primary btn--small" id="save-quick-update" data-id="${id}">Atualizar condução</button></div></section>` : ""}
    <section class="detail-section"><h3>Empresa e contato</h3><div class="detail-grid"><div><small>Segmento</small><strong>${escapeHTML(opportunity.segment || "A confirmar")}</strong></div><div><small>Origem</small><strong>${escapeHTML(opportunity.source || "Não informada")}</strong></div><div><small>Contato</small><strong>${escapeHTML(opportunity.contact_name || "A confirmar")}${opportunity.contact_role ? ` · ${escapeHTML(opportunity.contact_role)}` : ""}</strong></div><div><small>E-mail</small>${opportunity.contact_email ? `<a href="mailto:${escapeHTML(opportunity.contact_email)}">${escapeHTML(opportunity.contact_email)}</a>` : "<strong>Não informado</strong>"}</div><div><small>Telefone</small><strong>${escapeHTML(opportunity.contact_phone || "Não informado")}</strong></div><div><small>Base potencial</small><strong>${opportunity.client_base ? number.format(opportunity.client_base) : "Não informada"}</strong></div></div></section>
    <section class="detail-section"><h3>Soluções e particularidades</h3><div class="detail-tags">${(opportunity.interests || []).map(item => `<span>${escapeHTML(item)}</span>`).join("") || "<span>A confirmar</span>"}</div><p style="color:var(--ink-500);font-size:10px;line-height:1.6;margin:12px 0 0">${escapeHTML(opportunity.particularities || "Nenhuma particularidade registrada.")}</p></section>
    <section class="detail-section"><h3>Datas e referências</h3><div class="detail-grid"><div><small>Próxima ação</small><strong class="${isOverdue(opportunity) ? "due overdue" : ""}">${escapeHTML(opportunity.next_action || "A definir")} · ${formatDate(opportunity.next_action_date, { time: true })}</strong></div><div><small>Reunião</small><strong>${formatDate(opportunity.meeting_date, { time: true })}</strong></div><div><small>Fechamento previsto</small><strong>${formatDate(opportunity.expected_close_date, { year: true })}</strong></div><div><small>Responsável</small><strong>${escapeHTML(owner?.full_name || "A definir")}</strong></div>${opportunity.document_link ? `<div><small>Documento</small><a href="${escapeHTML(opportunity.document_link)}" target="_blank" rel="noopener">Abrir documento ↗</a></div>` : ""}</div></section>
    ${roleIsManager() ? `<section class="detail-section"><h3>Registrar atividade</h3><form id="activity-form" class="activity-form"><select id="activity-type"><option>Nota</option><option>Ligação</option><option>E-mail</option><option>Reunião</option><option>Tarefa</option></select><input id="activity-description" required placeholder="Descreva a interação ou decisão"><button class="btn btn--primary btn--small" type="submit">Adicionar</button></form></section>` : ""}
    <section class="detail-section"><h3>Histórico</h3><div class="timeline">${timeline.length ? timeline.map(item => `<div class="timeline-item"><strong>${escapeHTML(item.kind)}</strong><p>${escapeHTML(item.text)}</p><time>${formatDate(item.date, { time: true, year: true })} · ${escapeHTML(item.user)}</time></div>`).join("") : emptyTemplate("Ainda não há movimentações.")}</div></section>
    <div class="detail-actions">${roleIsManager() ? `<button class="btn btn--ghost" id="edit-opportunity" data-id="${id}">Editar cadastro</button>` : ""}${roleIsAdmin() ? `<button class="btn btn--danger" id="delete-opportunity" data-id="${id}">Excluir</button>` : ""}</div>`;
  openLayer("detail-drawer");
  bindDetailActions(id);
}

function historyDescription(item) {
  if (item.event_type === "status_changed") return `Status alterado de ${item.old_data?.status || "—"} para ${item.new_data?.status || "—"}`;
  return item.event_type === "created" ? "Oportunidade cadastrada" : "Cadastro atualizado";
}

function bindDetailActions(id) {
  $("#edit-opportunity")?.addEventListener("click", () => { closeLayer("detail-drawer"); openOpportunityModal(state.opportunities.find(item => item.id === id)); });
  $("#delete-opportunity")?.addEventListener("click", () => deleteOpportunity(id));
  $("#save-quick-update")?.addEventListener("click", () => {
    const status = $("#detail-status").value;
    updateOpportunity(id, { status, probability: statusMeta(status).probability, next_action: $("#detail-next-action").value.trim() || null, next_action_date: toISO($("#detail-next-date").value) }, "Condução comercial atualizada");
  });
  $("#activity-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const description = $("#activity-description").value.trim();
    if (!description) return;
    await addActivity(id, $("#activity-type").value, description);
  });
}

async function addActivity(opportunityId, type, description) {
  try {
    const payload = { opportunity_id: opportunityId, type, description, activity_date: new Date().toISOString() };
    if (state.online) {
      const { error } = await state.supabase.from("activities").insert(payload);
      if (error) throw error;
    } else {
      state.activities.unshift({ id: crypto.randomUUID(), ...payload, created_by: state.currentUser.id, created_at: new Date().toISOString() });
      persistDemo();
    }
    toast("Atividade registrada.", "success");
    await openDetail(opportunityId);
  } catch (error) { handleError(error); }
}

async function updateProfile(id, changes) {
  try {
    if (state.online) {
      const { error } = await state.supabase.from("profiles").update(changes).eq("id", id);
      if (error) throw error;
      await refreshOnlineData();
    } else {
      const index = state.profiles.findIndex(profile => profile.id === id);
      state.profiles[index] = { ...state.profiles[index], ...changes };
      persistDemo();
    }
    renderAll();
    toast("Acesso atualizado.", "success");
  } catch (error) { handleError(error); }
}

function bindEvents() {
  $$(".nav-item").forEach(item => item.addEventListener("click", () => switchView(item.dataset.view)));
  $$(".go-view").forEach(item => item.addEventListener("click", () => switchView(item.dataset.target)));
  $$(".open-opportunity").forEach(button => button.addEventListener("click", () => openOpportunityModal()));
  $("#open-setup").addEventListener("click", () => openLayer("setup-modal"));
  $$('[data-close]').forEach(element => element.addEventListener("click", () => closeLayer(element.dataset.close)));
  document.addEventListener("keydown", event => { if (event.key === "Escape") { $$(".modal.open, .drawer.open").forEach(layer => closeLayer(layer.id)); closeMobileMenu(); } });
  document.addEventListener("click", event => {
    const target = event.target.closest(".open-detail");
    if (target && !target.classList.contains("dragging")) openDetail(target.dataset.id);
  });
  $("#opportunity-form").addEventListener("submit", async event => {
    event.preventDefault();
    const button = $("#save-opportunity");
    button.disabled = true;
    button.textContent = "Salvando...";
    try {
      const id = $("#opportunity-id").value || null;
      const saved = await saveOpportunity(opportunityPayload(), id);
      closeLayer("opportunity-modal");
      renderAll();
      toast(id ? "Oportunidade atualizada." : "Oportunidade cadastrada com sucesso.", "success");
      if (!roleIsManager()) switchView("opportunities");
      else if (id) await openDetail(saved.id);
    } catch (error) { handleError(error); }
    finally { button.disabled = false; button.textContent = "Salvar oportunidade"; }
  });
  $("#status").addEventListener("change", event => { if (!$("#opportunity-id").value) $("#probability").value = statusMeta(event.target.value).probability; });
  $$(".global-search").forEach(input => input.addEventListener("input", event => { state.search = event.target.value; $$(".global-search").forEach(other => { if (other !== event.target) other.value = state.search; }); renderPipeline(); renderOpportunityTable(); }));
  $$(".filter-priority").forEach(select => select.addEventListener("change", event => { state.priority = event.target.value; $$(".filter-priority").forEach(other => other.value = state.priority); renderPipeline(); renderOpportunityTable(); }));
  $$(".filter-owner").forEach(select => select.addEventListener("change", event => { state.owner = event.target.value; $$(".filter-owner").forEach(other => other.value = state.owner); renderPipeline(); renderOpportunityTable(); }));
  $("#table-status-filter").addEventListener("change", event => { state.status = event.target.value; renderOpportunityTable(); });
  $$(".clear-filters").forEach(button => button.addEventListener("click", clearFilters));
  $("#calendar-prev").addEventListener("click", () => { state.calendarCursor.setMonth(state.calendarCursor.getMonth() - 1); state.selectedDate = null; renderCalendar(); });
  $("#calendar-next").addEventListener("click", () => { state.calendarCursor.setMonth(state.calendarCursor.getMonth() + 1); state.selectedDate = null; renderCalendar(); });
  $("#calendar-today").addEventListener("click", () => { state.calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); state.selectedDate = dateKey(new Date()); renderCalendar(); });
  $("#calendar-grid").addEventListener("click", event => { const day = event.target.closest(".calendar-day"); if (!day) return; state.selectedDate = state.selectedDate === day.dataset.date ? null : day.dataset.date; renderCalendar(); });
  $("#team-table").addEventListener("change", event => { if (event.target.classList.contains("role-select")) updateProfile(event.target.closest("tr").dataset.id, { role: event.target.value }); });
  $("#team-table").addEventListener("click", event => { const button = event.target.closest(".toggle-user"); if (!button) return; const profile = state.profiles.find(item => item.id === button.closest("tr").dataset.id); updateProfile(profile.id, { active: profile.active === false }); });
  $("#export-button").addEventListener("click", exportCSV);
  $("#open-menu").addEventListener("click", openMobileMenu);
  $("#close-menu").addEventListener("click", closeMobileMenu);
  $("#menu-overlay").addEventListener("click", closeMobileMenu);
  $("#toggle-auth-mode").addEventListener("click", toggleAuthMode);
  $("#forgot-password").addEventListener("click", handleForgotPassword);
  $("#login-form").addEventListener("submit", handleLogin);
  $("#signup-form").addEventListener("submit", handleSignup);
  $("#recovery-form").addEventListener("submit", handleRecoveryPassword);
  $("#logout-button").addEventListener("click", handleLogout);
}

function clearFilters() {
  state.search = state.priority = state.owner = state.status = "";
  $$(".global-search").forEach(input => input.value = "");
  $$(".filter-priority, .filter-owner").forEach(select => select.value = "");
  $("#table-status-filter").value = "";
  renderPipeline(); renderOpportunityTable();
}

function openLayer(id) { $("#" + id).classList.add("open"); document.body.classList.add("modal-open"); }
function closeLayer(id) { $("#" + id)?.classList.remove("open"); if (!$(".modal.open, .drawer.open")) document.body.classList.remove("modal-open"); }
function openMobileMenu() { $("#sidebar").classList.add("open"); $("#menu-overlay").classList.add("open"); }
function closeMobileMenu() { $("#sidebar").classList.remove("open"); $("#menu-overlay").classList.remove("open"); }

function exportCSV() {
  const headers = ["Empresa","CNPJ","Site","Status","Prioridade","Segmento","Modelo","Origem","Base potencial","Contato","Cargo","E-mail","Telefone","Soluções","Potencial de receita","Produção estimada","Probabilidade","Responsável","Próxima ação","Prazo","Reunião","Previsão de fechamento","Documento","Motivo de perda","Resumo","Particularidades","Criado em","Atualizado em"];
  const rows = filteredOpportunities().map(item => [item.company,item.cnpj,item.website,item.status,item.priority,item.segment,item.channel,item.source,item.client_base,item.contact_name,item.contact_role,item.contact_email,item.contact_phone,(item.interests||[]).join(", "),item.potential_revenue,item.expected_sales,item.probability,ownerName(item.owner_id),item.next_action,item.next_action_date,item.meeting_date,item.expected_close_date,item.document_link,item.loss_reason,item.summary,item.particularities,item.created_at,item.updated_at]);
  const csv = "\ufeff" + [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `oportunidades-astrion-${dateKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Relatório exportado em CSV.", "success");
}

function renderAuthMode() {
  const params = new URLSearchParams(window.location.search);
  const invitedEmail = params.get("invite") === "1" ? (params.get("email") || "") : "";
  const signup = state.authMode === "signup" && Boolean(invitedEmail);
  const recovery = state.authMode === "recovery";
  const login = !signup && !recovery;

  $("#login-form").classList.toggle("hidden", !login);
  $("#signup-form").classList.toggle("hidden", !signup);
  $("#recovery-form").classList.toggle("hidden", !recovery);
  $("#forgot-password").classList.toggle("hidden", !login);
  $("#toggle-auth-mode").classList.toggle("hidden", !recovery);

  if (signup) {
    $("#signup-email").value = invitedEmail.toLowerCase();
    $("#signup-email").readOnly = true;
  } else {
    $("#signup-email").readOnly = false;
  }

  if (recovery) {
    $("#auth-title").textContent = "Definir nova senha";
    $("#auth-subtitle").textContent = "Use uma senha forte e exclusiva para concluir a recuperação.";
    $("#toggle-auth-mode").textContent = "Voltar ao login";
  } else if (signup) {
    $("#auth-title").textContent = "Ativar acesso";
    $("#auth-subtitle").textContent = "Seu e-mail foi previamente autorizado pela administração da Astrion.";
  } else {
    $("#auth-title").textContent = "Entrar na plataforma";
    $("#auth-subtitle").textContent = "Acesso restrito a usuários autorizados.";
  }
}

function toggleAuthMode() {
  state.authMode = "login";
  history.replaceState(null, "", window.location.pathname);
  renderAuthMode();
}

async function handleLogin(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const { data, error } = await state.supabase.auth.signInWithPassword({ email: $("#login-email").value.trim(), password: $("#login-password").value });
    if (error) throw error;
    await hydrateOnline(data.user);
    startApp();
  } catch (error) { handleError(error); }
  finally { button.disabled = false; }
}

async function handleSignup(event) {
  event.preventDefault();
  const button = event.submitter;
  const password = $("#signup-password").value;
  if (!strongPassword(password)) {
    toast("Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.", "error");
    return;
  }
  button.disabled = true;
  try {
    const { data, error } = await state.supabase.auth.signUp({ email: $("#signup-email").value.trim().toLowerCase(), password, options: { data: { full_name: $("#signup-name").value.trim() } } });
    if (error) throw error;
    if (data.session) { await hydrateOnline(data.user); startApp(); }
    else {
      toast("Acesso criado. Confirme o e-mail para concluir a ativação.", "success");
      history.replaceState(null, "", window.location.pathname);
      state.authMode = "login";
      renderAuthMode();
    }
  } catch (error) { handleError(error); }
  finally { button.disabled = false; }
}

async function handleForgotPassword() {
  const email = $("#login-email").value.trim();
  if (!email) {
    toast("Informe o e-mail do usuário para redefinir a senha.", "error");
    $("#login-email").focus();
    return;
  }

  const button = $("#forgot-password");
  button.disabled = true;
  try {
    const redirectTo = new URL(window.location.pathname, window.location.origin).href;
    const { error } = await state.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    toast("Enviamos o link de redefinição para o e-mail informado.", "success");
  } catch (error) { handleError(error); }
  finally { button.disabled = false; }
}

async function handleRecoveryPassword(event) {
  event.preventDefault();
  const button = event.submitter;
  const password = $("#recovery-password").value;
  const confirmation = $("#recovery-password-confirm").value;

  if (!strongPassword(password)) {
    toast("Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo.", "error");
    return;
  }
  if (password !== confirmation) {
    toast("As senhas informadas não coincidem.", "error");
    return;
  }

  button.disabled = true;
  try {
    const { error } = await state.supabase.auth.updateUser({ password });
    if (error) throw error;
    await state.supabase.auth.signOut();
    history.replaceState(null, "", window.location.pathname);
    state.currentUser = state.profile = null;
    state.authMode = "login";
    $("#recovery-password").value = "";
    $("#recovery-password-confirm").value = "";
    renderAuthMode();
    showAuth();
    toast("Senha alterada com sucesso. Entre com a nova senha.", "success");
  } catch (error) { handleError(error); }
  finally { button.disabled = false; }
}

async function handleLogout() {
  await state.supabase.auth.signOut();
  state.currentUser = state.profile = null;
  showAuth();
}

function confirmAction(title, message, actionLabel = "Confirmar") {
  return new Promise(resolve => {
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-action").textContent = actionLabel;
    openLayer("confirm-modal");
    const backdrop = $("#confirm-modal .modal__backdrop");
    const onEscape = event => { if (event.key === "Escape") cleanup(false); };
    const cleanup = value => { closeLayer("confirm-modal"); $("#confirm-action").onclick = null; $("#confirm-cancel").onclick = null; backdrop.onclick = null; document.removeEventListener("keydown", onEscape); resolve(value); };
    $("#confirm-action").onclick = () => cleanup(true);
    $("#confirm-cancel").onclick = () => cleanup(false);
    backdrop.onclick = () => cleanup(false);
    document.addEventListener("keydown", onEscape);
  });
}

function toast(message, type = "") {
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "!" : "i"}</span><div>${escapeHTML(message)}</div>`;
  $("#toast-region").appendChild(element);
  setTimeout(() => element.remove(), 4200);
}

function handleError(error) {
  console.error(error);
  const translations = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "User already registered": "Este e-mail já possui cadastro.",
    "Email not confirmed": "Confirme seu e-mail antes de entrar."
  };
  toast(translations[error?.message] || error?.message || "Não foi possível concluir a ação.", "error");
}

initialize();
