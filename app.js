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
                <span class="question-subtext">${q.subtext || ''}</span>
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

// 6. Envío Robusto a Supabase + Google Sheets
// Flag global para prevenir envíos duplicados
let isSubmitting = false;

// Función para navegar entre secciones
window.validateAndNext = function () {
    const userName = document.getElementById('user-name').value.trim();
    const userProfile = document.getElementById('user-profile').value;
    const timeUsingAi = document.querySelector('input[name="time_using_ai"]:checked');
    const freqUsingAi = document.querySelector('input[name="frequency_using_ai"]:checked');

    if (!userName) {
        alert('Por favor, escribe tu nombre.');
        document.getElementById('user-name').focus();
        return;
    }
    if (!userProfile) {
        alert('Por favor, selecciona tu género.');
        document.getElementById('user-profile').focus();
        return;
    }
    if (!timeUsingAi) {
        alert('Por favor, indica cuánto tiempo llevas utilizando la IAG.');
        return;
    }
    if (!freqUsingAi) {
        alert('Por favor, indica con qué frecuencia utilizas la IAG.');
        return;
    }

    // Si todo es válido, cambiar de sección
    document.getElementById('section-1').classList.add('hidden');
    document.getElementById('section-2').classList.remove('hidden');
    window.scrollTo(0, 0); // Scroll al inicio para ver las preguntas
};

window.prevSection = function () {
    document.getElementById('section-2').classList.add('hidden');
    document.getElementById('section-1').classList.remove('hidden');
    window.scrollTo(0, 0);
};

const mainForm = document.getElementById('matrix-form');
if (mainForm) {
    mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // PROTECCIÓN CONTRA DUPLICADOS: Verificar si ya hay un envío en progreso
        if (isSubmitting) {
            console.warn("⚠️ Envío ya en progreso. Ignorando evento duplicado.");
            return;
        }

        // Generar ID único para esta transacción (para debugging)
        const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log(`📝 [${transactionId}] Evento submit capturado. Validando...`);

        const required = QUESTIONS.flatMap(q => [`past_${q.id}`, `now_${q.id}`]);
        const missing = required.filter(k => !responses[k]);

        if (missing.length > 0) {
            alert('Por favor, selecciona una opción para todas las categorías antes de enviar.');
            return;
        }

        const btn = document.getElementById('submit-btn');
        const userNameInput = document.getElementById('user-name');
        const userName = userNameInput ? userNameInput.value.trim() : "Anónimo";

        const userProfileInput = document.getElementById('user-profile');
        const userProfile = userProfileInput ? userProfileInput.value : "";

        // Capturar tiempo de uso de IA
        const timeUsingAiInput = document.querySelector('input[name="time_using_ai"]:checked');
        const timeUsingAi = timeUsingAiInput ? timeUsingAiInput.value : "";

        // Capturar frecuencia uso IA
        const freqUsingAiInput = document.querySelector('input[name="frequency_using_ai"]:checked');
        const freqUsingAi = freqUsingAiInput ? freqUsingAiInput.value : "";

        if (!userName && userNameInput) {
            alert('Por favor, introduce tu nombre.');
            return;
        }

        // DESACTIVAR INMEDIATAMENTE el botón y marcar como enviando
        isSubmitting = true;
        btn.disabled = true;
        btn.innerHTML = '<span>Guardando...</span>';
        console.log(`🔒 [${transactionId}] Botón desactivado y flag isSubmitting = true`);

        // Construir payload
        const payload = {
            "Fecha": new Date().toLocaleString(),
            "Usuario": userName,
            "Perfil": userProfile,
            "Tiempo Uso IAG": timeUsingAi,
            "Frecuencia Uso IAG": freqUsingAi
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

        console.log(`📦 [${transactionId}] Payload construido:`, payload);

        try {
            // PASO 1: Guardar en Supabase (Base de datos principal)
            console.log(`📊 [${transactionId}] Guardando en Supabase...`);
            btn.innerHTML = '<span>Guardando en base de datos...</span>';

            let supabaseRecord = null;
            let supabaseSaved = false;

            try {
                supabaseRecord = await saveToSupabase(payload);
                supabaseSaved = true;
                console.log(`✅ [${transactionId}] Datos guardados en Supabase:`, supabaseRecord);
            } catch (supabaseError) {
                console.warn(`⚠️ [${transactionId}] Supabase no disponible, continuando con Google Sheets:`, supabaseError.message);
                // Si Supabase falla, continuamos con Google Sheets
            }

            // PASO 2: Intentar sincronizar registros pendientes
            const webhook = (typeof WEBHOOK_URL !== 'undefined' ? WEBHOOK_URL : '') ||
                sessionStorage.getItem('temp_webhook') ||
                localStorage.getItem('google_sheet_webhook');

            // NOTA: NO sincronizamos registros pendientes aquí para evitar duplicados.
            // Los registros pendientes se sincronizarán automáticamente en el próximo envío.

            // PASO 3: Enviar a Google Sheets (con reintentos)
            if (webhook) {
                btn.innerHTML = '<span>Enviando a Google Sheets...</span>';
                console.log(`📤 [${transactionId}] Iniciando envío a Google Sheets...`);

                const maxRetries = 3;
                let retryCount = 0;
                let sheetSuccess = false;

                while (retryCount < maxRetries && !sheetSuccess) {
                    try {
                        console.log(`📤 [${transactionId}] Intento ${retryCount + 1}/${maxRetries} de envío a Google Sheets...`);

                        await fetch(webhook, {
                            method: 'POST',
                            mode: 'no-cors',
                            cache: 'no-cache',
                            body: JSON.stringify(payload)
                        });

                        sheetSuccess = true;
                        console.log(`✅ [${transactionId}] Datos enviados a Google Sheets`);

                        // Marcar como sincronizado en Supabase SOLO si se guardó exitosamente
                        if (supabaseSaved && supabaseRecord) {
                            await markAsSynced(supabaseRecord.id);
                            console.log(`✅ [${transactionId}] Registro marcado como sincronizado en Supabase`);
                        }

                    } catch (sheetError) {
                        retryCount++;
                        console.warn(`❌ [${transactionId}] Intento ${retryCount} falló:`, sheetError);

                        if (retryCount < maxRetries) {
                            // Esperar antes de reintentar (backoff exponencial)
                            const waitTime = Math.pow(2, retryCount) * 1000;
                            console.log(`⏳ [${transactionId}] Esperando ${waitTime}ms antes de reintentar...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    }
                }

                if (!sheetSuccess) {
                    console.warn(`⚠️ [${transactionId}] No se pudo enviar a Google Sheets después de 3 intentos`);
                    if (supabaseSaved) {
                        console.log(`💾 [${transactionId}] Los datos están guardados en Supabase y se sincronizarán automáticamente en el próximo envío`);
                    }
                }
            } else {
                console.warn(`⚠️ [${transactionId}] No hay webhook configurado para Google Sheets`);
            }

            // PASO 4: Mostrar éxito al usuario
            console.log(`✅ [${transactionId}] Proceso completado exitosamente`);
            setTimeout(() => {
                const modal = document.getElementById('modal-success');
                if (modal) modal.classList.remove('hidden');

                // Limpieza
                localStorage.removeItem('survey_responses');
                responses = {};
                if (userNameInput) userNameInput.value = "";
                document.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);

                // RESETEAR FLAG para permitir nuevos envíos
                isSubmitting = false;
                btn.disabled = false;
                btn.innerHTML = '<span>Enviar Resultados</span><i data-lucide="send" class="icon-right"></i>';
                if (window.lucide) lucide.createIcons();
                console.log(`🔓 [${transactionId}] Flag isSubmitting reseteado`);
            }, 600);

        } catch (err) {
            console.error(`❌ [${transactionId}] Error crítico en el envío:`, err);
            // Mostrar mensaje de error específico
            let errorMsg = 'Error al guardar los datos. ';
            if (err.message.includes('Supabase not configured')) {
                errorMsg += 'Por favor, configura Supabase en supabase-config.js';
            } else {
                errorMsg += 'Por favor, verifica tu conexión e intenta de nuevo.';
            }

            alert(errorMsg);

            // RESETEAR FLAG para permitir reintentos
            isSubmitting = false;
            btn.disabled = false;
            btn.innerHTML = '<span>Enviar Resultados</span><i data-lucide="send" class="icon-right"></i>';
            if (window.lucide) lucide.createIcons();
            console.log(`🔓 [${transactionId}] Flag isSubmitting reseteado después de error`);
        }
    });
}

// Función auxiliar para enviar a Google Sheets
async function sendToGoogleSheets(webhook, payload) {
    return fetch(webhook, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        body: JSON.stringify(payload)
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
            <input type="text" value="${q.subtext || ''}" onchange="updateQ(${i}, 'subtext', this.value)" placeholder="Descripción">
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
