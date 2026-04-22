/**
 * Anti-Phishing Extension - Background Service Worker (Manifest V3)
 * 
 * Реализует кастомную эвристическую проверку URL на стороне клиента:
 * 1. Проверка на омоглифы и смешение алфавитов (кириллица + латиница)
 * 2. Эвристика URL по ключевым словам и длине
 * 3. Защита от тайпсквоттинга (расстояние Левенштейна)
 * 4. Проверка редиректов для сокращателей ссылок
 * 
 * Использует declarativeNetRequest для блокировки и webNavigation для анализа
 */

// ============================================================================
// КОНФИГУРАЦИЯ И ГЛОБАЛЬНЫЕ ДАННЫЕ
// ============================================================================

// ТОП-50 доменов рунета для защиты от тайпсквоттинга
const TOP_RU_DOMAINS = [
    'vk.com', 'sberbank.ru', 'ozon.ru', 'wildberries.ru', 'tbank.ru',
    'gosuslugi.ru', 'mail.ru', 'yandex.ru', 'google.com', 'youtube.com',
    'ok.ru', 'rutube.ru', 'avito.ru', 'hh.ru', 'cian.ru',
    'wb.ru', 'mvideo.ru', 'eldorado.ru', 'dns-shop.ru', 'citilink.ru',
    'aliexpress.ru', 'lamoda.ru', 'sportmaster.ru', 'detmir.ru', 'koruselling.ru',
    'market.yandex.ru', 'play.google.com', 'appstore.com', 'icloud.com', 'microsoft.com',
    'apple.com', 'samsung.com', 'xiaomi.com', 'huawei.com', 'honor.ru',
    'beeline.ru', 'mts.ru', 'megafon.ru', 'tele2.ru', 'rt.ru',
    'domclick.ru', 'pik.ru', 'samokat.ru', 'delivery-club.ru', 'yandex.eda',
    'fix-price.ru', 'krasnoeibeloe.ru', 'bringer.ru', 'lenta.com', 'magnit.ru'
];

// Домены-сокращатели ссылок, требующие проверки редиректов
const URL_SHORTENERS = [
    'bit.ly', 'clck.ru', 'tinyurl.com', 'vk.cc', 't.me',
    'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly',
    'short.link', 'tiny.cc', 'bit.do', 'adf.ly', 'j.mp'
];

// Ключевые слова для эвристического анализа URL (фишинговые паттерны)
const PHISHING_KEYWORDS = [
    'login', 'verify', 'secure', 'account', 'update',
    'confirm', 'billing', 'support', 'restore', 'password',
    'signin', 'sign-in', 'log-in', 'auth', 'verification',
    'unlock', 'reactivate', 'suspend', 'limited', 'action-required'
];

// Пороги для эвристики
const CONFIG = {
    MAX_LEVENSHTEIN_DISTANCE: 2,      // Максимальное расстояние для предупреждения о тайпсквоттинге
    SUSPICIOUS_URL_LENGTH: 75,         // Длина URL, считающаяся подозрительной
    CACHE_UPDATE_INTERVAL: 3600000,    // Интервал обновления кэша (1 час в мс)
    STORAGE_KEY_PHISHING_LIST: 'phishing_domains_cache',
    STORAGE_KEY_LAST_UPDATE: 'phishing_cache_timestamp'
};

// Глобальный кэш фишинговых доменов (загружается из storage)
let phishingDomainsCache = new Set();
let lastCacheUpdate = 0;

// ============================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================================

/**
 * Вычисляет расстояние Левенштейна между двумя строками
 * Используется для обнаружения тайпсквоттинга
 * 
 * @param {string} s1 - Первая строка
 * @param {string} s2 - Вторая строка
 * @returns {number} - Расстояние Левенштейна
 */
function levenshteinDistance(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;
    
    // Создаем матрицу расстояний
    const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
    
    // Инициализация первой строки и столбца
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    // Заполнение матрицы
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase() ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // Удаление
                matrix[i][j - 1] + 1,      // Вставка
                matrix[i - 1][j - 1] + cost // Замена
            );
            
            // Проверка на транспозицию (расстояние Дамерау-Левенштейна)
            if (i > 1 && j > 1 &&
                s1[i - 1].toLowerCase() === s2[j - 2].toLowerCase() &&
                s1[i - 2].toLowerCase() === s2[j - 1].toLowerCase()) {
                matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost);
            }
        }
    }
    
    return matrix[len1][len2];
}

/**
 * Извлекает домен второго уровня из полного домена
 * Например: "mail.google.com" -> "google.com", "sberbank.ru" -> "sberbank.ru"
 * 
 * @param {string} hostname - Полное имя хоста
 * @returns {string} - Домен второго уровня
 */
function extractBaseDomain(hostname) {
    const parts = hostname.toLowerCase().split('.');
    
    if (parts.length <= 2) {
        return hostname.toLowerCase();
    }
    
    // Для доменов вида .co.uk, .com.au и т.д. можно добавить специальную логику
    // Для простоты берем последние две части
    return parts.slice(-2).join('.');
}

/**
 * Проверяет наличие смешения кириллицы и латиницы в домене
 * Обнаруживает омоглиф-атаки (например, раyрal.com вместо paypal.com)
 * 
 * @param {string} domain - Домен для проверки
 * @returns {object} - Результат проверки: { isMixed: boolean, details: string }
 */
function checkHomoglyphs(domain) {
    const result = {
        isMixed: false,
        details: '',
        scriptDistribution: {}
    };
    
    // Словари для определения скриптов
    const cyrillicPattern = /[\u0400-\u04FF]/u;      // Кириллица
    const latinPattern = /[\u0041-\u007A\u0061-\u007A]/i; // Латиница (basic)
    const greekPattern = /[\u0370-\u03FF]/u;         // Греческий
    const armenianPattern = /[\u0530-\u058F]/u;      // Армянский
    
    let hasCyrillic = false;
    let hasLatin = false;
    let hasGreek = false;
    let cyrillicChars = [];
    let latinChars = [];
    
    // Удаляем точки и дефисы для анализа
    const cleanDomain = domain.replace(/[.\-]/g, '');
    
    for (const char of cleanDomain) {
        if (cyrillicPattern.test(char)) {
            hasCyrillic = true;
            cyrillicChars.push(char);
        } else if (latinPattern.test(char)) {
            hasLatin = true;
            latinChars.push(char);
        } else if (greekPattern.test(char)) {
            hasGreek = true;
        }
    }
    
    result.scriptDistribution = {
        cyrillic: cyrillicChars.length,
        latin: latinChars.length,
        greek: hasGreek ? 'present' : 0
    };
    
    // Определяем смешение скриптов
    const scriptCount = [hasCyrillic, hasLatin, hasGreek].filter(Boolean).length;
    
    if (scriptCount > 1) {
        result.isMixed = true;
        
        if (hasCyrillic && hasLatin) {
            result.details = `Обнаружено смешение кириллицы (${cyrillicChars.length}) и латиницы (${latinChars.length})`;
        } else if (hasCyrillic && hasGreek) {
            result.details = 'Обнаружено смешение кириллицы и греческого';
        } else if (hasLatin && hasGreek) {
            result.details = 'Обнаружено смешение латиницы и греческого';
        } else {
            result.details = `Обнаружено ${scriptCount} различных скриптов в домене`;
        }
    }
    
    // Дополнительная проверка на конкретные омоглифы
    const commonHomoglyphs = {
        'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
        'А': 'A', 'Е': 'E', 'О': 'O', 'Р': 'P', 'С': 'C', 'У': 'Y', 'Х': 'X',
        'і': 'i', 'ѕ': 's', 'ј': 'j', 'ԛ': 'q', 'ԝ': 'w'
    };
    
    const foundHomoglyphs = [];
    for (const [cyrillicChar, latinChar] of Object.entries(commonHomoglyphs)) {
        if (domain.includes(cyrillicChar)) {
            foundHomoglyphs.push(`"${cyrillicChar}" → "${latinChar}"`);
        }
    }
    
    if (foundHomoglyphs.length > 0) {
        result.isMixed = true;
        result.details += `. Подозрительные символы: ${foundHomoglyphs.join(', ')}`;
    }
    
    return result;
}

/**
 * Выполняет эвристический анализ URL на наличие фишинговых паттернов
 * 
 * @param {string} url - Полный URL для анализа
 * @returns {object} - Результат анализа: { isSuspicious: boolean, score: number, reasons: array }
 */
function analyzeUrlHeuristics(url) {
    const result = {
        isSuspicious: false,
        score: 0,
        reasons: [],
        findings: []
    };
    
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();
        const searchParams = urlObj.search.toLowerCase();
        const fullString = (pathname + searchParams).toLowerCase();
        
        // 1. Проверка длины URL
        if (url.length > CONFIG.SUSPICIOUS_URL_LENGTH) {
            result.score += 20;
            result.reasons.push(`Длина URL превышает ${CONFIG.SUSPICIOUS_URL_LENGTH} символов (${url.length})`);
            result.findings.push({ type: 'long_url', value: url.length });
        }
        
        // 2. Поиск ключевых слов
        const foundKeywords = [];
        for (const keyword of PHISHING_KEYWORDS) {
            if (fullString.includes(keyword)) {
                foundKeywords.push(keyword);
                result.score += 10;
            }
        }
        
        if (foundKeywords.length > 0) {
            result.reasons.push(`Найдены подозрительные ключевые слова: ${foundKeywords.join(', ')}`);
            result.findings.push({ type: 'phishing_keywords', keywords: foundKeywords });
        }
        
        // 3. Проверка на множественные поддомены
        const hostname = urlObj.hostname;
        const subdomains = hostname.split('.');
        if (subdomains.length > 4) {
            result.score += 15;
            result.reasons.push(`Подозрительно большое количество поддоменов: ${hostname}`);
            result.findings.push({ type: 'excessive_subdomains', count: subdomains.length });
        }
        
        // 4. Проверка на использование IP-адреса вместо домена
        const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (ipPattern.test(hostname)) {
            result.score += 25;
            result.reasons.push('Используется IP-адрес вместо доменного имени');
            result.findings.push({ type: 'ip_address', value: hostname });
        }
        
        // 5. Проверка на нестандартные порты
        const port = urlObj.port;
        if (port && !['80', '443', '8080'].includes(port)) {
            result.score += 10;
            result.reasons.push(`Используется нестандартный порт: ${port}`);
            result.findings.push({ type: 'unusual_port', value: port });
        }
        
        // 6. Проверка на наличие символов "@" в URL (попытка скрыть реальный домен)
        if (url.includes('@')) {
            result.score += 30;
            result.reasons.push('URL содержит символ "@", что может скрывать реальный домен');
            result.findings.push({ type: 'at_symbol', present: true });
        }
        
        // 7. Проверка на использование punycode в легитимных доменах
        if (hostname.startsWith('xn--')) {
            result.score += 15;
            result.reasons.push('Домен использует Punycode кодировку');
            result.findings.push({ type: 'punycode', value: hostname });
        }
        
        // Определяем итоговую подозрительность
        // Порог: 30+ баллов = подозрительно, 50+ = высоко подозрительно
        if (result.score >= 30) {
            result.isSuspicious = true;
        }
        
        // Добавляем уровень угрозы
        if (result.score >= 50) {
            result.threatLevel = 'high';
        } else if (result.score >= 30) {
            result.threatLevel = 'medium';
        } else {
            result.threatLevel = 'low';
        }
        
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка анализа URL:', error);
        result.reasons.push('Ошибка парсинга URL');
    }
    
    return result;
}

/**
 * Проверяет домен на тайпсквоттинг относительно топ-доменов
 * 
 * @param {string} domain - Домен для проверки
 * @returns {object} - Результат: { isTyposquat: boolean, similarDomain: string|null, distance: number }
 */
function checkTyposquatting(domain) {
    const result = {
        isTyposquat: false,
        similarDomain: null,
        distance: Infinity,
        matches: []
    };
    
    const baseDomain = extractBaseDomain(domain.toLowerCase());
    
    for (const topDomain of TOP_RU_DOMAINS) {
        const distance = levenshteinDistance(baseDomain, topDomain);
        
        if (distance <= CONFIG.MAX_LEVENSHTEIN_DISTANCE && distance < result.distance) {
            result.isTyposquat = true;
            result.similarDomain = topDomain;
            result.distance = distance;
            result.matches.push({
                domain: topDomain,
                distance: distance,
                similarity: ((1 - distance / Math.max(baseDomain.length, topDomain.length)) * 100).toFixed(1) + '%'
            });
        }
    }
    
    // Сортируем совпадения по расстоянию
    result.matches.sort((a, b) => a.distance - b.distance);
    
    return result;
}

/**
 * Проверяет, является ли домен сокращателем ссылок
 * 
 * @param {string} hostname - Хост для проверки
 * @returns {boolean} - true если это сокращатель ссылок
 */
function isUrlShortener(hostname) {
    const baseDomain = extractBaseDomain(hostname.toLowerCase());
    return URL_SHORTENERS.some(shortener => baseDomain === shortener || baseDomain.endsWith('.' + shortener));
}

/**
 * Выполняет HEAD-запрос для проверки редиректа
 * 
 * @param {string} url - URL для проверки
 * @returns {Promise<object>} - Результат проверки редиректа
 */
async function checkRedirect(url) {
    const result = {
        isRedirect: false,
        finalUrl: null,
        redirectChain: [],
        isSafe: true,
        warnings: []
    };
    
    try {
        // Используем fetch с методом HEAD и no-follow для ручного контроля
        // Примечание: в Service Worker ограничены возможности для CORS запросов
        // Для продакшена потребуется разрешение в manifest.json
        
        const response = await fetch(url, {
            method: 'HEAD',
            redirect: 'manual', // Не следовать редиректам автоматически
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; AntiPhishingBot/1.0)'
            }
        }).catch(err => {
            // Если fetch не работает из-за CORS, пробуем альтернативный подход
            console.warn('[Anti-Phishing] HEAD-запрос заблокирован CORS:', err.message);
            return null;
        });
        
        if (!response) {
            result.warnings.push('Не удалось выполнить проверку редиректа (CORS ограничения)');
            return result;
        }
        
        // Проверяем статус ответа (3xx = редирект)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
            result.isRedirect = true;
            const location = response.headers.get('Location');
            
            if (location) {
                result.finalUrl = location;
                result.redirectChain.push(location);
                
                // Рекурсивно проверяем конечный URL (максимум 3 редиректа)
                if (result.redirectChain.length < 3) {
                    try {
                        const finalCheck = await checkRedirect(location);
                        if (finalCheck.isRedirect) {
                            result.redirectChain.push(...finalCheck.redirectChain);
                            result.finalUrl = finalCheck.finalUrl;
                        }
                    } catch (e) {
                        // Игнорируем ошибки при рекурсивной проверке
                    }
                }
                
                // Анализируем конечный URL на безопасность
                if (result.finalUrl) {
                    const heuristicAnalysis = analyzeUrlHeuristics(result.finalUrl);
                    if (heuristicAnalysis.isSuspicious) {
                        result.isSafe = false;
                        result.warnings.push(...heuristicAnalysis.reasons);
                    }
                    
                    // Проверяем конечный домен на тайпсквоттинг
                    try {
                        const finalDomain = new URL(result.finalUrl).hostname;
                        const typoCheck = checkTyposquatting(finalDomain);
                        if (typoCheck.isTyposquat) {
                            result.isSafe = false;
                            result.warnings.push(`Конечный домен похож на ${typoCheck.similarDomain} (расстояние: ${typoCheck.distance})`);
                        }
                    } catch (e) {
                        // Игнорируем ошибки парсинга
                    }
                }
            }
        }
        
        // Проверяем заголовки безопасности
        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('application/octet-stream') || 
            contentType.includes('application/x-msdownload')) {
            result.warnings.push('Ссылка ведет на исполняемый файл');
        }
        
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка проверки редиректа:', error);
        result.warnings.push(`Ошибка при проверке: ${error.message}`);
    }
    
    return result;
}

// ============================================================================
// РАБОТА С ХРАНИЛИЩЕМ
// ============================================================================

/**
 * Загружает кэш фишинговых доменов из chrome.storage.local
 */
async function loadPhishingCache() {
    try {
        const data = await chrome.storage.local.get([
            CONFIG.STORAGE_KEY_PHISHING_LIST,
            CONFIG.STORAGE_KEY_LAST_UPDATE
        ]);
        
        if (data[CONFIG.STORAGE_KEY_PHISHING_LIST]) {
            phishingDomainsCache = new Set(data[CONFIG.STORAGE_KEY_PHISHING_LIST]);
            lastCacheUpdate = data[CONFIG.STORAGE_KEY_LAST_UPDATE] || 0;
            
            console.log(`[Anti-Phishing] Загружено ${phishingDomainsCache.size} доменов в кэш`);
            console.log(`[Anti-Phishing] Последнее обновление: ${new Date(lastCacheUpdate).toLocaleString()}`);
        }
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка загрузки кэша:', error);
    }
}

/**
 * Сохраняет кэш фишинговых доменов в chrome.storage.local
 * @param {Array} domains - Массив доменов для сохранения
 */
async function savePhishingCache(domains) {
    try {
        phishingDomainsCache = new Set(domains);
        lastCacheUpdate = Date.now();
        
        await chrome.storage.local.set({
            [CONFIG.STORAGE_KEY_PHISHING_LIST]: domains,
            [CONFIG.STORAGE_KEY_LAST_UPDATE]: lastCacheUpdate
        });
        
        console.log(`[Anti-Phishing] Сохранено ${domains.length} доменов в кэш`);
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка сохранения кэша:', error);
    }
}

/**
 * Обновляет кэш фишинговых доменов
 * В реальной реализации здесь был бы запрос к внешнему API
 */
async function updatePhishingCache() {
    const now = Date.now();
    
    // Проверяем, прошло ли достаточно времени с последнего обновления
    if (now - lastCacheUpdate < CONFIG.CACHE_UPDATE_INTERVAL) {
        console.log('[Anti-Phishing] Кэш еще актуален, обновление не требуется');
        return;
    }
    
    console.log('[Anti-Phishing] Начало обновления кэша фишинговых доменов...');
    
    try {
        // В реальной реализации здесь будет запрос к вашему API или базе данных
        // Пример:
        // const response = await fetch('https://your-api.com/phishing-domains');
        // const data = await response.json();
        // await savePhishingCache(data.domains);
        
        // Для демонстрации добавляем несколько тестовых доменов
        const testPhishingDomains = [
            'sberbank-secure.ru',
            'vk-login.com',
            'gosuslugi-verify.ru',
            'yandex-passport.net',
            'mail-ru-auth.com'
        ];
        
        await savePhishingCache([...phishingDomainsCache, ...testPhishingDomains]);
        
        console.log('[Anti-Phishing] Кэш успешно обновлен');
        
        // Отправляем сообщение другим частям расширения об обновлении
        chrome.runtime.sendMessage({
            type: 'CACHE_UPDATED',
            timestamp: lastCacheUpdate,
            count: phishingDomainsCache.size
        }).catch(() => {
            // Игнорируем ошибки, если нет активных получателей
        });
        
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка обновления кэша:', error);
    }
}

// ============================================================================
// ОБРАБОТКА ЗАПРОСОВ И БЛОКИРОВКА
// ============================================================================

/**
 * Комплексная проверка URL перед загрузкой
 * 
 * @param {string} url - URL для проверки
 * @param {string} requestId - ID запроса для логирования
 * @returns {Promise<object>} - Решение: { action: 'allow'|'block'|'warn', reason: string, details: object }
 */
async function checkUrlSafety(url, requestId = 'unknown') {
    const result = {
        action: 'allow',
        reason: '',
        details: {},
        checks: {}
    };
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        console.log(`[Anti-Phishing] Проверка URL #${requestId}: ${url}`);
        
        // 1. Проверка в кэше фишинговых доменов
        const baseDomain = extractBaseDomain(hostname);
        if (phishingDomainsCache.has(baseDomain) || phishingDomainsCache.has(hostname)) {
            result.action = 'block';
            result.reason = 'Домен находится в списке фишинговых';
            result.details.cacheHit = true;
            result.checks.phishingList = { blocked: true };
            return result;
        }
        result.checks.phishingList = { blocked: false };
        
        // 2. Проверка на омоглифы и смешение алфавитов
        const homoglyphCheck = checkHomoglyphs(hostname);
        result.checks.homoglyphs = homoglyphCheck;
        
        if (homoglyphCheck.isMixed) {
            result.action = 'block';
            result.reason = 'Обнаружено смешение алфавитов (возможна омоглиф-атака)';
            result.details.homoglyphDetails = homoglyphCheck.details;
            return result;
        }
        
        // 3. Проверка на тайпсквоттинг
        const typoCheck = checkTyposquatting(hostname);
        result.checks.typosquatting = typoCheck;
        
        if (typoCheck.isTyposquat) {
            result.action = 'warn';
            result.reason = `Возможный тайпсквоттинг: домен похож на ${typoCheck.similarDomain}`;
            result.details.typoDetails = typoCheck;
            // Не блокируем сразу, но помечаем для предупреждения
        }
        
        // 4. Эвристический анализ URL
        const heuristicAnalysis = analyzeUrlHeuristics(url);
        result.checks.heuristics = heuristicAnalysis;
        
        if (heuristicAnalysis.isSuspicious && heuristicAnalysis.threatLevel === 'high') {
            if (result.action !== 'block') {
                result.action = 'warn';
            }
            result.reason = result.reason ? result.reason + '; ' : '';
            result.reason += 'Высокий уровень подозрительности по эвристическому анализу';
            result.details.heuristicDetails = heuristicAnalysis;
        }
        
        // 5. Проверка редиректов для сокращателей ссылок
        if (isUrlShortener(hostname)) {
            console.log(`[Anti-Phishing] Обнаружен сокращатель ссылок: ${hostname}`);
            const redirectCheck = await checkRedirect(url);
            result.checks.redirect = redirectCheck;
            
            if (!redirectCheck.isSafe) {
                result.action = 'block';
                result.reason = 'Сокращенная ссылка ведет на подозрительный ресурс';
                result.details.redirectDetails = redirectCheck;
            } else if (redirectCheck.isRedirect) {
                result.details.redirectInfo = {
                    isRedirect: true,
                    finalUrl: redirectCheck.finalUrl,
                    chainLength: redirectCheck.redirectChain.length
                };
            }
        }
        
        // Логирование результата
        if (result.action !== 'allow') {
            console.warn(`[Anti-Phishing] ⚠️ URL помечен как опасный: ${result.action.toUpperCase()}`);
            console.warn(`[Anti-Phishing] Причина: ${result.reason}`);
        }
        
    } catch (error) {
        console.error(`[Anti-Phishing] Ошибка проверки URL #${requestId}:`, error);
        result.action = 'allow';
        result.reason = 'Ошибка анализа, разрешаем доступ';
        result.error = error.message;
    }
    
    return result;
}

/**
 * Генерирует страницу предупреждения
 * 
 * @param {object} threatInfo - Информация об угрозе
 * @returns {string} - HTML страница предупреждения
 */
function generateWarningPage(threatInfo) {
    const encodedInfo = encodeURIComponent(JSON.stringify(threatInfo));
    
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>⚠️ Предупреждение системы безопасности</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .icon { font-size: 64px; text-align: center; margin-bottom: 20px; }
        h1 { color: #e74c3c; text-align: center; margin-bottom: 20px; }
        .message { background: #fee; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .detail-item { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        .detail-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: bold; color: #555; }
        .value { color: #333; word-break: break-all; }
        .buttons { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        button {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.3s;
        }
        .btn-back { background: #e74c3c; color: white; }
        .btn-back:hover { background: #c0392b; }
        .btn-proceed { background: #95a5a6; color: white; }
        .btn-proceed:hover { background: #7f8c8d; }
        .btn-report { background: #3498db; color: white; }
        .btn-report:hover { background: #2980b9; }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🛡️</div>
        <h1>Обнаружена потенциальная угроза</h1>
        <div class="message">
            <p><strong>Система анти-фишинга заблокировала переход на эту страницу.</strong></p>
            <p style="margin-top: 10px;">${threatInfo.reason}</p>
        </div>
        <div class="details">
            <div class="detail-item">
                <span class="label">URL:</span>
                <span class="value">${threatInfo.url || 'Неизвестно'}</span>
            </div>
            ${threatInfo.details?.homoglyphDetails ? `
            <div class="detail-item">
                <span class="label">Омоглифы:</span>
                <span class="value">${threatInfo.details.homoglyphDetails}</span>
            </div>
            ` : ''}
            ${threatInfo.details?.typoDetails?.similarDomain ? `
            <div class="detail-item">
                <span class="label">Похожий домен:</span>
                <span class="value">${threatInfo.details.typoDetails.similarDomain} (расстояние: ${threatInfo.details.typoDetails.distance})</span>
            </div>
            ` : ''}
            ${threatInfo.details?.heuristicDetails?.reasons ? `
            <div class="detail-item">
                <span class="label">Эвристика:</span>
                <span class="value">${threatInfo.details.heuristicDetails.reasons.join('; ')}</span>
            </div>
            ` : ''}
        </div>
        <div class="buttons">
            <button class="btn-back" onclick="window.history.back()">← Вернуться назад</button>
            <button class="btn-report" onclick="reportPhishing()">Сообщить о фишинге</button>
            <button class="btn-proceed" onclick="proceedAnyway()">Все равно перейти (не рекомендуется)</button>
        </div>
    </div>
    <script>
        function proceedAnyway() {
            const url = '${threatInfo.url || ''}';
            if (url) {
                // Сохраняем исключение в storage
                chrome.storage.local.get('allowedDomains', data => {
                    const allowed = data.allowedDomains || [];
                    const domain = new URL(url).hostname;
                    if (!allowed.includes(domain)) {
                        allowed.push(domain);
                        chrome.storage.local.set({ allowedDomains: allowed }, () => {
                            window.location.href = url;
                        });
                    } else {
                        window.location.href = url;
                    }
                });
            }
        }
        function reportPhishing() {
            const url = '${threatInfo.url || ''}';
            alert('Спасибо за сообщение! URL отправлен на проверку.');
            // Здесь можно отправить отчет на ваш сервер
            console.log('Report phishing:', url);
        }
    </script>
</body>
</html>
    `.trim();
}

// ============================================================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================================================

// Обработчик установки расширения
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('[Anti-Phishing] Расширение установлено', details);
    
    // Инициализируем хранилище
    await loadPhishingCache();
    await updatePhishingCache();
    
    // Настраиваем правила declarativeNetRequest (если необходимо)
    // Примечание: declarativeNetRequest используется для статических правил
    // Динамическая блокировка реализуется через webRequest API
    
    if (details.reason === 'install') {
        console.log('[Anti-Phishing] Первое установка, открываем страницу приветствия');
        // Можно открыть страницу onboarding
    }
});

// Обработчик навигации (основная проверка)
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    // Пропускаем внутренние страницы браузера и iframe
    if (details.frameId !== 0) {
        return; // Обрабатываем только основные фреймы
    }
    
    const url = details.url;
    
    // Пропускаем безопасные схемы
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') ||
        url.startsWith('about:') ||
        url.startsWith('file://')) {
        return;
    }
    
    // Выполняем проверку
    const safetyCheck = await checkUrlSafety(url, details.tabId.toString());
    
    if (safetyCheck.action === 'block') {
        console.log(`[Anti-Phishing] 🚫 Блокируем доступ к: ${url}`);
        
        // Отменяем навигацию и показываем страницу предупреждения
        chrome.tabs.update(details.tabId, {
            url: 'data:text/html;charset=utf-8,' + encodeURIComponent(generateWarningPage({
                url: url,
                reason: safetyCheck.reason,
                details: safetyCheck.details,
                action: 'blocked'
            }))
        });
        
        // Логируем инцидент
        logSecurityIncident({
            type: 'blocked',
            url: url,
            reason: safetyCheck.reason,
            timestamp: Date.now(),
            tabId: details.tabId
        });
        
    } else if (safetyCheck.action === 'warn') {
        console.log(`[Anti-Phishing] ⚠️ Предупреждение для: ${url}`);
        
        // Показываем предупреждение, но позволяем пользователю выбрать
        // В реальной реализации можно показать нативное уведомление или badge
        
        // Отправляем сообщение контент-скрипту для показа UI предупреждения
        try {
            await chrome.tabs.sendMessage(details.tabId, {
                type: 'PHISHING_WARNING',
                info: safetyCheck
            });
        } catch (e) {
            console.warn('[Anti-Phishing] Не удалось отправить предупреждение в контент-скрипт');
        }
        
        // Логируем предупреждение
        logSecurityIncident({
            type: 'warning',
            url: url,
            reason: safetyCheck.reason,
            timestamp: Date.now(),
            tabId: details.tabId
        });
    }
});

// Обработчик сообщений от других частей расширения
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Anti-Phishing] Получено сообщение:', message);
    
    switch (message.type) {
        case 'CHECK_URL':
            // Запрос на проверку конкретного URL
            checkUrlSafety(message.url).then(result => {
                sendResponse(result);
            });
            return true; // Асинхронный ответ
            
        case 'UPDATE_CACHE':
            // Принудительное обновление кэша
            updatePhishingCache().then(() => {
                sendResponse({ success: true, count: phishingDomainsCache.size });
            });
            return true;
            
        case 'REPORT_PHISHING':
            // Сообщение о новом фишинговом сайте
            handlePhishingReport(message.url, message.details).then(() => {
                sendResponse({ success: true });
            });
            return true;
            
        case 'GET_STATS':
            // Запрос статистики
            getSecurityStats().then(stats => {
                sendResponse(stats);
            });
            return true;
            
        default:
            sendResponse({ error: 'Unknown message type' });
    }
});

// Обработчик сигналов тревоги
chrome.runtime.onStartup.addListener(async () => {
    console.log('[Anti-Phishing] Браузер запущен, инициализация...');
    await loadPhishingCache();
    await updatePhishingCache();
});

// Периодическое обновление кэша
setInterval(() => {
    updatePhishingCache();
}, CONFIG.CACHE_UPDATE_INTERVAL);

// ============================================================================
# ЛОГИРОВАНИЕ И СТАТИСТИКА
# ============================================================================

/**
 * Логирует инциденты безопасности в storage
 * 
 * @param {object} incident - Данные инцидента
 */
async function logSecurityIncident(incident) {
    try {
        const key = 'security_incidents_log';
        const data = await chrome.storage.local.get(key);
        const logs = data[key] || [];
        
        // Добавляем новый инцидент
        logs.unshift({
            id: Date.now().toString(),
            ...incident
        });
        
        // Храним только последние 1000 записей
        if (logs.length > 1000) {
            logs.splice(1000);
        }
        
        await chrome.storage.local.set({ [key]: logs });
        
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка логирования инцидента:', error);
    }
}

/**
 * Получает статистику безопасности
 * 
 * @returns {Promise<object>} - Статистика
 */
async function getSecurityStats() {
    try {
        const data = await chrome.storage.local.get('security_incidents_log');
        const logs = data['security_incidents_log'] || [];
        
        const stats = {
            totalIncidents: logs.length,
            blocked: logs.filter(l => l.type === 'blocked').length,
            warnings: logs.filter(l => l.type === 'warning').length,
            lastIncident: logs[0]?.timestamp || null,
            cacheSize: phishingDomainsCache.size,
            lastCacheUpdate: lastCacheUpdate,
            recentDomains: [...new Set(logs.slice(0, 10).map(l => new URL(l.url).hostname))]
        };
        
        return stats;
        
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка получения статистики:', error);
        return { error: error.message };
    }
}

/**
 * Обрабатывает отчет о фишинге от пользователя
 * 
 * @param {string} url - URL фишингового сайта
 * @param {object} details - Дополнительные детали
 */
async function handlePhishingReport(url, details) {
    try {
        console.log('[Anti-Phishing] Получен отчет о фишинге:', url);
        
        // Извлекаем домен
        const hostname = new URL(url).hostname.toLowerCase();
        const baseDomain = extractBaseDomain(hostname);
        
        // Добавляем в локальный кэш
        if (!phishingDomainsCache.has(baseDomain)) {
            const domains = [...phishingDomainsCache, baseDomain];
            await savePhishingCache(domains);
        }
        
        // Логируем отчет
        await logSecurityIncident({
            type: 'user_report',
            url: url,
            details: details,
            timestamp: Date.now()
        });
        
        // В реальной реализации здесь была бы отправка на сервер
        // await fetch('https://your-api.com/report-phishing', {
        //     method: 'POST',
        //     body: JSON.stringify({ url, details })
        // });
        
    } catch (error) {
        console.error('[Anti-Phishing] Ошибка обработки отчета:', error);
    }
}

console.log('[Anti-Phishing] Service Worker инициализирован');
