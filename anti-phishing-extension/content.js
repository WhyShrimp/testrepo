/**
 * Content Script для Anti-Phishing Extension
 * 
 * Обрабатывает предупреждения от background.js и показывает UI уведомлений
 */

// Слушаем сообщения от Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Получено сообщение:', message);
    
    if (message.type === 'PHISHING_WARNING') {
        showWarningBanner(message.info);
        sendResponse({ received: true });
    } else if (message.type === 'PAGE_SCANNED') {
        // Сканирование страницы на наличие фишинговых форм
        scanPageForPhishing().then(result => {
            sendResponse(result);
        });
        return true; // Асинхронный ответ
    }
    
    return false;
});

/**
 * Показывает баннер предупреждения на странице
 * @param {object} info - Информация об угрозе
 */
function showWarningBanner(info) {
    // Проверяем, не показывали ли уже предупреждение
    if (document.getElementById('anti-phishing-warning')) {
        return;
    }
    
    const warningDiv = document.createElement('div');
    warningDiv.id = 'anti-phishing-warning';
    warningDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
            color: white;
            padding: 15px 20px;
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        ">
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-size: 24px;">⚠️</span>
                    <div>
                        <strong style="font-size: 16px;">Предупреждение системы безопасности</strong>
                        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${info.reason}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="ap-dismiss" style="
                        padding: 8px 16px;
                        border: 2px solid white;
                        background: transparent;
                        color: white;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Закрыть</button>
                    <button id="ap-report" style="
                        padding: 8px 16px;
                        border: none;
                        background: white;
                        color: #e74c3c;
                        border-radius: 6px;
                        cursor: pointer;
                        font-weight: bold;
                    ">Сообщить о фишинге</button>
                </div>
            </div>
        </div>
    `;
    
    document.documentElement.appendChild(warningDiv);
    
    // Обработчики кнопок
    document.getElementById('ap-dismiss').addEventListener('click', () => {
        warningDiv.remove();
    });
    
    document.getElementById('ap-report').addEventListener('click', () => {
        chrome.runtime.sendMessage({
            type: 'REPORT_PHISHING',
            url: window.location.href,
            details: {
                title: document.title,
                timestamp: Date.now()
            }
        });
        alert('Спасибо за сообщение! URL отправлен на проверку.');
        warningDiv.remove();
    });
}

/**
 * Сканирует страницу на наличие признаков фишинга
 * @returns {Promise<object>} - Результаты сканирования
 */
async function scanPageForPhishing() {
    const result = {
        isSuspicious: false,
        score: 0,
        findings: []
    };
    
    try {
        // 1. Проверка форм на подозрительные action URL
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            const action = form.action || '';
            if (action && !action.startsWith(window.location.origin)) {
                // Форма отправляет данные на внешний домен
                result.score += 15;
                result.findings.push({
                    type: 'external_form_action',
                    element: 'form',
                    action: action
                });
            }
            
            // Проверка на поля ввода пароля
            const passwordFields = form.querySelectorAll('input[type="password"]');
            if (passwordFields.length > 0) {
                result.score += 5;
                result.findings.push({
                    type: 'password_field',
                    count: passwordFields.length
                });
            }
        });
        
        // 2. Проверка на поддельные логотипы брендов
        const brandKeywords = ['sberbank', 'vk', 'yandex', 'mail.ru', 'gosuslugi', 'tinkoff', 'tbank'];
        const pageTitle = document.title.toLowerCase();
        const pageText = document.body.innerText.toLowerCase();
        
        for (const brand of brandKeywords) {
            if (pageTitle.includes(brand) || pageText.includes(brand)) {
                // Проверяем, является ли текущий домен официальным
                const currentDomain = window.location.hostname.toLowerCase();
                if (!currentDomain.includes(brand.split('.')[0])) {
                    result.score += 20;
                    result.findings.push({
                        type: 'brand_impersonation',
                        brand: brand,
                        domain: currentDomain
                    });
                }
            }
        }
        
        // 3. Проверка на срочность и угрозы в тексте
        const urgencyPatterns = [
            /срочно/i,
            /немедленно/i,
            /блокировк/i,
            /приостановк/i,
            /подтверждени/i,
            /верификаци/i,
            /urgent/i,
            /immediately/i,
            /suspended/i,
            /verify your account/i
        ];
        
        for (const pattern of urgencyPatterns) {
            if (pattern.test(pageText)) {
                result.score += 10;
                result.findings.push({
                    type: 'urgency_language',
                    pattern: pattern.toString()
                });
                break; // Достаточно одного совпадения
            }
        }
        
        // 4. Проверка HTTPS
        if (window.location.protocol === 'http:') {
            // Проверяем, есть ли формы с паролями на HTTP
            const hasPasswordFields = document.querySelectorAll('input[type="password"]').length > 0;
            if (hasPasswordFields) {
                result.score += 25;
                result.findings.push({
                    type: 'password_over_http',
                    url: window.location.href
                });
            }
        }
        
        // Определяем итоговую подозрительность
        if (result.score >= 30) {
            result.isSuspicious = true;
        }
        
    } catch (error) {
        console.error('[Content] Ошибка сканирования страницы:', error);
        result.error = error.message;
    }
    
    return result;
}

// Автосканирование при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        scanPageForPhishing().then(result => {
            if (result.isSuspicious) {
                console.warn('[Content] Страница помечена как подозрительная:', result);
                
                // Отправляем отчет в background
                chrome.runtime.sendMessage({
                    type: 'PAGE_SCAN_RESULT',
                    url: window.location.href,
                    result: result
                });
            }
        });
    });
} else {
    scanPageForPhishing().then(result => {
        if (result.isSuspicious) {
            console.warn('[Content] Страница помечена как подозрительная:', result);
            
            chrome.runtime.sendMessage({
                type: 'PAGE_SCAN_RESULT',
                url: window.location.href,
                result: result
            });
        }
    });
}

console.log('[Content] Anti-Phishing content script loaded');
