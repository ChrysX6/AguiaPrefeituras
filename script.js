const API_URL = "https://script.google.com/macros/s/AKfycbzcxNBZkbGPkrd6be_li7U3fS64YWa4TDjGWDw_uG4Gb4EYRZQccMQuPJKgr9wyIMKy/exec";
const TOKEN_KEY = "aguia_controle_token";

let empresas = [];
let authToken = sessionStorage.getItem(TOKEN_KEY) || null;

// --- Login ---

function mostrarLogin() {
  document.getElementById("loginOverlay").classList.remove("hidden");
  document.getElementById("appContainer").classList.add("hidden");
}

function esconderLogin() {
  document.getElementById("loginOverlay").classList.add("hidden");
  document.getElementById("appContainer").classList.remove("hidden");
}

function sessaoInvalida() {
  authToken = null;
  sessionStorage.removeItem(TOKEN_KEY);
  mostrarLogin();
}

document.getElementById("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  const senha = document.getElementById("loginSenha").value;
  const erroEl = document.getElementById("loginErro");
  erroEl.textContent = "";
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "login", password: senha })
    });
    const json = await res.json();
    if (json.success) {
      authToken = json.token;
      sessionStorage.setItem(TOKEN_KEY, authToken);
      document.getElementById("loginSenha").value = "";
      esconderLogin();
      carregarEmpresas();
    } else {
      erroEl.textContent = json.error || "Não foi possível entrar.";
    }
  } catch (err) {
    erroEl.textContent = "Erro de conexão. Tente novamente.";
  }
});

document.getElementById("btnSair").addEventListener("click", () => {
  sessaoInvalida();
});

// --- Utilitários ---

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Torna a comparação de Regime tolerante a "P"/"Presumido", maiúsculas/minúsculas e espaços,
// pra planilhas que tenham sido preenchidas de formas diferentes.
function normalizarRegime(valor) {
  const v = (valor || "").toString().trim().toUpperCase();
  if (v === "P" || v.startsWith("PRE")) return "P";
  if (v === "S" || v.startsWith("SIM")) return "S";
  if (v === "R" || v.startsWith("REA")) return "R";
  return v;
}

// --- Dados ---

async function carregarEmpresas() {
  const res = await fetch(`${API_URL}?action=list&token=${encodeURIComponent(authToken)}`);
  const json = await res.json();
  if (json.success === false && json.error === "unauthorized") {
    sessaoInvalida();
    return;
  }
  empresas = json.data || [];
  renderizarTabela();
}

function renderizarTabela() {
  const busca = document.getElementById("busca").value.toLowerCase();
  const cat = document.getElementById("filtroCategoria").value;
  const reg = document.getElementById("filtroRegime").value;
  const soAtivo = document.getElementById("filtroAtivo").checked;

  const filtradas = empresas.filter(emp => {
    const bateBusca = !busca ||
      (emp.Nome || "").toLowerCase().includes(busca) ||
      (emp.CNPJ_CPF || "").toString().toLowerCase().includes(busca) ||
      (emp.Socio || "").toLowerCase().includes(busca);
    const bateCat = !cat || emp.Categoria === cat;
    const bateReg = !reg || normalizarRegime(emp.Regime) === reg;
    const bateAtivo = !soAtivo || emp.Ativo === true || emp.Ativo === "TRUE";
    return bateBusca && bateCat && bateReg && bateAtivo;
  });

  const corpo = document.getElementById("corpoTabela");
  corpo.innerHTML = filtradas.map(emp => `
    <tr>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="Nome" data-tipo="texto" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.Nome)}</td>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="CNPJ_CPF" data-tipo="texto" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.CNPJ_CPF)}</td>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="Categoria" data-tipo="categoria" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.Categoria)}</td>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="Regime" data-tipo="regime" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.Regime)}</td>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="Login" data-tipo="texto" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.Login)}</td>
      <td class="cel-senha editavel" data-row="${emp.rowIndex}" data-campo="Senha" data-tipo="texto">
        <span class="senha-mascarada" onclick="ativarEdicaoCelula(event, this.parentElement)">••••••</span>
        <button type="button" class="btn-olho" onclick="event.stopPropagation(); alternarSenha(this, ${emp.rowIndex})" title="Mostrar/ocultar senha">👁</button>
      </td>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="Estado_Prefeitura" data-tipo="texto" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.Estado_Prefeitura)}</td>
      <td class="editavel" data-row="${emp.rowIndex}" data-campo="Socio" data-tipo="texto" onclick="ativarEdicaoCelula(event, this)">${escapeHtml(emp.Socio)}</td>
      <td class="editavel" onclick="alternarAtivo(event, ${emp.rowIndex})">${(emp.Ativo === true || emp.Ativo === "TRUE") ? '<span class="badge-ativo">Ativa</span>' : '<span class="badge-inativo">Inativa</span>'}</td>
      <td class="acoes">
        <button onclick="editarEmpresa(${emp.rowIndex})" title="Editar todos os campos">✏️</button>
        <button onclick="excluirEmpresa(event, ${emp.rowIndex})">Excluir</button>
      </td>
    </tr>
  `).join("");
}

// --- Edição estilo "célula" (como Excel) ---

function ativarEdicaoCelula(event, td) {
  event.stopPropagation();
  if (td.classList.contains("editando")) return;

  const rowIndex = parseInt(td.dataset.row);
  const campo = td.dataset.campo;
  const tipo = td.dataset.tipo;
  const emp = empresas.find(e => e.rowIndex === rowIndex);
  if (!emp) return;
  const valorAtual = emp[campo] || "";

  td.dataset.htmlOriginal = td.innerHTML;
  td.classList.add("editando");

  let inputEl;
  if (tipo === "categoria") {
    inputEl = document.createElement("select");
    ["Serviço", "Comércio", "MEI", "Associação", "Sem Movimento"].forEach(opt => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === valorAtual) o.selected = true;
      inputEl.appendChild(o);
    });
  } else if (tipo === "regime") {
    inputEl = document.createElement("select");
    [["P", "Presumido"], ["S", "Simples"], ["R", "Real"]].forEach(([valor, rotulo]) => {
      const o = document.createElement("option");
      o.value = valor;
      o.textContent = rotulo;
      if (normalizarRegime(valorAtual) === valor) o.selected = true;
      inputEl.appendChild(o);
    });
  } else {
    inputEl = document.createElement("input");
    inputEl.type = "text";
    inputEl.value = valorAtual;
  }
  inputEl.className = "input-celula";

  td.innerHTML = "";
  td.appendChild(inputEl);
  inputEl.focus();
  if (inputEl.select) inputEl.select();

  let finalizado = false;

  const confirmar = () => {
    if (finalizado) return;
    finalizado = true;
    const novoValor = inputEl.value;
    if (novoValor === valorAtual) {
      cancelarEdicaoCelula(td);
    } else {
      salvarCampo(rowIndex, campo, novoValor, td);
    }
  };

  const cancelar = () => {
    if (finalizado) return;
    finalizado = true;
    cancelarEdicaoCelula(td);
  };

  inputEl.addEventListener("blur", confirmar);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); inputEl.blur(); }
    if (e.key === "Escape") { e.preventDefault(); cancelar(); }
  });
  if (tipo === "categoria" || tipo === "regime") {
    inputEl.addEventListener("change", () => inputEl.blur());
  }
}

function cancelarEdicaoCelula(td) {
  td.innerHTML = td.dataset.htmlOriginal;
  td.classList.remove("editando");
}

async function salvarCampo(rowIndex, campo, valor, td) {
  td.classList.add("salvando");
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ action: "updateField", data: { rowIndex, campo, valor }, token: authToken })
    });
    const json = await res.json();
    if (json.success === false && json.error === "unauthorized") {
      sessaoInvalida();
      return;
    }
    if (json.success === false) {
      alert(json.error || "Não foi possível salvar.");
      cancelarEdicaoCelula(td);
      return;
    }
    const emp = empresas.find(e => e.rowIndex === rowIndex);
    if (emp) emp[campo] = valor;
    td.innerHTML = escapeHtml(valor);
    td.classList.remove("editando");
  } catch (err) {
    alert("Erro de conexão ao salvar.");
    cancelarEdicaoCelula(td);
  } finally {
    td.classList.remove("salvando");
  }
}

async function alternarAtivo(event, rowIndex) {
  event.stopPropagation();
  const emp = empresas.find(e => e.rowIndex === rowIndex);
  if (!emp) return;
  const novoValor = !(emp.Ativo === true || emp.Ativo === "TRUE");
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "updateField", data: { rowIndex, campo: "Ativo", valor: novoValor }, token: authToken })
  });
  const json = await res.json();
  if (json.success === false && json.error === "unauthorized") {
    sessaoInvalida();
    return;
  }
  if (json.success === false) {
    alert(json.error || "Não foi possível salvar.");
    return;
  }
  emp.Ativo = novoValor;
  renderizarTabela();
}

function alternarSenha(botao, rowIndex) {
  const emp = empresas.find(e => e.rowIndex === rowIndex);
  const span = botao.previousElementSibling;
  if (!span || span.tagName !== "SPAN") return; // célula está em modo de edição
  const mostrando = span.dataset.mostrando === "1";
  if (mostrando) {
    span.textContent = "••••••";
    span.dataset.mostrando = "0";
  } else {
    span.textContent = emp.Senha || "(sem senha)";
    span.dataset.mostrando = "1";
  }
}

// --- Modal completo (edição de todos os campos, incluindo os que não aparecem na tabela) ---

function abrirModal(empresa = null) {
  document.getElementById("modal").classList.remove("hidden");
  document.getElementById("modalTitulo").textContent = empresa ? "Editar Empresa" : "Nova Empresa";
  document.getElementById("rowIndex").value = empresa ? empresa.rowIndex : "";
  ["Nome", "CNPJ_CPF", "Categoria", "Regime", "Codigo_SN", "Login", "Senha",
   "Estado_Prefeitura", "Email", "Socio", "Entrada", "Saida", "Responsavel"].forEach(campo => {
    document.getElementById(campo).value = empresa ? (empresa[campo] || "") : "";
  });
  document.getElementById("Ativo").checked = empresa ? (empresa.Ativo === true || empresa.Ativo === "TRUE") : true;
}

function fecharModal() {
  document.getElementById("modal").classList.add("hidden");
}

function editarEmpresa(rowIndex) {
  const emp = empresas.find(e => e.rowIndex === rowIndex);
  abrirModal(emp);
}

async function excluirEmpresa(event, rowIndex) {
  event.stopPropagation();
  if (!confirm("Deseja realmente excluir esta empresa?")) return;
  const res = await fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete", id: rowIndex, token: authToken })
  });
  const json = await res.json();
  if (json.success === false && json.error === "unauthorized") {
    sessaoInvalida();
    return;
  }
  carregarEmpresas();
}

document.getElementById("btnNovo").addEventListener("click", () => abrirModal());
document.getElementById("btnCancelar").addEventListener("click", fecharModal);
document.getElementById("busca").addEventListener("input", renderizarTabela);
document.getElementById("filtroCategoria").addEventListener("change", renderizarTabela);
document.getElementById("filtroRegime").addEventListener("change", renderizarTabela);
document.getElementById("filtroAtivo").addEventListener("change", renderizarTabela);

document.getElementById("formEmpresa").addEventListener("submit", async (e) => {
  e.preventDefault();
  const rowIndex = document.getElementById("rowIndex").value;
  const data = {
    Nome: document.getElementById("Nome").value,
    CNPJ_CPF: document.getElementById("CNPJ_CPF").value,
    Categoria: document.getElementById("Categoria").value,
    Regime: document.getElementById("Regime").value,
    Codigo_SN: document.getElementById("Codigo_SN").value,
    Login: document.getElementById("Login").value,
    Senha: document.getElementById("Senha").value,
    Estado_Prefeitura: document.getElementById("Estado_Prefeitura").value,
    Email: document.getElementById("Email").value,
    Socio: document.getElementById("Socio").value,
    Entrada: document.getElementById("Entrada").value,
    Saida: document.getElementById("Saida").value,
    Responsavel: document.getElementById("Responsavel").value,
    Ativo: document.getElementById("Ativo").checked
  };

  let payload;
  if (rowIndex) {
    data.rowIndex = parseInt(rowIndex);
    payload = { action: "update", data, token: authToken };
  } else {
    payload = { action: "create", data, token: authToken };
  }

  const res = await fetch(API_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.success === false && json.error === "unauthorized") {
    sessaoInvalida();
    return;
  }
  fecharModal();
  carregarEmpresas();
});

// --- Início ---
if (authToken) {
  esconderLogin();
  carregarEmpresas();
} else {
  mostrarLogin();
}