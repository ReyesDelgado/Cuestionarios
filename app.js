/**
 * MATRIX ANALYSIS - CORE LOGIC
 * Las preguntas se cargan desde el bloque script en index.html
 */

// 2. Utilidades de Codificación Robustas
function robustEncode(obj) {
    try {
        const str = JSON.stringify(obj);
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        return "";
    }
}

function robustDecode(str) {
    try {
        if (!str) return null;
        const cleaned = str.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '+');
        const decoded = decodeURIComponent(escape(atob(cleaned)));
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

// 3. Inicialización de Estado sincronizada
const urlParams = new URLSearchParams(window.location.search);
const sharedD = urlParams.get('d');
const sharedW = urlParams.get('w');

let QUESTIONS = [];
let responses = JSON.parse(localStorage.getItem('survey_responses')) || {};

// Lógica de carga de preguntas (Prioriza URL, luego LocalStorage, luego DEFAULT en HTML)
if (sharedD) {
    const fromUrl = robustDecode(sharedD);
    QUESTIONS = (fromUrl && Array.isArray(fromUrl)) ? fromUrl : [...DEFAULT_QUESTIONS];
    if (sharedW) {
        try { sessionStorage.setItem('temp_webhook', atob(sharedW.replace(/\s/g, '+'))); } catch (e) { }
    }
} else {
    const local = localStorage.getItem('admin_questions');
    QUESTIONS = local ? JSON.parse(local) : [...DEFAULT_QUESTIONS];
}

// 4. Renderizado del Cuestionario
function renderQuestions() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    container.innerHTML = QUESTIONS.map(q => `
        <div class="question-row fade-in" data-id="${q.id}">
            <div class="question-text">
                <span class="category-title">${q.category}</span>
                <span class="question-subtext">${q.subtext}</span>
            </div>
            
            <div class="side-past">
                <div class="likert-group">
                    ${[1, 2, 3, 4, 5].map(val => `
                        <label class="likert-option">
                            <input type="radio" name="past_${q.id}" value="${val}" 
                                ${responses[`past_${q.id}`] == val ? 'checked' : ''} 
                                onchange="saveResponse('past_${q.id}', ${val})">
                            <div class="likert-circle"></div>
                            <span class="likert-label">${val}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="side-now">
                <div class="likert-group">
                    ${[1, 2, 3, 4, 5].map(val => `
                        <label class="likert-option">
                            <input type="radio" name="now_${q.id}" value="${val}" 
                                ${responses[`now_${q.id}`] == val ? 'checked' : ''} 
                                onchange="saveResponse('now_${q.id}', ${val})">
                            <div class="likert-circle"></div>
                            <span class="likert-label">${val}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');

    if (window.lucide) lucide.createIcons();
}

// 5. Gestión de Respuestas
window.saveResponse = function (key, value) {
    responses[key] = value;
    localStorage.setItem('survey_responses', JSON.stringify(responses));

    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
        saveStatus.innerHTML = '<i data-lucide="refresh-cw" class="icon-small spin"></i> Guardando...';
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
            saveStatus.innerHTML = '<i data-lucide="check-circle" class="icon-small"></i> Guardado automáticamente';
            if (window.lucide) lucide.createIcons();
        }, 800);
    }
};

// 6. Envío a Google Sheets
const mainForm = document.getElementById('matrix-form');
if (mainForm) {
    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("Evento submit capturado. Validando...");

        const required = QUESTIONS.flatMap(q => [`past_${q.id}`, `now_${q.id}`]);
        const missing = required.filter(k => !responses[k]);

        if (missing.length > 0) {
            alert('Por favor, selecciona una opción para todas las categorías antes de enviar.');
            return;
        }

        const btn = document.getElementById('submit-btn');
        const userNameInput = document.getElementById('user-name');
        const userName = userNameInput ? userNameInput.value.trim() : "Anónimo";

        if (!userName && userNameInput) {
            alert('Por favor, introduce tu nombre.');
            return;
        }

        btn.disabled = true;
        btn.innerHTML = '<span>Enviando...</span>';

        // Intentar recuperar el webhook de todas las fuentes posibles, priorizando el nuevo del HTML
        let webhook = (typeof WEBHOOK_URL !== 'undefined' ? WEBHOOK_URL : '') ||
            sessionStorage.getItem('temp_webhook') ||
            localStorage.getItem('google_sheet_webhook');

        if (!webhook) {
            console.error("WEBHOOK_URL no encontrada.");
            alert('Error: No se ha configurado la dirección de Google Sheets.');
            btn.disabled = false;
            btn.innerHTML = '<span>Enviar Resultados</span><i data-lucide="send" class="icon-right"></i>';
            if (window.lucide) lucide.createIcons();
            return;
        }

        console.log("Webhook destino:", webhook);


        // Recolectar datos dinámicamente basándonos en las preguntas actuales
        const payload = {
            "Fecha": new Date().toLocaleString(),
            "Usuario": userName
        };

        QUESTIONS.forEach(q => {
            const pv = responses[`past_${q.id}`];
            const nv = responses[`now_${q.id}`];
            if (pv !== undefined && nv !== undefined) {
                payload[`${q.category} (Pasado)`] = pv;
                payload[`${q.category} (Ahora)`] = nv;
                payload[`${q.category} (Diferencia)`] = nv - pv;
            }
        });




        try {
            console.log("Enviando payload...", payload);
            fetch(webhook, {
                method: 'POST',
                mode: 'no-cors',
                cache: 'no-cache',
                body: JSON.stringify(payload)
            }).then(() => console.log("Fetch disparado con éxito."))
                .catch(e => console.error("Error en Fetch:", e));

            // Mostramos éxito inmediatamente para mejor UX
            setTimeout(() => {
                const modal = document.getElementById('modal-success');
                if (modal) modal.classList.remove('hidden');

                // Limpieza
                localStorage.removeItem('survey_responses');
                responses = {};
                if (userNameInput) userNameInput.value = "";
                document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

                btn.disabled = false;
                btn.innerHTML = '<span>Enviar Resultados</span><i data-lucide="send" class="icon-right"></i>';
                if (window.lucide) lucide.createIcons();
            }, 600);

        } catch (err) {
            console.error("Error envío:", err);
            alert('Error de conexión. Revisa el Script de Google.');
            btn.disabled = false;
            btn.innerHTML = '<span>Enviar Resultados</span><i data-lucide="send" class="icon-right"></i>';
        }



    });
}

// 7. Funciones Admin
window.toggleAdmin = function () {
    const panel = document.getElementById('admin-panel');
    if (panel) {
        panel.classList.toggle('hidden');
        renderAdminQuestions();
        const urlIn = document.getElementById('webhook-url');
        if (urlIn) {
            urlIn.value = localStorage.getItem('google_sheet_webhook') ||
                (typeof WEBHOOK_URL !== 'undefined' ? WEBHOOK_URL : '');
        }
    }
};

window.saveWebhookUrl = (url) => localStorage.setItem('google_sheet_webhook', url);

function renderAdminQuestions() {
    const list = document.getElementById('admin-questions-list');
    if (!list) return;
    list.innerHTML = QUESTIONS.map((q, i) => `
        <div class="admin-q-item">
            <input type="text" value="${q.category}" onchange="updateQ(${i}, 'category', this.value)" placeholder="Categoría">
            <input type="text" value="${q.subtext}" onchange="updateQ(${i}, 'subtext', this.value)" placeholder="Descripción">
            <button onclick="removeQ(${i})" class="btn-icon">×</button>
        </div>
    `).join('');
}

window.addQuestion = () => {
    QUESTIONS.push({ id: 'q' + Date.now(), category: 'Nueva Categoría', subtext: 'Descripción' });
    localSaveQuestions();
    renderAdminQuestions();
    renderQuestions();
};

window.removeQ = (i) => {
    QUESTIONS.splice(i, 1);
    localSaveQuestions();
    renderAdminQuestions();
    renderQuestions();
};

window.updateQ = (i, f, v) => {
    QUESTIONS[i][f] = v;
    localSaveQuestions();
    renderQuestions();
};

function localSaveQuestions() {
    localStorage.setItem('admin_questions', JSON.stringify(QUESTIONS));
}

window.resetQuestions = () => {
    if (confirm('¿Reiniciar a valores por defecto?')) {
        QUESTIONS = [...DEFAULT_QUESTIONS];
        localStorage.removeItem('admin_questions');
        renderAdminQuestions();
        renderQuestions();
    }
};

window.generateShareLink = () => {
    const d = robustEncode(QUESTIONS);
    const w = localStorage.getItem('google_sheet_webhook');
    const url = window.location.origin + window.location.pathname + '?d=' + d + (w ? '&w=' + btoa(w) : '');
    navigator.clipboard.writeText(url).then(() => {
        const btn = document.getElementById('gen-link-btn');
        const old = btn.innerHTML;
        btn.innerHTML = 'Copiado ✅';
        setTimeout(() => { btn.innerHTML = old; if (window.lucide) lucide.createIcons(); }, 2000);
    });
};

function startup() {
    const gear = document.getElementById('admin-gear');
    if (gear) gear.style.display = sharedD ? 'none' : 'flex';
    renderQuestions();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startup);
} else {
    startup();
}
