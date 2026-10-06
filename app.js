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
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
  economicModels: [],
  economics: [],
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
const normalizeCNPJ = value => { const digits = String(value || "").replace(/\D/g, "").slice(0, 14); return digits.length === 14 ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : digits; };
const safeHttpUrl = value => { if (!value) return null; try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } };
const strongPassword = value => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(value);

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
      state.online = false;
      showAuth();
      $("#auth-title").textContent = "Base indisponível";
      $("#auth-subtitle").textContent = "Não foi possível conectar à base compartilhada. Nenhum dado de demonstração foi carregado.";
      toast("Falha de conexão com a base. Tente novamente em instantes.", "error");
      return;
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
  const [opportunitiesResult, profilesResult] = await Promise.all([
    state.supabase.from("opportunities").select("*").order("updated_at", { ascending: false }),
    state.supabase.from("profiles").select("*").order("full_name")
  ]);
  if (opportunitiesResult.error) throw opportunitiesResult.error;
  state.opportunities = opportunitiesResult.data || [];
  state.profiles = profilesResult.error ? [state.profile] : (profilesResult.data || [state.profile]);

  if (roleIsManager()) {
    const [modelsResult, economicsResult] = await Promise.all([
      state.supabase.from("economic_models").select("*").eq("active", true).order("sort_order"),
      state.supabase.from("opportunity_economics").select("*")
    ]);
    if (modelsResult.error) throw modelsResult.error;
    if (economicsResult.error) throw economicsResult.error;
    state.economicModels = modelsResult.data || [];
    state.economics = economicsResult.data || [];
  } else {
    state.economicModels = [];
    state.economics = [];
  }

  if (roleIsAdmin()) {
    const { data, error } = await state.supabase.from("access_allowlist").select("*").order("created_at", { ascending: false });
    state.accessAllowlist = error ? [] : (data || []);
  } else {
    state.accessAllowlist = [];
  }
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
  armSessionSecurity();
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
  hydrateCompanyLogos();
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

const STANDARD_MODEL = Object.freeze({
  salesMonths: 120,
  maxProductTerm: 216,
  operators: 50,
  clientsPerOperatorMonth: 250,
  operatorCostMonth: 7000,
  ramp: [0.2, 0.4, 0.6, 0.8, 0.9, 1],
  seasonality: [
    0.9821627906976744, 0.8843953488372094, 0.993906976744186, 0.8837209302325582,
    1.0809767441860465, 0.8957674418604651, 0.9767441860465116, 1.0232558139534884,
    1.1793953488372093, 1.2050697674418605, 1.0108837209302326, 0.8837209302325582
  ],
  conversionRate: 0.0175,
  cancellationLifetime: 0.15,
  defaultRate: 0.0235,
  cureRate: 0.5,
  creditGrowthAnnual: 0.045,
  discountRateAnnual: 0.18,
  revenueTaxRate: 0.1125,
  incomeTaxRate: 0.34,
  astrionRate: 0.0025,
  commissionInstallments: 10,
  squadFte: 6,
  squadCostPerFte: 25000,
  setupMonths: 6,
  capexNonPersonnel: 400000,
  squadRunoffRate: 0.3,
  opexIncrementalAdditional: 0,
  costPerActiveQuota: 0,
  segments: [
    { name: "Imóveis", credit: 222300, term: 216, adminRate: 0.2152, mix: 0.1723229620821773 },
    { name: "Automóveis", credit: 71200, term: 89, adminRate: 0.1831, mix: 0.3505251684502576 },
    { name: "Pesados", credit: 247700, term: 104, adminRate: 0.137, mix: 0.07088122605363985 },
    { name: "Serviços", credit: 15600, term: 39, adminRate: 0.2456, mix: 0.005392059717267803 },
    { name: "Motos", credit: 19300, term: 65, adminRate: 0.2005, mix: 0.28994913462808825 },
    { name: "Outros", credit: 8000, term: 58, adminRate: 0.2194, mix: 0.11092944906856916 }
  ]
});

const standardModelCache = new Map();

function isOuribank(opportunity) {
  return normalize(opportunity?.company).includes("ouribank");
}

function companyLogoUrl(opportunity) {
  const site = safeHttpUrl(opportunity?.website);
  if (!site) return null;
  try {
    const domain = new URL(site).hostname.replace(/^www\./, "");
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  } catch {
    return null;
  }
}

function companyLogoTemplate(opportunity, size = "md") {
  const logo = companyLogoUrl(opportunity);
  const fallback = initials(opportunity?.company || "?");
  const title = escapeHTML(opportunity?.company || "Empresa");
  return `<span class="company-logo company-logo--${size}" data-company-logo data-logo-src="${escapeHTML(logo || "")}" title="${title}">
    <span class="company-logo__fallback">${escapeHTML(fallback)}</span>
    <img alt="Marca ${title}" loading="lazy" decoding="async">
  </span>`;
}

function hydrateCompanyLogos(root = document) {
  root.querySelectorAll("[data-company-logo]").forEach(wrapper => {
    if (wrapper.dataset.logoReady === "1") return;
    wrapper.dataset.logoReady = "1";
    const img = wrapper.querySelector("img");
    const src = wrapper.dataset.logoSrc;
    if (!img || !src) return;
    img.addEventListener("load", () => wrapper.classList.add("logo-loaded"), { once: true });
    img.addEventListener("error", () => wrapper.classList.add("logo-failed"), { once: true });
    img.src = src;
  });
}

function partnerCommissionObligation(production) {
  return Math.min(production, 2000000) * 0.012
    + Math.max(Math.min(production - 2000000, 3000000), 0) * 0.015
    + Math.max(production - 5000000, 0) * 0.018;
}

function simulateStandardModel(baseClients) {
  const base = Math.max(0, Number(baseClients || 0));
  if (!base) return null;
  const cacheKey = String(base);
  if (standardModelCache.has(cacheKey)) return standardModelCache.get(cacheKey);

  const p = STANDARD_MODEL;
  const months = p.salesMonths + p.maxProductTerm;
  const monthlyGrowth = Math.pow(1 + p.creditGrowthAnnual, 1 / 12);
  const netDefault = p.defaultRate * (1 - p.cureRate);
  const retentionEconomic = (1 - p.cancellationLifetime) * (1 - netDefault);
  const capacity = p.operators * p.clientsPerOperatorMonth;
  const weightedTicket = p.segments.reduce((sum, segment) => sum + segment.credit * segment.mix, 0);
  const installmentFactor = (1 - netDefault) / p.commissionInstallments;

  const treatedCum = new Array(months + 1).fill(0);
  const sales = new Array(months + 1).fill(0);
  const production = new Array(months + 1).fill(0);
  const partnerObligation = new Array(months + 1).fill(0);
  const astrionObligation = new Array(months + 1).fill(0);
  const partnerPayment = new Array(months + 1).fill(0);
  const astrionPayment = new Array(months + 1).fill(0);
  const activeTotal = new Array(months + 1).fill(0);
  const newTA = Object.fromEntries(p.segments.map(segment => [segment.name, new Array(months + 1).fill(0)]));
  const taBalance = Object.fromEntries(p.segments.map(segment => [segment.name, new Array(months + 1).fill(0)]));
  const active = Object.fromEntries(p.segments.map(segment => [segment.name, new Array(months + 1).fill(0)]));

  const capexD0 = p.squadFte * p.squadCostPerFte * p.setupMonths + p.capexNonPersonnel;
  let vplIncremental = -capexD0;
  let cumulativeVpIncremental = -capexD0;
  let cumulativeVpFullTaxShield = -capexD0;
  let paybackIncremental = null;
  let paybackFull = null;
  let pvInsideSales = 0;
  let totalProduction = 0;
  let totalTaNominal = 0;
  let totalAstrionObligation = 0;
  let totalAstrionCash = 0;
  let totalPartnerObligation = 0;
  let totalTreated = 0;
  let totalSales = 0;
  let year1Production = 0;
  let year1Ta = 0;
  let year1AstrionObligation = 0;

  for (let month = 1; month <= months; month++) {
    let treated = 0;
    let monthSales = 0;
    let monthProduction = 0;
    let growthFactor = 0;

    if (month <= p.salesMonths) {
      const ramp = p.ramp[Math.min(month, p.ramp.length) - 1];
      const seasonality = p.seasonality[(month - 1) % 12];
      treated = Math.max(0, Math.min(capacity * ramp, base - treatedCum[month - 1]));
      treatedCum[month] = treatedCum[month - 1] + treated;
      monthSales = treated * p.conversionRate * seasonality;
      growthFactor = Math.pow(1 + p.creditGrowthAnnual, (month - 1) / 12);
      monthProduction = monthSales * weightedTicket * growthFactor;
    } else {
      treatedCum[month] = treatedCum[month - 1];
    }

    sales[month] = monthSales;
    production[month] = monthProduction;
    totalTreated += treated;
    totalSales += monthSales;
    totalProduction += monthProduction;

    let monthTaRevenue = 0;
    let monthActiveTotal = 0;

    p.segments.forEach(segment => {
      const newTa = monthSales * segment.mix * segment.credit * growthFactor * segment.adminRate / segment.term * retentionEconomic;
      newTA[segment.name][month] = newTa;
      const expiryMonth = month - segment.term;
      const expiredTa = expiryMonth >= 1 ? newTA[segment.name][expiryMonth] * Math.pow(monthlyGrowth, segment.term) : 0;
      taBalance[segment.name][month] = taBalance[segment.name][month - 1] * monthlyGrowth + newTa - expiredTa;

      const expiredActive = expiryMonth >= 1 ? sales[expiryMonth] * segment.mix * (1 - p.cancellationLifetime) : 0;
      active[segment.name][month] = active[segment.name][month - 1] + monthSales * segment.mix * (1 - p.cancellationLifetime) - expiredActive;

      monthTaRevenue += taBalance[segment.name][month];
      monthActiveTotal += active[segment.name][month];
    });

    activeTotal[month] = monthActiveTotal;
    totalTaNominal += monthTaRevenue;

    partnerObligation[month] = month <= p.salesMonths ? partnerCommissionObligation(monthProduction) : 0;
    astrionObligation[month] = month <= p.salesMonths ? monthProduction * p.astrionRate : 0;
    totalPartnerObligation += partnerObligation[month];
    totalAstrionObligation += astrionObligation[month];

    const prior = month - 1;
    const expiredInstallment = month - 11;
    partnerPayment[month] = partnerPayment[month - 1]
      + (prior >= 0 ? partnerObligation[prior] : 0) * installmentFactor
      - (expiredInstallment >= 0 ? partnerObligation[expiredInstallment] : 0) * installmentFactor;
    astrionPayment[month] = astrionPayment[month - 1]
      + (prior >= 0 ? astrionObligation[prior] : 0) * installmentFactor
      - (expiredInstallment >= 0 ? astrionObligation[expiredInstallment] : 0) * installmentFactor;
    totalAstrionCash += astrionPayment[month];

    const squadOpex = month <= p.salesMonths
      ? p.squadFte * p.squadCostPerFte
      : (monthActiveTotal > 0 ? p.squadFte * p.squadCostPerFte * p.squadRunoffRate : 0);
    const additionalOpex = monthActiveTotal > 0 ? p.opexIncrementalAdditional : 0;
    const insideSalesCost = month <= p.salesMonths ? p.operators * p.operatorCostMonth : 0;
    const runoffCost = monthActiveTotal * p.costPerActiveQuota;
    const revenueTax = monthTaRevenue * p.revenueTaxRate;

    const ebtIncremental = monthTaRevenue - partnerPayment[month] - astrionPayment[month] - squadOpex - additionalOpex - runoffCost - revenueTax;
    const incomeTaxIncremental = Math.max(0, ebtIncremental) * p.incomeTaxRate;
    const fcfIncremental = ebtIncremental - incomeTaxIncremental;

    const ebtFullTaxShield = ebtIncremental - insideSalesCost;
    const incomeTaxFull = Math.max(0, ebtFullTaxShield) * p.incomeTaxRate;
    const fcfFullTaxShield = ebtFullTaxShield - incomeTaxFull;

    const discountFactor = 1 / Math.pow(1 + p.discountRateAnnual, month / 12);
    const vpIncremental = fcfIncremental * discountFactor;
    const vpFullTaxShield = fcfFullTaxShield * discountFactor;

    vplIncremental += vpIncremental;
    cumulativeVpIncremental += vpIncremental;
    cumulativeVpFullTaxShield += vpFullTaxShield;
    pvInsideSales += insideSalesCost * discountFactor;

    if (paybackIncremental === null && cumulativeVpIncremental >= 0) paybackIncremental = month;
    if (paybackFull === null && cumulativeVpFullTaxShield >= 0) paybackFull = month;

    if (month <= 12) {
      year1Production += monthProduction;
      year1Ta += monthTaRevenue;
      year1AstrionObligation += astrionObligation[month];
    }
  }

  const result = {
    base,
    treatedClients: totalTreated,
    coverageRate: base ? totalTreated / base : 0,
    quotasSold: totalSales,
    productionHorizon: totalProduction,
    productionAverageMonth: totalProduction / p.salesMonths,
    taNominalHorizon: totalTaNominal,
    astrionRevenue: totalAstrionObligation,
    astrionCashExpected: totalAstrionCash,
    partnerCommissionObligation: totalPartnerObligation,
    vplIncremental,
    vplFullyLoaded: vplIncremental - pvInsideSales,
    paybackIncremental,
    paybackFull,
    year1Production,
    year1Ta,
    year1AstrionRevenue: year1AstrionObligation,
    capacityClients: capacity,
    maxTreatableClients: p.operators * p.clientsPerOperatorMonth * p.salesMonths,
    effectiveTreatableClients: totalTreated,
    capacityLimited: totalTreated < base
  };

  standardModelCache.set(cacheKey, result);
  return result;
}

function dashboardScenario(opportunity) {
  const base = Number(opportunity?.client_base || 0);
  const probability = Number(opportunity?.probability || 0);
  const economics = economicsFor(opportunity?.id);

  if (isOuribank(opportunity)) {
    const bp = economics?.bp_kpis || {};
    const astrion = Number(bp.astrion_fee ?? economics?.horizon_astrion_revenue ?? opportunity?.potential_revenue ?? 0);
    return {
      opportunity,
      method: "OURIBANK",
      base,
      astrionRevenue: astrion,
      weightedRevenue: astrion * probability / 100,
      probability,
      economics,
      model: null
    };
  }

  if (!base) {
    return {
      opportunity,
      method: "MISSING_BASE",
      base: 0,
      astrionRevenue: 0,
      weightedRevenue: 0,
      probability,
      economics,
      model: null
    };
  }

  const model = simulateStandardModel(base);
  return {
    opportunity,
    method: "STANDARD_10Y",
    base,
    astrionRevenue: model.astrionRevenue,
    weightedRevenue: model.astrionRevenue * probability / 100,
    probability,
    economics,
    model
  };
}

function opportunityHealth(opportunity) {
  let score = 0;
  const now = Date.now();
  const updatedAt = new Date(opportunity.updated_at || opportunity.created_at || 0).getTime();
  const ageDays = updatedAt ? (now - updatedAt) / 86400000 : 999;
  const economic = economicsFor(opportunity.id);

  if (opportunity.owner_id) score += 18;
  if (opportunity.contact_name || opportunity.contact_email || opportunity.contact_phone) score += 14;
  if (opportunity.next_action && opportunity.next_action_date) score += 22;
  if (opportunity.client_base) score += 12;
  if (economic) score += 12;
  if (opportunity.website || opportunity.cnpj) score += 7;
  if (opportunity.document_link) score += 5;
  if (ageDays <= 14) score += 10;
  if (isOverdue(opportunity)) score -= 15;
  if (ageDays > 30) score -= 8;

  score = Math.max(0, Math.min(100, score));
  const label = score >= 75 ? "Saudável" : score >= 50 ? "Atenção" : "Crítica";
  const tone = score >= 75 ? "good" : score >= 50 ? "warn" : "critical";
  return { score, label, tone, ageDays };
}

function compactMoney(value) {
  if (value === null || value === undefined) return "—";
  return compactCurrency.format(Number(value));
}

function renderDashboard() {
  if (!roleIsManager()) return;

  const active = state.opportunities.filter(opportunity => !["Ganha", "Perdida", "Pausada"].includes(opportunity.status));
  const scenarios = active.map(dashboardScenario);
  const standard = scenarios.filter(item => item.method === "STANDARD_10Y");
  const ouribank = scenarios.find(item => item.method === "OURIBANK");
  const missingBase = scenarios.filter(item => item.method === "MISSING_BASE");

  const standardAstrion = standard.reduce((sum, item) => sum + item.model.astrionRevenue, 0);
  const ouribankRevenue = ouribank?.astrionRevenue || 0;
  const totalRevenue = standardAstrion + ouribankRevenue;
  const weighted = scenarios.reduce((sum, item) => sum + item.weightedRevenue, 0);
  const productionHorizon = standard.reduce((sum, item) => sum + item.model.productionHorizon, 0);
  const taNominalHorizon = standard.reduce((sum, item) => sum + item.model.taNominalHorizon, 0);
  const vplIncremental = standard.reduce((sum, item) => sum + item.model.vplIncremental, 0);
  const vplFullyLoaded = standard.reduce((sum, item) => sum + item.model.vplFullyLoaded, 0);
  const treatedClients = standard.reduce((sum, item) => sum + item.model.treatedClients, 0);
  const quotasSold = standard.reduce((sum, item) => sum + item.model.quotasSold, 0);
  const mappedBase = standard.reduce((sum, item) => sum + item.base, 0);

  const inSevenDays = new Date(Date.now() + 7 * 86400000);
  const nextCount = active.filter(opportunity => opportunity.next_action_date && new Date(opportunity.next_action_date) >= new Date() && new Date(opportunity.next_action_date) <= inSevenDays).length;
  const overdue = active.filter(isOverdue);

  $("#kpi-potential").textContent = currency.format(totalRevenue);
  $("#kpi-potential-detail").textContent = `${currency.format(standardAstrion)} no modelo 10 anos + ${currency.format(ouribankRevenue)} Ouribank`;
  $("#kpi-weighted").textContent = currency.format(weighted);
  $("#kpi-production-horizon").textContent = currency.format(productionHorizon);
  $("#kpi-ta-horizon").textContent = currency.format(taNominalHorizon);
  $("#kpi-vpl-inc").textContent = currency.format(vplIncremental);
  $("#kpi-vpl-full").textContent = currency.format(vplFullyLoaded);
  $("#kpi-treated").textContent = number.format(Math.round(treatedClients));
  $("#kpi-treated-detail").textContent = `${mappedBase ? new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(treatedClients / mappedBase) : "—"} da base modelada`;
  $("#kpi-sales").textContent = new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(quotasSold);
  $("#kpi-sales-detail").textContent = `${standard.length} oportunidades no motor padronizado`;

  const rankedRevenue = [...scenarios].sort((x,y) => y.astrionRevenue - x.astrionRevenue);
  const maxRevenue = Math.max(...rankedRevenue.map(item => item.astrionRevenue), 1);
  $("#revenue-ranking").innerHTML = rankedRevenue.slice(0, 9).map((item,index) => {
    const opportunity = item.opportunity;
    const health = opportunityHealth(opportunity);
    const source = item.method === "OURIBANK" ? "BP próprio" : item.method === "MISSING_BASE" ? "Base pendente" : "Modelo econômico 10 anos";
    const detail = item.model ? `${number.format(Math.round(item.model.treatedClients))} tratados · ${new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(item.model.coverageRate)} da base` : source;
    return `<div class="ranking-row open-detail" data-id="${opportunity.id}">
      <span class="ranking-position">${String(index + 1).padStart(2,"0")}</span>
      ${companyLogoTemplate(opportunity,"sm")}
      <div class="ranking-main"><div class="ranking-title"><strong>${escapeHTML(opportunity.company)}</strong><span class="health-dot health-dot--${health.tone}" title="${health.label}"></span></div><small>${escapeHTML(detail)}</small><div class="ranking-track"><span style="width:${Math.max(item.astrionRevenue / maxRevenue * 100,item.astrionRevenue ? 2 : 0)}%"></span></div></div>
      <strong class="ranking-value">${item.astrionRevenue ? compactMoney(item.astrionRevenue) : "—"}</strong>
    </div>`;
  }).join("") || emptyTemplate("Nenhuma oportunidade ativa.");

  const productionRanked = [...standard].sort((x,y) => y.model.productionHorizon - x.model.productionHorizon);
  const maxProduction = Math.max(...productionRanked.map(item => item.model.productionHorizon),1);
  $("#production-ranking").innerHTML = productionRanked.slice(0,9).map((item,index) => `<div class="ranking-row open-detail" data-id="${item.opportunity.id}">
    <span class="ranking-position">${String(index + 1).padStart(2,"0")}</span>
    ${companyLogoTemplate(item.opportunity,"sm")}
    <div class="ranking-main"><div class="ranking-title"><strong>${escapeHTML(item.opportunity.company)}</strong></div><small>${new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(item.model.quotasSold)} cotas · VPL incr. ${compactMoney(item.model.vplIncremental)}</small><div class="ranking-track ranking-track--cyan"><span style="width:${Math.max(item.model.productionHorizon / maxProduction * 100,2)}%"></span></div></div>
    <strong class="ranking-value">${compactMoney(item.model.productionHorizon)}</strong>
  </div>`).join("") || emptyTemplate("Nenhuma base disponível para simulação.");

  const rows = ACTIVE_STATUSES.map(meta => {
    const items = scenarios.filter(item => item.opportunity.status === meta.value);
    return { ...meta, count: items.length, totalValue: items.reduce((sum,item) => sum + item.astrionRevenue,0) };
  });
  const max = Math.max(...rows.map(row => row.totalValue),1);
  $("#funnel-chart").innerHTML = rows.map(row => `<div class="funnel-row"><span class="funnel-row__label">${row.value}</span><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(row.totalValue / max * 100,row.count ? 3 : 0)}%"></div></div><span class="funnel-value">${row.count} · ${compactMoney(row.totalValue)}</span></div>`).join("");

  const healthRows = active.map(opportunity => ({ opportunity, ...opportunityHealth(opportunity) }));
  const healthGroups = [
    { label:"Saudável", tone:"good", color:"#079455", items:healthRows.filter(item => item.tone === "good") },
    { label:"Atenção", tone:"warn", color:"#f79009", items:healthRows.filter(item => item.tone === "warn") },
    { label:"Crítica", tone:"critical", color:"#d92d20", items:healthRows.filter(item => item.tone === "critical") }
  ];
  const totalHealth = Math.max(healthRows.length,1);
  let start = 0;
  const stops = healthGroups.map(group => { const from=start; start += group.items.length / totalHealth * 100; return `${group.color} ${from}% ${start}%`; }).join(", ");
  const avgHealth = healthRows.length ? Math.round(healthRows.reduce((sum,item) => sum + item.score,0) / healthRows.length) : 0;
  $("#health-chart").innerHTML = `<div class="donut" style="background:conic-gradient(${healthRows.length ? stops : "#e9edf3 0 100%"})"><div class="donut__center"><strong>${avgHealth}</strong><small>score médio</small></div></div><div class="health-legend">${healthGroups.map(group => `<span><i style="background:${group.color}"></i>${group.label}: ${group.items.length}</span>`).join("")}</div>`;
  $("#health-score-summary").innerHTML = `<span><strong>${active.filter(item => !item.next_action_date || !item.next_action).length}</strong> sem próximo passo</span><span><strong>${active.filter(item => !item.owner_id).length}</strong> sem responsável</span><span><strong>${active.filter(item => opportunityHealth(item).ageDays > 14).length}</strong> sem atualização &gt;14d</span>`;

  const positiveVpl = standard.filter(item => item.model.vplIncremental > 0).length;
  const positiveFull = standard.filter(item => item.model.vplFullyLoaded > 0).length;
  const fullyTreated = standard.filter(item => item.model.coverageRate >= 0.999999).length;
  const capacityLimited = standard.length - fullyTreated;
  $("#model-coverage-chart").innerHTML = [
    ["VPL incremental positivo", positiveVpl, standard.length ? positiveVpl / standard.length : 0, "bp"],
    ["VPL fully loaded positivo", positiveFull, standard.length ? positiveFull / standard.length : 0, "model"],
    ["Base integralmente tratada", fullyTreated, standard.length ? fullyTreated / standard.length : 0, "estimate"],
    ["Limitadas pela capacidade", capacityLimited, standard.length ? capacityLimited / standard.length : 0, "missing"],
    ["Sem base para modelar", missingBase.length, active.length ? missingBase.length / active.length : 0, "missing"]
  ].map(([label,count,ratio,tone]) => `<div class="coverage-row"><span class="coverage-icon coverage-icon--${tone}"></span><div><strong>${count}</strong><small>${label}</small></div><span class="coverage-percent">${Math.round(ratio * 100)}%</span></div>`).join("");

  const ouriEconomics = ouribank?.economics;
  const bp = ouriEconomics?.bp_kpis || {};
  const ouriItems = [
    ["Fee Astrion", bp.astrion_fee ?? ouribankRevenue, "money"],
    ["Implantação", bp.implantacao, "money"],
    ["Capital inicial", bp.capital_inicial, "money"],
    ["Funding máximo", bp.funding_maximo, "money"],
    ["Go-live", bp.go_live_mes, "month"],
    ["Break-even EBITDA", bp.break_even_ebitda_mes, "month"],
    ["Payback", bp.payback_mes, "month"],
    ["VPL M0", bp.vpl_m0, "money"],
    ["Produção horizonte", ouriEconomics?.horizon_production, "money"]
  ];
  $("#ouribank-spotlight").innerHTML = ouriItems.map(([label,value,type]) => `<div><small>${label}</small><strong>${value === null || value === undefined ? "—" : type === "money" ? compactMoney(value) : "M" + number.format(Number(value))}</strong></div>`).join("");

  const actions = active.filter(item => item.next_action_date).sort((x,y) => new Date(x.next_action_date) - new Date(y.next_action_date)).slice(0,6);
  $("#next-actions").innerHTML = actions.length ? actions.map(actionRowTemplate).join("") : emptyTemplate("Nenhuma próxima ação cadastrada.");

  const noOwner = active.filter(item => !item.owner_id).length;
  const noNext = active.filter(item => !item.next_action_date || !item.next_action).length;
  const stale = active.filter(item => Date.now() - new Date(item.updated_at).getTime() > 14 * 86400000).length;
  const negativeVpl = standard.filter(item => item.model.vplIncremental <= 0).length;
  const alerts = [
    overdue.length && { title:`${overdue.length} ${overdue.length === 1 ? "ação atrasada" : "ações atrasadas"}`, text:"Repriorize os compromissos vencidos." },
    missingBase.length && { title:`${missingBase.length} sem base de clientes`, text:"Sem base não é possível executar o motor econômico." },
    negativeVpl && { title:`${negativeVpl} com VPL incremental negativo`, text:"Bases menores podem não absorver os custos fixos do modelo padronizado." },
    noOwner && { title:`${noOwner} sem responsável`, text:"Defina a pessoa que conduzirá cada oportunidade." },
    noNext && { title:`${noNext} sem próximo passo`, text:"Todo negócio ativo deve ter ação e prazo definidos." },
    stale && { title:`${stale} sem atualização recente`, text:"Revise negócios sem movimentação há mais de 14 dias." }
  ].filter(Boolean);
  $("#pipeline-alerts").innerHTML = alerts.length ? alerts.map((alert,index) => `<div class="alert-item"><span>${index + 1}</span><div><strong>${alert.title}</strong><p>${alert.text}</p></div></div>`).join("") : `<div class="alert-item"><span>✓</span><div><strong>Pipeline em dia</strong><p>Nenhum alerta crítico foi identificado.</p></div></div>`;

  const executiveRows = [...scenarios].sort((x,y) => y.astrionRevenue - x.astrionRevenue);
  $("#executive-ranking-table").innerHTML = executiveRows.map(item => {
    const op = item.opportunity;
    const health = opportunityHealth(op);
    if (item.method === "OURIBANK") {
      return `<tr class="open-detail" data-id="${op.id}">
        <td><div class="company-cell">${companyLogoTemplate(op,"sm")}<div><strong>${escapeHTML(op.company)}</strong><small>${escapeHTML(op.segment || "Serviços financeiros")}</small></div></div></td>
        <td><span class="source-badge source-badge--bp_real">BP próprio</span></td><td>${op.client_base ? number.format(Number(op.client_base)) : "—"}</td>
        <td>—</td><td>—</td><td>—</td><td><strong>${compactMoney(item.astrionRevenue)}</strong></td><td>${compactMoney(Number(bp.vpl_m0 || 0))}</td><td>—</td>
        <td><span class="health-pill health-pill--${health.tone}">${health.label} · ${health.score}</span></td>
      </tr>`;
    }
    const model = item.model;
    return `<tr class="open-detail" data-id="${op.id}">
      <td><div class="company-cell">${companyLogoTemplate(op,"sm")}<div><strong>${escapeHTML(op.company)}</strong><small>${escapeHTML(op.segment || "Segmento a confirmar")}</small></div></div></td>
      <td>${item.method === "MISSING_BASE" ? '<span class="source-badge source-badge--missing">Sem base</span>' : '<span class="source-badge source-badge--estimativa_padrao">Modelo 10a</span>'}</td>
      <td>${op.client_base ? number.format(Number(op.client_base)) : "—"}</td>
      <td>${model ? number.format(Math.round(model.treatedClients)) : "—"}</td>
      <td>${model ? new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(model.quotasSold) : "—"}</td>
      <td>${model ? compactMoney(model.productionHorizon) : "—"}</td>
      <td><strong>${model ? compactMoney(model.astrionRevenue) : "—"}</strong></td>
      <td>${model ? compactMoney(model.vplIncremental) : "—"}</td>
      <td>${model ? new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(model.coverageRate) : "—"}</td>
      <td><span class="health-pill health-pill--${health.tone}">${health.label} · ${health.score}</span></td>
    </tr>`;
  }).join("");

  hydrateCompanyLogos($("#view-dashboard"));
}

function actionRowTemplate(opportunity) {
  const date = new Date(opportunity.next_action_date);
  return `<div class="action-row open-detail" data-id="${opportunity.id}"><span class="action-date"><strong>${String(date.getDate()).padStart(2,"0")}</strong>${date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>${companyLogoTemplate(opportunity, "xs")}<div><h4>${escapeHTML(opportunity.company)}</h4><p>${escapeHTML(opportunity.next_action)}</p></div><span class="time-tag ${isOverdue(opportunity) ? "overdue" : ""}">${date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></div>`;
}

function renderPipeline() {
  if (!roleIsManager()) return;
  const items = filteredOpportunities();
  const pipelineStatuses = STATUSES.filter(status => !["Perdida", "Pausada"].includes(status.value));
  const total = items.filter(item => !isClosed(item)).reduce((sum, item) => sum + dashboardScenario(item).astrionRevenue, 0);
  $("#pipeline-summary").innerHTML = `<span><strong>${items.length}</strong> registros visíveis</span><span>·</span><span><strong>${currency.format(total)}</strong> de receita Astrion modelada</span><span>·</span><span>Modelo econômico padronizado de 10 anos</span>`;
  $("#kanban").innerHTML = pipelineStatuses.map(meta => {
    const lane = items.filter(item => item.status === meta.value);
    const laneTotal = lane.reduce((sum, item) => sum + dashboardScenario(item).astrionRevenue, 0);
    return `<section class="kanban-lane" data-status="${meta.value}" style="--status-color:${meta.color}"><header class="lane-head"><span class="lane-title"><i class="lane-dot"></i>${meta.value}</span><span class="lane-count">${lane.length}</span></header><div class="lane-total">${currency.format(laneTotal)} · receita Astrion modelada</div><div class="lane-cards">${lane.map(kanbanCardTemplate).join("") || `<div class="empty-state">Nenhuma oportunidade</div>`}</div></section>`;
  }).join("");
  hydrateCompanyLogos($("#kanban"));
  bindKanbanDrag();
}

function kanbanCardTemplate(opportunity) {
  const owner = ownerFor(opportunity.owner_id);
  const scenario = dashboardScenario(opportunity);
  const health = opportunityHealth(opportunity);
  return `<article class="kanban-card open-detail" draggable="true" data-id="${opportunity.id}"><div class="kanban-card__top">${companyLogoTemplate(opportunity, "md")}<span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></div><h4>${escapeHTML(opportunity.company)} ${economicSourceBadge(opportunity.id)}</h4><span class="contact-line">${escapeHTML(opportunity.contact_name || opportunity.segment || "Contato a confirmar")}</span><p class="summary-line">${escapeHTML(opportunity.summary)}</p><div class="card-insights"><span>Receita <strong>${scenario.astrionRevenue ? compactMoney(scenario.astrionRevenue) : "—"}</strong></span><span>Saúde <strong class="health-text--${health.tone}">${health.score}</strong></span></div><div class="owner-cell"><span class="mini-avatar">${initials(owner?.full_name || "AD")}</span><span>${escapeHTML(owner?.full_name || "A definir")}</span></div><div class="kanban-card__meta"><strong>${scenario.method === "OURIBANK" ? "BP próprio" : scenario.method === "MISSING_BASE" ? "Sem base" : "Modelo 10a"}</strong><span class="due ${isOverdue(opportunity) ? "overdue" : ""}">${opportunity.next_action_date ? formatDate(opportunity.next_action_date) : "Sem prazo"}</span></div></article>`;
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
  const scenario = dashboardScenario(opportunity);
  return `<tr class="open-detail" data-id="${opportunity.id}"><td><div class="company-cell">${companyLogoTemplate(opportunity, "md")}<div><strong>${escapeHTML(opportunity.company)} ${economicSourceBadge(opportunity.id)}</strong><small>${escapeHTML(opportunity.summary)}</small></div></div></td><td><span class="status-pill" style="--status-color:${meta.color}">${opportunity.status}</span></td><td><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></td><td><strong>${scenario.astrionRevenue ? money(scenario.astrionRevenue) : "—"}</strong><small class="metric-caption">${scenario.method === "OURIBANK" ? "BP próprio" : scenario.method === "MISSING_BASE" ? "base pendente" : "Modelo 10a"}</small></td><td><div class="owner-cell"><span class="mini-avatar">${initials(owner?.full_name || "AD")}</span>${escapeHTML(owner?.full_name || "A definir")}</div></td><td><span class="due ${isOverdue(opportunity) ? "overdue" : ""}">${opportunity.next_action_date ? formatDate(opportunity.next_action_date) : "Sem prazo"}</span></td><td><button class="row-action" aria-label="Abrir oportunidade">→</button></td></tr>`;
}

function mobileOpportunityTemplate(opportunity) {
  const meta = statusMeta(opportunity.status);
  const scenario = dashboardScenario(opportunity);
  return `<article class="mobile-record open-detail" data-id="${opportunity.id}"><div class="mobile-record__head"><div class="mobile-company">${companyLogoTemplate(opportunity, "sm")}<strong>${escapeHTML(opportunity.company)}</strong></div><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></div><span class="status-pill" style="--status-color:${meta.color}">${opportunity.status}</span><p>${escapeHTML(opportunity.summary)}</p><div class="mobile-record__foot"><strong>${scenario.astrionRevenue ? money(scenario.astrionRevenue) : "—"}</strong><span>${opportunity.next_action_date ? formatDate(opportunity.next_action_date) : "Sem prazo"}</span></div></article>`;
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
  renderAccessPanel();
}

function renderAccessPanel() {
  const panel = $("#access-panel");
  if (!panel) return;
  const pending = state.accessAllowlist.filter(item => !item.used_at);
  $("#invite-count").textContent = `${pending.length} ${pending.length === 1 ? "convite" : "convites"}`;
  $("#invite-table").innerHTML = pending.length ? pending.map(item => `<tr data-email="${escapeHTML(item.email)}"><td><strong>${escapeHTML(item.full_name || "—")}</strong></td><td>${escapeHTML(item.email)}</td><td>${escapeHTML(ROLE_LABELS[item.role] || item.role)}</td><td><span class="status-pill" style="--status-color:${item.active ? "#079455" : "#98a2b3"}">${item.active ? "Autorizado" : "Suspenso"}</span></td><td class="invite-actions"><button class="row-action copy-invite" title="Copiar link">↗</button><button class="row-action toggle-invite" title="${item.active ? "Suspender" : "Reativar"}">${item.active ? "×" : "✓"}</button></td></tr>`).join("") : `<tr><td colspan="5">${emptyTemplate("Nenhum convite pendente.")}</td></tr>`;
  $("#invite-form").onsubmit = createAccessInvite;
  $("#invite-table").onclick = handleInviteAction;
}

async function createAccessInvite(event) {
  event.preventDefault();
  const email = $("#invite-email").value.trim().toLowerCase();
  const payload = { email, full_name: $("#invite-name").value.trim(), role: $("#invite-role").value, active: true, created_by: state.currentUser.id };
  try {
    const { error } = await state.supabase.from("access_allowlist").upsert(payload, { onConflict: "email" });
    if (error) throw error;
    await refreshOnlineData();
    renderTeam();
    $("#invite-form").reset();
    copyInviteLink(email);
    toast("Acesso autorizado e link de convite copiado.", "success");
  } catch (error) { handleError(error); }
}

function copyInviteLink(email) {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  url.searchParams.set("invite", "1");
  url.searchParams.set("email", email);
  navigator.clipboard?.writeText(url.href).catch(() => {});
  return url.href;
}

async function handleInviteAction(event) {
  const button = event.target.closest(".copy-invite, .toggle-invite");
  if (!button) return;
  const email = button.closest("tr").dataset.email;
  const invite = state.accessAllowlist.find(item => item.email === email);
  if (!invite) return;
  if (button.classList.contains("copy-invite")) {
    copyInviteLink(email);
    toast("Link de convite copiado.", "success");
    return;
  }
  try {
    const { error } = await state.supabase.from("access_allowlist").update({ active: !invite.active }).eq("email", email);
    if (error) throw error;
    await refreshOnlineData();
    renderTeam();
    toast(invite.active ? "Convite suspenso." : "Convite reativado.", "success");
  } catch (error) { handleError(error); }
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
    interests: Array.from(document.getElementsByName("interests")).filter(input => input.checked).map(input => input.value),
    potential_revenue: optionalNumber("#potential-revenue"), expected_sales: optionalNumber("#expected-sales"),
    status: roleIsManager() ? get("#status") : "Nova", priority: roleIsManager() ? get("#priority") : "Média",
    probability: roleIsManager() ? Number(get("#probability")) || 0 : 10, owner_id: roleIsManager() ? (get("#owner-id") || null) : null,
    next_action: roleIsManager() ? (get("#next-action") || null) : null, next_action_date: roleIsManager() ? toISO(get("#next-action-date")) : null,
    meeting_date: roleIsManager() ? toISO(get("#meeting-date")) : null, expected_close_date: roleIsManager() ? (get("#expected-close-date") || null) : null,
    document_link: roleIsManager() ? (documentLink || null) : null,
    loss_reason: roleIsManager() ? (get("#loss-reason") || null) : null
  };
}

async function persistStandardModel(opportunity) {
  if (!state.online || !roleIsManager() || !opportunity?.id || isOuribank(opportunity)) return;

  const base = Number(opportunity.client_base || 0);
  if (!base) {
    const { error: opportunityError } = await state.supabase.from("opportunities").update({ potential_revenue: null, expected_sales: null }).eq("id", opportunity.id);
    if (opportunityError) throw opportunityError;
    const { error: economicsError } = await state.supabase.from("opportunity_economics").upsert({
      opportunity_id: opportunity.id,
      model_key: "astrion_consorcios_padrao",
      source_type: "ESTIMATIVA_PADRAO",
      source_reference: "Modelo Astrion de Valuation de Consórcios — 10 anos",
      source_date: dateKey(new Date()),
      base_clients: null,
      projection_months: 120,
      notes: "Aguardando quantidade de clientes para executar o modelo econômico padronizado.",
      updated_by: state.currentUser.id
    }, { onConflict: "opportunity_id" });
    if (economicsError) throw economicsError;
    return;
  }

  const out = simulateStandardModel(base);
  const economicsPayload = {
    opportunity_id: opportunity.id,
    model_key: "astrion_consorcios_padrao",
    source_type: "ESTIMATIVA_PADRAO",
    source_reference: "Modelo Astrion de Valuation de Consórcios — 10 anos",
    source_date: dateKey(new Date()),
    base_clients: base,
    treatment_rate_month: null,
    fte_count: STANDARD_MODEL.operators,
    clients_per_fte_month: STANDARD_MODEL.clientsPerOperatorMonth,
    conversion_rate: STANDARD_MODEL.conversionRate * 100,
    average_ticket: STANDARD_MODEL.segments.reduce((sum, segment) => sum + segment.credit * segment.mix, 0),
    admin_fee_rate: 18.945222529274958,
    astrion_revenue_rate: STANDARD_MODEL.astrionRate * 100,
    upfront_fee: 0,
    projection_months: STANDARD_MODEL.salesMonths,
    capex: STANDARD_MODEL.squadFte * STANDARD_MODEL.squadCostPerFte * STANDARD_MODEL.setupMonths + STANDARD_MODEL.capexNonPersonnel,
    monthly_opex: STANDARD_MODEL.squadFte * STANDARD_MODEL.squadCostPerFte,
    year1_production: out.year1Production,
    year1_operation_revenue: out.year1Ta,
    year1_astrion_revenue: out.year1AstrionRevenue,
    horizon_production: out.productionHorizon,
    horizon_operation_revenue: out.taNominalHorizon,
    horizon_astrion_revenue: out.astrionRevenue,
    bp_kpis: {
      clientes_tratados_120m: out.treatedClients,
      cobertura_base: out.coverageRate,
      cotas_vendidas_120m: out.quotasSold,
      caixa_astrion_esperado: out.astrionCashExpected,
      vpl_incremental: out.vplIncremental,
      vpl_fully_loaded: out.vplFullyLoaded,
      payback_incremental_mes: out.paybackIncremental,
      payback_fully_loaded_mes: out.paybackFull
    },
    notes: "Premissas econômicas padronizadas. Nesta oportunidade varia somente a quantidade de clientes.",
    updated_by: state.currentUser.id
  };
  const { error: economicsError } = await state.supabase.from("opportunity_economics").upsert(economicsPayload, { onConflict: "opportunity_id" });
  if (economicsError) throw economicsError;

  const { error: opportunityError } = await state.supabase.from("opportunities").update({
    potential_revenue: out.astrionRevenue,
    expected_sales: out.productionHorizon
  }).eq("id", opportunity.id);
  if (opportunityError) throw opportunityError;
}

async function saveOpportunity(payload, id = null) {
  if (state.online) {
    const query = id ? state.supabase.from("opportunities").update(payload).eq("id", id) : state.supabase.from("opportunities").insert(payload);
    const { data, error } = await query.select().single();
    if (error) throw error;
    await persistStandardModel(data);
    await refreshOnlineData();
    return state.opportunities.find(item => item.id === data.id) || data;
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


const numericOrNull = value => value === "" || value === null || value === undefined ? null : Number(value);
const percent = value => value === null || value === undefined || value === "" ? "—" : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 }).format(Number(value))}%`;

function economicModelFor(key) {
  return state.economicModels.find(model => model.model_key === key) || null;
}
function economicsFor(opportunityId) {
  return state.economics.find(item => item.opportunity_id === opportunityId) || null;
}
function economicSourceBadge(opportunityId) {
  const opportunity = state.opportunities.find(item => item.id === opportunityId);
  if (!opportunity) return "";
  if (isOuribank(opportunity)) return '<span class="mini-source mini-source--bp_real">BP próprio</span>';
  if (!Number(opportunity.client_base || 0)) return '<span class="mini-source mini-source--missing">Sem base</span>';
  return '<span class="mini-source mini-source--estimativa_padrao">Modelo 10a</span>';
}

function calculateEconomics(economic = {}, opportunity = {}) {
  const baseClients = Number(economic.base_clients ?? opportunity.client_base ?? 0);
  const treatmentRate = Number(economic.treatment_rate_month || 0);
  const fteCount = Number(economic.fte_count || 0);
  const clientsPerFte = Number(economic.clients_per_fte_month || 0);
  const conversionRate = Number(economic.conversion_rate || 0);
  const averageTicket = Number(economic.average_ticket || 0);
  const adminFeeRate = Number(economic.admin_fee_rate || 0);
  const astrionRate = Number(economic.astrion_revenue_rate || 0);
  const upfrontFee = Number(economic.upfront_fee || 0);
  const months = Number(economic.projection_months || 0);
  const capex = Number(economic.capex || 0);
  const monthlyOpex = Number(economic.monthly_opex || 0);
  const accessoryMonthlyRevenue = Number(economic.accessory_monthly_revenue || 0);

  const coverageCapacity = baseClients > 0 && treatmentRate > 0 ? baseClients * treatmentRate / 100 : 0;
  const fteCapacity = fteCount > 0 && clientsPerFte > 0 ? fteCount * clientsPerFte : 0;
  let treatedClients = 0;
  if (coverageCapacity > 0 && fteCapacity > 0) treatedClients = Math.min(coverageCapacity, fteCapacity);
  else treatedClients = coverageCapacity || fteCapacity || 0;

  const conversions = treatedClients * conversionRate / 100;
  const monthlyProduction = conversions * averageTicket;
  const monthlyAdminEconomics = monthlyProduction * adminFeeRate / 100;
  const monthlyAstrionRevenue = monthlyProduction * astrionRate / 100;
  const astrionRevenueHorizon = monthlyAstrionRevenue * months + upfrontFee;
  const simpleOperatingResult = monthlyAdminEconomics + accessoryMonthlyRevenue - monthlyOpex;
  const simplePayback = capex > 0 && simpleOperatingResult > 0 ? capex / simpleOperatingResult : null;

  return {
    treatedClients, conversions, monthlyProduction, monthlyAdminEconomics,
    monthlyAstrionRevenue, astrionRevenueHorizon, simpleOperatingResult, simplePayback
  };
}

function bpKpisTemplate(economic) {
  const data = economic?.bp_kpis || {};
  const meta = {
    clientes_tratados_120m: ["Clientes tratados · 120m", "number"],
    cotas_vendidas_120m: ["Cotas vendidas · 120m", "number1"],
    vpl_integrado: ["VPL integrado", "money"],
    vpl_fully_loaded: ["VPL fully loaded", "money"],
    base_ativa_modelo: ["Base ativa do modelo", "number"],
    elegibilidade_pct: ["Elegibilidade", "percent"],
    conversao_pct: ["Conversão", "percent"],
    cotas_ano1: ["Cotas · ano 1", "number"],
    receita_5a: ["Receita · 5 anos", "money"],
    contratacoes_mes: ["Contratações / mês", "number1"],
    cotas_liquidas_ano: ["Cotas líquidas / ano", "number1"],
    persistencia_pct: ["Persistência", "percent"],
    valor_ecossistema_ano1: ["Valor ecossistema · ano 1", "money"],
    valor_ecossistema_5a: ["Valor ecossistema · 5 anos", "money"],
    compradores_5a: ["Compradores · 5 anos", "number"],
    cotas_5a: ["Cotas · 5 anos", "number"],
    penetracao_pct: ["Penetração", "percent"],
    remuneracao_parceiro_pct: ["Remuneração parceiro", "percent"],
    tributos_pct: ["Tributos", "percent"],
    implantacao: ["Implantação", "money"],
    capital_inicial: ["Capital inicial", "money"],
    funding_maximo: ["Funding máximo", "money"],
    go_live_mes: ["Go-live", "month"],
    break_even_ebitda_mes: ["Break-even EBITDA", "month"],
    payback_mes: ["Payback", "month"],
    ebitda_nominal_360m: ["EBITDA nominal · 360m", "money"],
    vpl_m0: ["VPL M0", "money"],
    cotas_ativas_maximas: ["Cotas ativas máximas", "number"]
  };
  const format = (value, type) => {
    if (type === "money") return currency.format(Number(value));
    if (type === "percent") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(Number(value)) + "%";
    if (type === "month") return "M" + number.format(Number(value));
    if (type === "number1") return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number(value));
    return number.format(Number(value));
  };
  const cards = Object.entries(data).filter(([key]) => meta[key]).map(([key, value]) => {
    const item = meta[key];
    return '<div><small>' + escapeHTML(item[0]) + '</small><strong>' + escapeHTML(format(value, item[1])) + '</strong></div>';
  });
  return cards.length ? '<div class="bp-kpi-grid">' + cards.join("") + '</div>' : "";
}

function economicDirectOutputsTemplate(economic) {
  if (!economic) return "";
  const labels = { BP_REAL: "BP realizado", MODELO_ESPECIFICO: "Modelo específico", ESTIMATIVA_PADRAO: "Estimativa pela base" };
  const sourceLabel = labels[economic.source_type] || "Premissas manuais";
  const cards = [];
  const addMoney = (label, value) => { if (value !== null && value !== undefined) cards.push('<div><small>' + escapeHTML(label) + '</small><strong>' + currency.format(Number(value)) + '</strong></div>'); };
  addMoney("Produção · ano 1", economic.year1_production);
  addMoney("Receita operação/parceiro · ano 1", economic.year1_operation_revenue);
  addMoney("Receita Astrion · ano 1", economic.year1_astrion_revenue);
  addMoney("Produção · horizonte", economic.horizon_production);
  addMoney("Receita operação/parceiro · horizonte", economic.horizon_operation_revenue);
  addMoney("Receita Astrion · horizonte", economic.horizon_astrion_revenue);
  const source = economic.source_reference ? '<p class="economic-source"><strong>Origem:</strong> ' + escapeHTML(economic.source_reference) + (economic.source_date ? ' · ' + formatDate(economic.source_date, { year: true }) : '') + '</p>' : '';
  return '<div class="bp-output-block"><div class="economic-title-row"><span class="source-badge source-badge--' + normalize(economic.source_type || "manual") + '">' + escapeHTML(sourceLabel) + '</span></div>' + (cards.length ? '<div class="bp-output-grid">' + cards.join("") + '</div>' : '') + bpKpisTemplate(economic) + source + '</div>';
}

function economicSummaryTemplate(economic, opportunity) {
  if (!roleIsManager()) return "";

  if (isOuribank(opportunity)) {
    if (!economic) return '<section class="detail-section detail-section--economics"><div class="detail-section__head"><div><span class="eyebrow">Business Plan</span><h3>Ouribank · administradora própria</h3><p>Os indicadores deste projeto são mantidos no BP específico da administradora própria.</p></div></div></section>';
    const model = economicModelFor(economic.model_key);
    return `<section class="detail-section detail-section--economics">
      <div class="detail-section__head"><div><span class="eyebrow">Business Plan próprio</span><h3>${escapeHTML(model?.name || "Ouribank · administradora própria")}</h3><p>${escapeHTML(economic.notes || model?.description || "")}</p></div><button class="btn btn--ghost btn--small" id="edit-economics" data-id="${opportunity.id}">Editar premissas</button></div>
      ${economicDirectOutputsTemplate(economic)}
      ${model?.source_note ? `<p class="economic-source"><strong>Referência:</strong> ${escapeHTML(model.source_note)}</p>` : ""}
    </section>`;
  }

  const base = Number(opportunity.client_base || 0);
  if (!base) {
    return `<section class="detail-section detail-section--economics"><div class="detail-section__head"><div><span class="eyebrow">Modelo econômico</span><h3>Base de clientes pendente</h3><p>Informe a quantidade de clientes para executar o modelo padronizado de 10 anos. Todas as demais premissas permanecem fixas.</p></div></div></section>`;
  }

  const out = simulateStandardModel(base);
  const pct = value => new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:2}).format(value);
  return `<section class="detail-section detail-section--economics">
    <div class="detail-section__head"><div><span class="eyebrow">Modelo econômico padronizado</span><h3>Projeção de 10 anos + run-off</h3><p>As premissas operacionais, comerciais, tributárias e de portfólio são idênticas em toda a carteira. Nesta oportunidade varia apenas a base de ${number.format(base)} clientes.</p></div><span class="source-badge source-badge--estimativa_padrao">Modelo 10a</span></div>
    <div class="bp-output-grid">
      <div><small>Base de clientes</small><strong>${number.format(base)}</strong></div>
      <div><small>Clientes tratados</small><strong>${number.format(Math.round(out.treatedClients))}</strong></div>
      <div><small>Cobertura da base</small><strong>${pct(out.coverageRate)}</strong></div>
      <div><small>Cotas estimadas</small><strong>${new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(out.quotasSold)}</strong></div>
      <div><small>Produção · 10 anos</small><strong>${currency.format(out.productionHorizon)}</strong></div>
      <div><small>TA nominal · run-off</small><strong>${currency.format(out.taNominalHorizon)}</strong></div>
      <div><small>Receita Astrion · obrigação</small><strong>${currency.format(out.astrionRevenue)}</strong></div>
      <div><small>Caixa Astrion esperado</small><strong>${currency.format(out.astrionCashExpected)}</strong></div>
      <div><small>VPL incremental</small><strong>${currency.format(out.vplIncremental)}</strong></div>
      <div><small>VPL fully loaded</small><strong>${currency.format(out.vplFullyLoaded)}</strong></div>
      <div><small>Payback incremental</small><strong>${out.paybackIncremental ? "M" + out.paybackIncremental : "Não atingido"}</strong></div>
      <div><small>Payback fully loaded</small><strong>${out.paybackFull ? "M" + out.paybackFull : "Não atingido"}</strong></div>
    </div>
    <div class="bp-kpi-grid">
      <div><small>Produção · ano 1</small><strong>${currency.format(out.year1Production)}</strong></div>
      <div><small>TA · ano 1</small><strong>${currency.format(out.year1Ta)}</strong></div>
      <div><small>Astrion · ano 1</small><strong>${currency.format(out.year1AstrionRevenue)}</strong></div>
      <div><small>Capacidade mensal plena</small><strong>${number.format(out.capacityClients)} clientes</strong></div>
    </div>
    <div class="economic-assumptions">
      <span>50 operadores</span><span>250 clientes/FTE/mês</span><span>Ramp-up 6 meses</span><span>Conversão 1,75%</span><span>Ticket inicial ${currency.format(87389.636180473)}</span><span>Reajuste 4,5% a.a.</span><span>Astrion 0,25%</span><span>Desconto 18% a.a.</span>
    </div>
    <p class="economic-source"><strong>Metodologia:</strong> 120 meses de novas vendas, clientes únicos, sazonalidade setorial, comissionamento em 10 parcelas e run-off integral das safras.</p>
  </section>`;
}

function populateEconomicModelOptions(selected = "") {
  const select = $("#economic-model-key");
  if (!select) return;
  select.innerHTML = `<option value="">Selecione um modelo</option>${state.economicModels.map(model => `<option value="${escapeHTML(model.model_key)}">${escapeHTML(model.name)}</option>`).join("")}`;
  select.value = selected || "";
}

function openEconomicsModal(opportunity, economic = null) {
  if (!roleIsManager()) return;
  $("#economics-form").reset();
  $("#economics-opportunity-id").value = opportunity.id;
  populateEconomicModelOptions(economic?.model_key || "");
  const map = {
    "economic-base-clients": economic?.base_clients ?? opportunity.client_base ?? "",
    "economic-treatment-rate": economic?.treatment_rate_month ?? "",
    "economic-fte-count": economic?.fte_count ?? "",
    "economic-clients-per-fte": economic?.clients_per_fte_month ?? "",
    "economic-conversion-rate": economic?.conversion_rate ?? "",
    "economic-average-ticket": economic?.average_ticket ?? "",
    "economic-admin-fee-rate": economic?.admin_fee_rate ?? "",
    "economic-astrion-rate": economic?.astrion_revenue_rate ?? "",
    "economic-upfront-fee": economic?.upfront_fee ?? "",
    "economic-projection-months": economic?.projection_months ?? "",
    "economic-capex": economic?.capex ?? "",
    "economic-monthly-opex": economic?.monthly_opex ?? "",
    "economic-accessory-revenue": economic?.accessory_monthly_revenue ?? "",
    "economic-notes": economic?.notes ?? ""
  };
  Object.entries(map).forEach(([id, value]) => { $("#" + id).value = value; });
  if (!economic && state.economicModels.length) {
    const preferred = opportunity.interests?.includes("Consórcios") ? "astrion_consorcios_padrao" : "custom";
    $("#economic-model-key").value = state.economicModels.some(m => m.model_key === preferred) ? preferred : state.economicModels[0].model_key;
    applyEconomicModelDefaults(false);
  } else {
    updateEconomicsPreview();
  }
  openLayer("economics-modal");
}

function applyEconomicModelDefaults(preserveCommercialInputs = true) {
  const model = economicModelFor($("#economic-model-key").value);
  if (!model) { updateEconomicsPreview(); return; }
  const defaults = model.defaults || {};
  const fields = {
    clients_per_fte_month: "#economic-clients-per-fte",
    conversion_rate: "#economic-conversion-rate",
    average_ticket: "#economic-average-ticket",
    admin_fee_rate: "#economic-admin-fee-rate",
    astrion_revenue_rate: "#economic-astrion-rate",
    upfront_fee: "#economic-upfront-fee",
    projection_months: "#economic-projection-months",
    capex: "#economic-capex",
    monthly_opex: "#economic-monthly-opex",
    accessory_monthly_revenue: "#economic-accessory-revenue"
  };
  Object.entries(fields).forEach(([key, selector]) => {
    if (Object.prototype.hasOwnProperty.call(defaults, key)) $(selector).value = defaults[key];
    else if (!preserveCommercialInputs) $(selector).value = "";
  });
  updateEconomicsPreview();
}

function economicFormPayload() {
  return {
    opportunity_id: $("#economics-opportunity-id").value,
    model_key: $("#economic-model-key").value,
    base_clients: numericOrNull($("#economic-base-clients").value),
    treatment_rate_month: numericOrNull($("#economic-treatment-rate").value),
    fte_count: numericOrNull($("#economic-fte-count").value),
    clients_per_fte_month: numericOrNull($("#economic-clients-per-fte").value),
    conversion_rate: numericOrNull($("#economic-conversion-rate").value),
    average_ticket: numericOrNull($("#economic-average-ticket").value),
    admin_fee_rate: numericOrNull($("#economic-admin-fee-rate").value),
    astrion_revenue_rate: numericOrNull($("#economic-astrion-rate").value),
    upfront_fee: numericOrNull($("#economic-upfront-fee").value),
    projection_months: numericOrNull($("#economic-projection-months").value),
    capex: numericOrNull($("#economic-capex").value),
    monthly_opex: numericOrNull($("#economic-monthly-opex").value),
    accessory_monthly_revenue: numericOrNull($("#economic-accessory-revenue").value),
    notes: $("#economic-notes").value.trim() || null,
    updated_by: state.currentUser?.id || null
  };
}

function updateEconomicsPreview() {
  const preview = $("#economics-preview");
  if (!preview) return;
  const opportunity = state.opportunities.find(item => item.id === $("#economics-opportunity-id").value) || {};
  const data = economicFormPayload();
  const model = economicModelFor(data.model_key);
  const out = calculateEconomics(data, opportunity);
  $("#economics-model-note").innerHTML = model ? `<strong>${escapeHTML(model.name)}</strong><span>${escapeHTML(model.source_note || model.description || "")}</span>` : "Selecione um modelo de referência.";
  preview.innerHTML = [
    ["Tratados / mês", number.format(Math.round(out.treatedClients))],
    ["Conversões / mês", new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(out.conversions)],
    ["Produção / mês", currency.format(out.monthlyProduction)],
    ["TA econômica / mês", currency.format(out.monthlyAdminEconomics)],
    ["Receita Astrion / mês", data.astrion_revenue_rate == null ? "—" : currency.format(out.monthlyAstrionRevenue)],
    ["Receita Astrion horizonte", data.astrion_revenue_rate == null && !Number(data.upfront_fee || 0) ? "—" : currency.format(out.astrionRevenueHorizon)]
  ].map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join("");
}

async function saveEconomics(event) {
  event.preventDefault();
  const payload = economicFormPayload();
  if (!payload.model_key) { toast("Selecione um modelo econômico.", "error"); return; }
  const button = $("#save-economics");
  button.disabled = true;
  try {
    if (!state.online) throw new Error("O modelo econômico só pode ser salvo na base compartilhada.");
    const { error } = await state.supabase.from("opportunity_economics").upsert(payload, { onConflict: "opportunity_id" });
    if (error) throw error;
    const opportunity = state.opportunities.find(item => item.id === payload.opportunity_id);
    const out = calculateEconomics(payload, opportunity || {});
    const summaryChanges = {};
    if (out.monthlyProduction > 0) summaryChanges.expected_sales = out.monthlyProduction;
    if (payload.astrion_revenue_rate != null || Number(payload.upfront_fee || 0) > 0) {
      summaryChanges.potential_revenue = out.monthlyAstrionRevenue * 12 + Number(payload.upfront_fee || 0);
    }
    if (Object.keys(summaryChanges).length) {
      const { error: opportunityError } = await state.supabase.from("opportunities").update(summaryChanges).eq("id", payload.opportunity_id);
      if (opportunityError) throw opportunityError;
      await refreshOnlineData();
    }
    closeLayer("economics-modal");
    toast("Modelo econômico atualizado.", "success");
    await openDetail(payload.opportunity_id);
  } catch (error) { handleError(error); }
  finally { button.disabled = false; }
}

async function openDetail(id) {
  const opportunity = state.opportunities.find(item => item.id === id);
  if (!opportunity) return;
  let activities, history, economics = null;
  if (state.online) {
    const economicsQuery = roleIsManager()
      ? state.supabase.from("opportunity_economics").select("*").eq("opportunity_id", id).maybeSingle()
      : Promise.resolve({ data: null, error: null });
    const [activitiesResult, historyResult, economicsResult] = await Promise.all([
      state.supabase.from("activities").select("*").eq("opportunity_id", id).order("activity_date", { ascending: false }),
      state.supabase.from("opportunity_history").select("*").eq("opportunity_id", id).order("created_at", { ascending: false }).limit(25),
      economicsQuery
    ]);
    activities = activitiesResult.data || [];
    history = historyResult.data || [];
    economics = economicsResult?.error ? null : (economicsResult?.data || null);
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
    <section class="detail-hero">${(() => {
      const scenario = dashboardScenario(opportunity);
      const health = opportunityHealth(opportunity);
      const method = scenario.method === "OURIBANK" ? "BP próprio" : scenario.method === "MISSING_BASE" ? "Base pendente" : "Modelo econômico · 10 anos";
      const production = scenario.model?.productionHorizon ?? economics?.horizon_production ?? null;
      const thirdLabel = scenario.method === "OURIBANK" ? "VPL do BP" : "VPL incremental";
      const thirdValue = scenario.method === "OURIBANK" ? Number(economics?.bp_kpis?.vpl_m0 || 0) : scenario.model?.vplIncremental;
      const fourthLabel = scenario.method === "OURIBANK" ? "Probabilidade" : "Cobertura da base";
      const fourthValue = scenario.method === "OURIBANK" ? `${opportunity.probability || 0}%` : scenario.model ? new Intl.NumberFormat("pt-BR",{style:"percent",maximumFractionDigits:1}).format(scenario.model.coverageRate) : "—";
      return `<div class="detail-company-head">${companyLogoTemplate(opportunity, "md")}<div><span class="detail-method">${method}</span><strong class="health-pill health-pill--${health.tone}">${health.label} · ${health.score}</strong></div></div><div class="detail-hero__top"><span class="status-pill" style="--status-color:${meta.color}">${opportunity.status}</span><span class="priority priority--${normalize(opportunity.priority)}">${opportunity.priority}</span></div><p>${escapeHTML(opportunity.summary)}</p><div class="detail-metrics"><div><small>Receita Astrion modelada</small><strong>${scenario.astrionRevenue ? money(scenario.astrionRevenue) : "—"}</strong></div><div><small>Produção · horizonte</small><strong>${production == null ? "—" : money(production)}</strong></div><div><small>${thirdLabel}</small><strong>${thirdValue == null ? "—" : money(thirdValue)}</strong></div><div><small>${fourthLabel}</small><strong>${fourthValue}</strong></div></div>`;
    })()}</section>
    ${economicSummaryTemplate(economics, opportunity)}
    ${roleIsManager() ? `<section class="detail-section"><h3>Condução comercial</h3><div class="inline-edit"><label>Etapa<select id="detail-status">${STATUSES.map(item => `<option ${item.value === opportunity.status ? "selected" : ""}>${item.value}</option>`).join("")}</select></label><label>Próxima ação<input id="detail-next-action" value="${escapeHTML(opportunity.next_action || "")}" placeholder="Defina o próximo passo"></label><label>Prazo<input id="detail-next-date" type="datetime-local" value="${toLocalInput(opportunity.next_action_date)}"></label><button class="btn btn--primary btn--small" id="save-quick-update" data-id="${id}">Atualizar condução</button></div></section>` : ""}
    <section class="detail-section"><h3>Empresa e contato</h3><div class="detail-grid"><div><small>CNPJ</small><strong>${escapeHTML(opportunity.cnpj || "Não informado")}</strong></div><div><small>Site</small>${safeHttpUrl(opportunity.website) ? `<a href="${escapeHTML(safeHttpUrl(opportunity.website))}" target="_blank" rel="noopener noreferrer">Abrir site ↗</a>` : "<strong>Não informado</strong>"}</div><div><small>Segmento</small><strong>${escapeHTML(opportunity.segment || "A confirmar")}</strong></div><div><small>Origem</small><strong>${escapeHTML(opportunity.source || "Não informada")}</strong></div><div><small>Contato</small><strong>${escapeHTML(opportunity.contact_name || "A confirmar")}${opportunity.contact_role ? ` · ${escapeHTML(opportunity.contact_role)}` : ""}</strong></div><div><small>E-mail</small>${opportunity.contact_email ? `<a href="mailto:${escapeHTML(opportunity.contact_email)}">${escapeHTML(opportunity.contact_email)}</a>` : "<strong>Não informado</strong>"}</div><div><small>Telefone</small><strong>${escapeHTML(opportunity.contact_phone || "Não informado")}</strong></div><div><small>Base potencial</small><strong>${opportunity.client_base !== null && opportunity.client_base !== undefined ? number.format(opportunity.client_base) : "Não informada"}</strong></div></div></section>
    <section class="detail-section"><h3>Soluções e particularidades</h3><div class="detail-tags">${(opportunity.interests || []).map(item => `<span>${escapeHTML(item)}</span>`).join("") || "<span>A confirmar</span>"}</div><p style="color:var(--ink-500);font-size:10px;line-height:1.6;margin:12px 0 0">${escapeHTML(opportunity.particularities || "Nenhuma particularidade registrada.")}</p></section>
    <section class="detail-section"><h3>Datas e referências</h3><div class="detail-grid"><div><small>Próxima ação</small><strong class="${isOverdue(opportunity) ? "due overdue" : ""}">${escapeHTML(opportunity.next_action || "A definir")} · ${formatDate(opportunity.next_action_date, { time: true })}</strong></div><div><small>Reunião</small><strong>${formatDate(opportunity.meeting_date, { time: true })}</strong></div><div><small>Fechamento previsto</small><strong>${formatDate(opportunity.expected_close_date, { year: true })}</strong></div><div><small>Responsável</small><strong>${escapeHTML(owner?.full_name || "A definir")}</strong></div><div><small>Criada em</small><strong>${formatDate(opportunity.created_at, { time: true, year: true })}</strong></div><div><small>Última atualização</small><strong>${formatDate(opportunity.updated_at, { time: true, year: true })}</strong></div>${safeHttpUrl(opportunity.document_link) ? `<div><small>Documento</small><a href="${escapeHTML(safeHttpUrl(opportunity.document_link))}" target="_blank" rel="noopener noreferrer">Abrir documento ↗</a></div>` : ""}${opportunity.loss_reason ? `<div class="span-2"><small>Motivo da perda</small><strong>${escapeHTML(opportunity.loss_reason)}</strong></div>` : ""}</div></section>
    ${roleIsManager() ? `<section class="detail-section"><h3>Registrar atividade</h3><form id="activity-form" class="activity-form"><select id="activity-type"><option>Nota</option><option>Ligação</option><option>E-mail</option><option>Reunião</option><option>Tarefa</option></select><input id="activity-description" required placeholder="Descreva a interação ou decisão"><button class="btn btn--primary btn--small" type="submit">Adicionar</button></form></section>` : ""}
    <section class="detail-section"><h3>Histórico</h3><div class="timeline">${timeline.length ? timeline.map(item => `<div class="timeline-item"><strong>${escapeHTML(item.kind)}</strong><p>${escapeHTML(item.text)}</p><time>${formatDate(item.date, { time: true, year: true })} · ${escapeHTML(item.user)}</time></div>`).join("") : emptyTemplate("Ainda não há movimentações.")}</div></section>
    <div class="detail-actions">${roleIsManager() ? `<button class="btn btn--ghost" id="edit-opportunity" data-id="${id}">Editar cadastro</button>` : ""}${roleIsAdmin() ? `<button class="btn btn--danger" id="delete-opportunity" data-id="${id}">Excluir</button>` : ""}</div>`;
  openLayer("detail-drawer");
  hydrateCompanyLogos($("#detail-drawer"));
  bindDetailActions(id, economics);
}

function historyDescription(item) {
  if (item.event_type === "status_changed") return `Status alterado de ${item.old_data?.status || "—"} para ${item.new_data?.status || "—"}`;
  return item.event_type === "created" ? "Oportunidade cadastrada" : "Cadastro atualizado";
}

function bindDetailActions(id, economics = null) {
  $("#edit-opportunity")?.addEventListener("click", () => { closeLayer("detail-drawer"); openOpportunityModal(state.opportunities.find(item => item.id === id)); });
  $("#edit-economics")?.addEventListener("click", () => openEconomicsModal(state.opportunities.find(item => item.id === id), economics));
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
  $("#economics-form").addEventListener("submit", saveEconomics);
  $("#economic-model-key").addEventListener("change", () => applyEconomicModelDefaults(false));
  $("#economics-form").addEventListener("input", event => { if (event.target.id !== "economic-model-key") updateEconomicsPreview(); });
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
  const headers = [
    "Empresa","CNPJ","Site","Status","Prioridade","Segmento","Canal","Origem","Base de clientes",
    "Contato","Cargo","E-mail","Telefone","Soluções",
    "Método econômico","Clientes tratados","Cobertura da base","Cotas estimadas",
    "Produção ano 1","TA ano 1","Receita Astrion ano 1",
    "Produção 10 anos","TA nominal run-off","Receita Astrion obrigação","Caixa Astrion esperado",
    "VPL incremental","VPL fully loaded","Payback incremental","Payback fully loaded",
    "Probabilidade","Receita ponderada","Health score","Health status",
    "Fonte econômica","Referência econômica",
    "Responsável","Próxima ação","Prazo","Reunião","Previsão de fechamento","Documento","Motivo de perda",
    "Resumo","Particularidades","Criado em","Atualizado em"
  ];
  const rows = filteredOpportunities().map(item => {
    const scenario = dashboardScenario(item);
    const health = opportunityHealth(item);
    const economic = economicsFor(item.id);
    const model = scenario.model;
    const ouri = scenario.method === "OURIBANK";
    return [
      item.company,item.cnpj,item.website,item.status,item.priority,item.segment,item.channel,item.source,item.client_base,
      item.contact_name,item.contact_role,item.contact_email,item.contact_phone,(item.interests||[]).join(", "),
      ouri ? "BP próprio" : scenario.method === "MISSING_BASE" ? "Sem base" : "Modelo econômico padronizado 10 anos",
      model?.treatedClients,model?.coverageRate,model?.quotasSold,
      model?.year1Production,model?.year1Ta,model?.year1AstrionRevenue,
      model?.productionHorizon ?? (ouri ? economic?.horizon_production : null),
      model?.taNominalHorizon ?? (ouri ? economic?.horizon_operation_revenue : null),
      scenario.astrionRevenue,model?.astrionCashExpected,
      model?.vplIncremental ?? (ouri ? economic?.bp_kpis?.vpl_m0 : null),
      model?.vplFullyLoaded,model?.paybackIncremental,model?.paybackFull,
      item.probability,scenario.weightedRevenue,health.score,health.label,
      economic?.source_type,economic?.source_reference,
      ownerName(item.owner_id),item.next_action,item.next_action_date,item.meeting_date,item.expected_close_date,item.document_link,item.loss_reason,
      item.summary,item.particularities,item.created_at,item.updated_at
    ];
  });
  const csv = "\ufeff" + [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(";")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  link.download = `crm-astrion-modelo-economico-${dateKey(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Relatório econômico e comercial exportado em CSV.", "success");
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

let idleLogoutTimer = null;
let sessionSecurityBound = false;
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function resetIdleLogoutTimer() {
  if (!state.online || !state.currentUser) return;
  clearTimeout(idleLogoutTimer);
  idleLogoutTimer = setTimeout(async () => {
    await handleLogout();
    toast("Sessão encerrada após 2 horas de inatividade.", "error");
  }, IDLE_TIMEOUT_MS);
}

function armSessionSecurity() {
  if (!state.online || !state.currentUser) return;
  resetIdleLogoutTimer();
  if (sessionSecurityBound) return;
  sessionSecurityBound = true;
  ["pointerdown","keydown","touchstart"].forEach(eventName => document.addEventListener(eventName, resetIdleLogoutTimer, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resetIdleLogoutTimer(); });
}

async function handleLogout() {
  clearTimeout(idleLogoutTimer);
  if (state.supabase) await state.supabase.auth.signOut();
  state.currentUser = state.profile = null;
  state.economics = [];
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
    "Email not confirmed": "Confirme seu e-mail antes de entrar.",
    "Database error saving new user": "Este e-mail não está autorizado ou o convite não está ativo."
  };
  const raw = error?.message || "";
  const friendly = raw.includes("duplicate key") && raw.includes("opportunities_cnpj_unique") ? "Já existe uma oportunidade cadastrada com este CNPJ." : (translations[raw] || raw || "Não foi possível concluir a ação.");
  toast(friendly, "error");
}

initialize();
