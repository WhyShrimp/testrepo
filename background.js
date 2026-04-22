/**
 * SafeWeb Pro - Background Service Worker
 * Центральная база данных безопасных сайтов
 */

// Полная база безопасных сайтов
let SAFE_SITES_DB = {
  // Социальные сети
  "youtube.com": {n:"YouTube", c:"Видео", t:["видео", "стриминг", "развлечение"]},
  "instagram.com": {n:"Instagram", c:"Соцсети", t:["фото", "видео", "соцсеть"]},
  "tiktok.com": {n:"TikTok", c:"Видео", t:["видео", "короткие", "тренды"]},
  "facebook.com": {n:"Facebook", c:"Соцсети", t:["соцсеть", "общение", "новости"]},
  "twitter.com": {n:"Twitter", c:"Соцсети", t:["новости", "микроблог", "тренды"]},
  "discord.com": {n:"Discord", c:"Соцсети", t:["общение", "игры", "комьюнити"]},
  "telegram.org": {n:"Telegram", c:"Соцсети", t:["мессенджер", "безопасность", "каналы"]},
  "reddit.com": {n:"Reddit", c:"Соцсети", t:["форум", "обсуждения", "сообщество"]},
  "linkedin.com": {n:"LinkedIn", c:"Работа", t:["работа", "сеть", "бизнес"]},
  "vk.com": {n:"VK", c:"Соцсети", t:["российское", "соцсеть", "мессенджер"]},
  "google.com": {n:"Google", c:"Поиск", t:["поиск", "браузер", "сервисы"]},
  "yandex.ru": {n:"Яндекс", c:"Поиск", t:["поиск", "россия", "сервисы"]},
  "github.com": {n:"GitHub", c:"Работа", t:["код", "репозитории", "разработка"]},
  "amazon.com": {n:"Amazon", c:"Покупки", t:["маркетплейс", "доставка", "электроника"]},
  "netflix.com": {n:"Netflix", c:"Видео", t:["фильмы", "сериалы", "стриминг"]},
  "spotify.com": {n:"Spotify", c:"Музыка", t:["музыка", "подкасты", "стриминг"]},
  "wikipedia.org": {n:"Wikipedia", c:"Энциклопедия", t:["знания", "статьи", "справочник"]}
};

// ===================================================================
// АНТИ-ФИШИНГ: КОНФИГУРАЦИЯ И КОНСТАНТЫ
// ===================================================================

// Интервал обновления кэша (1 час в миллисекундах)
const CACHE_UPDATE_INTERVAL = 3600000;

// ЖЕСТКИЙ БЕЛЫЙ СПИСОК (Никогда не блокировать эти домены)
// Эти сайты проходят без любых проверок
const WHITELIST_DOMAINS = [
    'google.com', 'google.ru', 'www.google.com', 'www.google.ru',
    'yandex.ru', 'yandex.com', 'www.yandex.ru', 'www.yandex.com',
    'mail.ru', 'www.mail.ru', 'vk.com', 'www.vk.com',
    'youtube.com', 'www.youtube.com', 'github.com', 'www.github.com',
    'wikipedia.org', 'www.wikipedia.org', 'stackoverflow.com',
    'microsoft.com', 'apple.com', 'amazon.com', 'facebook.com',
    'twitter.com', 'instagram.com', 'telegram.org', 'discord.com'
];

// Словарь популярных доменов рунета для проверки на тайпсквоттинг
const POPULAR_DOMAINS = [
    'yandex.ru', 'vk.com', 'mail.ru', 'sberbank.ru', 'tinkoff.ru', 'tbank.ru',
    'gosuslugi.ru', 'wildberries.ru', 'ozon.ru', 'avito.ru',
    'qiwi.com', 'webmoney.ru', 'yoomoney.ru', 'google.com', 'youtube.com'
];

// Словарь опасных слов в URL для эвристики
const DANGEROUS_URL_PATTERNS = [
    'login', 'verify', 'secure', 'account', 'update', 'confirm',
    'billing', 'support', 'restore', 'password', 'signin', 'sign-in',
    'authenticate', 'auth', 'enter', 'connect', 'access', 'admin',
    'payment', 'purchase', 'buy', 'order', 'checkout', 'cart',
    'session', 'token', 'key', 'verification', 'confirm', 'activate'
];

// Домены сокращателей ссылок
const URL_SHORTENERS = [
    'bit.ly', 'tinyurl.com', 'clck.ru', 'vk.cc', 't.me', 'ow.ly', 'is.gd'
];

// Порог блокировки (очень высокий, чтобы избежать ложных срабатываний)
// Блокировка только при ОДНОВРЕМЕННОМ наличии нескольких факторов
const BLOCKING_THRESHOLD = 120;

// Кэш фишинговых доменов
let phishingCache = new Set();
// Последние проверенные URL
const recentChecks = new Map();

// Кэш проверенных доменов
const domainCache = new Map();

// Пользовательские заблокированные/доверенные сайты
let userBlockedSites = {};

// Загрузка пользовательских настроек при старте
chrome.storage.local.get(['blockedSites', 'phishingCache', 'lastUpdate'], (result) => {
  if (result.blockedSites) {
    userBlockedSites = result.blockedSites;
    console.log('✅ Загружено пользовательских сайтов:', Object.keys(userBlockedSites).length);
  }
  // Загрузка кэша фишинговых доменов из storage
  if (result.phishingCache && Array.isArray(result.phishingCache)) {
    phishingCache = new Set(result.phishingCache);
    console.log(`✅ Загружено ${phishingCache.size} фишинговых доменов из кэша`);
  }
});

// Обработка изменений в хранилище
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.blockedSites) {
    userBlockedSites = changes.blockedSites.newValue || {};
  }
  if (namespace === 'local' && changes.phishingCache) {
    if (Array.isArray(changes.phishingCache.newValue)) {
      phishingCache = new Set(changes.phishingCache.newValue);
    }
  }
});

// ===================================================================
// АНТИ-ФИШИНГ: ФУНКЦИИ ПРОВЕРКИ
// ===================================================================

/**
 * Проверка на омоглифы и Punycode (смешение кириллицы и латиницы)
 */
function checkHomoglyphs(domain) {
  // Проверяем на наличие кириллических символов в домене
  const cyrillicRegex = /[\u0400-\u04FF]/;
  const latinRegex = /[a-zA-Z]/;
  
  // Если в домене есть КИРИЛЛИЧЕСКИЕ символы И латинские - подозрительно
  // Это основной признак омоглиф-атаки
  if (cyrillicRegex.test(domain) && latinRegex.test(domain)) {
    // Проверяем конкретные опасные омоглифы (только явные совпадения)
    const dangerousHomoglyphs = [
        /\u0430/g, // а кириллическая (U+0430) -> a латинская
        /\u0435/g, // е кириллическая (U+0435) -> e латинская
        /\u043E/g, // о кириллическая (U+043E) -> o латинская
        /\u0440/g, // р кириллическая (U+0440) -> p латинская
        /\u0441/g, // с кириллическая (U+0441) -> c латинская
        /\u0443/g, // у кириллическая (U+0443) -> y латинская
        /\u0445/g  // х кириллическая (U+0445) -> x латинская
    ];
    
    let foundCount = 0;
    for (const regex of dangerousHomoglyphs) {
        if (regex.test(domain)) {
            foundCount++;
        }
    }
    // Возвращаем true только если найдено 2+ опасных омоглифа (уменьшаем ложные срабатывания)
    if (foundCount >= 2) {
        return true;
    }
  }
  
  // Punycode (начинается с xn--) проверяем только если это НЕ популярные домены
  // Многие легитимные сайты используют IDN
  if (domain.startsWith('xn--') && !WHITELIST_DOMAINS.some(wl => domain.includes(wl))) {
    return true;
  }
  
  return false;
}

/**
 * Эвристика URL: анализ пути на подозрительные паттерны
 * Возвращает детализированный score с разными значениями для разных факторов
 */
function analyzeUrlHeuristics(fullUrl, pathname) {
  let score = 0;
  const details = [];
  
  // Проверка длины URL (>75 символов как в ТЗ)
  if (fullUrl.length > 75) {
    score += 10;
    details.push(`Длина URL ${fullUrl.length} > 75 символов (+10)`);
  }
  
  // Проверка наличия опасных слов в пути - КАЖДОЕ слово добавляет баллы
  for (const pattern of DANGEROUS_URL_PATTERNS) {
    if (pathname.includes(pattern)) {
      score += 5; // Каждое опасное слово +5 баллов
      details.push(`Найдено опасное слово "${pattern}" (+5)`);
    }
  }
  
  // Проверка на IP-адрес в URL
  const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/;
  if (ipPattern.test(fullUrl)) {
    score += 20;
    details.push('Обнаружен IP-адрес в URL (+20)');
  }
  
  // Проверка на необычное количество поддоменов (>3 как в ТЗ)
  const subdomainCount = fullUrl.split('.').length - 2; // минус домен и TLD
  if (subdomainCount > 3) {
    score += 15;
    details.push(`Много поддоменов: ${subdomainCount} > 3 (+15)`);
  }
  
  // Проверка на символ @ в URL (фишинговая техника)
  if (fullUrl.includes('@') && fullUrl.indexOf('@') < fullUrl.indexOf('/')) {
    score += 25;
    details.push('Обнаружен символ @ в URL (+25)');
  }
  
  // Выводим детали в консоль для отладки
  if (details.length > 0) {
    console.log('[PhishingProtector] Эвристика URL детали:', details, 'Итого score:', score);
  }
  
  return score;
}

/**
 * Расчет расстояния Левенштейна (алгоритм Дамерау-Левенштейна для транспозиций)
 */
function calculateLevenshteinDistance(str1, str2) {
  const matrix = [];
  
  // Создаем матрицу
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Заполняем матрицу
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // замена
          matrix[i][j - 1] + 1,     // вставка
          matrix[i - 1][j] + 1      // удаление
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Защита от тайпсквоттинга: проверка похожести на популярные домены
 * Возвращает объект с {target: domain, distance: number} или null
 */
function checkTyposquatting(inputDomain) {
  const cleanInputDomain = inputDomain.replace(/^www\./, '');
  
  for (const popularDomain of POPULAR_DOMAINS) {
    // Убираем www. для сравнения
    const cleanPopularDomain = popularDomain.replace(/^www\./, '');
    
    // Пропускаем если это тот же самый домен (точное совпадение)
    if (cleanInputDomain === cleanPopularDomain) {
      return null;
    }
    
    const distance = calculateLevenshteinDistance(cleanInputDomain, cleanPopularDomain);
    
    // Если расстояние 1 ИЛИ 2 - возможно тайпсквоттинг
    // Расстояние 1: одна буква изменена/добавлена/удалена (высокий риск = 50 баллов)
    // Расстояние 2: две буквы изменены (средний риск = 25 баллов)
    if (distance === 1 || distance === 2) {
      return { target: popularDomain, distance: distance };
    }
  }
  
  return null;
}

/**
 * Проверка редиректов для сокращателей ссылок
 */
async function checkRedirectAsync(url) {
  try {
    // Выполняем HEAD-запрос для получения Location заголовка
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual', // Не следуем за редиректами автоматически
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PhishingProtector/1.0)'
      }
    });
    
    let finalUrl = url;
    let redirectCount = 0;
    const maxRedirects = 3;
    
    // Следуем за редиректами вручную
    while ((response.status === 301 || response.status === 302 || 
           response.status === 303 || response.status === 307 || response.status === 308) &&
           redirectCount < maxRedirects) {
      
      const location = response.headers.get('Location');
      if (!location) break;
      
      finalUrl = new URL(location, url).href;
      redirectCount++;
      
      // Проверяем следующий URL
      const nextResponse = await fetch(finalUrl, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PhishingProtector/1.0)'
        }
      });
      
      if (nextResponse.status >= 200 && nextResponse.status < 400) {
        break; // Успешный статус без редиректа
      }
      
      url = finalUrl;
      response = nextResponse;
    }
    
    // Проверяем финальный URL на подозрительность
    const finalCheck = performFullCheck(finalUrl);
    
    return {
      isSuspicious: finalCheck.isSuspicious,
      finalUrl: finalUrl,
      reasons: finalCheck.reasons,
      redirectChain: [url]
    };
    
  } catch (error) {
    console.error('[PhishingProtector] Ошибка проверки редиректа:', error);
    return {
      isSuspicious: false,
      finalUrl: url,
      reasons: [`Ошибка проверки редиректа: ${error.message}`],
      redirectChain: []
    };
  }
}

/**
 * Выполнение полной проверки URL на фишинг
 */
function performFullCheck(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsedUrl.pathname.toLowerCase();
    const fullUrl = url.toLowerCase();

    // ПРОВЕРКА БЕЛОГО СПИСКА - самое важное!
    // Если домен в белом списке - сразу разрешаем без любых проверок
    if (WHITELIST_DOMAINS.includes(hostname) || WHITELIST_DOMAINS.includes(hostname.replace(/^www\./, ''))) {
      return { isSuspicious: false, reasons: ['Домен в белом списке'], score: 0, isSafe: true };
    }

    // Проверка: если сайт в базе безопасных - сразу разрешаем
    if (SAFE_SITES_DB[hostname] || SAFE_SITES_DB[hostname.replace(/^www\./, '')]) {
      return { isSuspicious: false, reasons: ['Сайт в базе безопасных'], score: 0, isSafe: true };
    }

    const result = {
      isSuspicious: false,
      reasons: [],
      score: 0,
      isSafe: false
    };

    // Проверка на омоглифы и Punycode (критический фактор)
    const hasHomoglyphs = checkHomoglyphs(hostname);
    if (hasHomoglyphs) {
      result.reasons.push('Обнаружено смешение кириллических и латинских символов (омоглифы)');
      result.score += 50; // +50 баллов как в ТЗ
    }

    // Эвристика URL - КАЖДОЕ правило добавляет свои баллы
    const urlHeuristicScore = analyzeUrlHeuristics(fullUrl, pathname);
    if (urlHeuristicScore > 0) {
      result.reasons.push(`Подозрительные паттерны в URL (score: ${urlHeuristicScore})`);
      result.score += urlHeuristicScore;
    }

    // Проверка на тайпсквоттинг (критический фактор)
    const typosquatResult = checkTyposquatting(hostname);
    if (typosquatResult) {
      const { target, distance } = typosquatResult;
      result.reasons.push(`Похож на популярный домен "${target}" (тайпсквоттинг, расстояние=${distance})`);
      // Начисляем баллы в зависимости от расстояния Левенштейна
      if (distance === 1) {
        result.score += 50; // Высокий риск: одна буква изменена
      } else if (distance === 2) {
        result.score += 25; // Средний риск: две буквы изменены
      }
    }

    // Проверка редиректов (если это сокращатель)
    if (URL_SHORTENERS.includes(hostname)) {
      // Асинхронная проверка редиректа (не блокируем основной поток)
      checkRedirectAsync(url).then(redirectResult => {
        if (redirectResult.isSuspicious) {
          console.warn(`[PhishingProtector] Цель редиректа подозрительна: ${redirectResult.finalUrl}`, redirectResult.reasons);
        }
      });
    }

    // Блокируем ТОЛЬКО если score выше ПОРОГА (100 баллов)
    // Это требует сочетания нескольких факторов для блокировки
    if (result.score >= BLOCKING_THRESHOLD) {
      result.isSuspicious = true;
    }

    // Выводим итоговый score в консоль для отладки
    console.log(`[PhishingProtector] Итоговая проверка URL: ${url}`);
    console.log(`  - Score: ${result.score}`);
    console.log(`  - Порог блокировки: ${BLOCKING_THRESHOLD}`);
    console.log(`  - Подозрительный: ${result.isSuspicious}`);
    console.log(`  - Причины:`, result.reasons);

    return result;
  } catch (error) {
    console.error('[PhishingProtector] Ошибка проверки URL:', error);
    return { isSuspicious: false, reasons: [`Ошибка парсинга URL: ${error.message}`], score: 0, isSafe: false };
  }
}

/**
 * Сохранение кэша в chrome.storage.local
 */
async function saveCacheToStorage() {
  try {
    await chrome.storage.local.set({
      phishingCache: Array.from(phishingCache),
      lastUpdate: Date.now()
    });
  } catch (error) {
    console.error('[PhishingProtector] Ошибка сохранения кэша:', error);
  }
}

/**
 * Обновление кэша фишинговых доменов (симуляция)
 */
async function updatePhishingCache() {
  console.log('[PhishingProtector] Обновление кэша фишинговых доменов...');
  // В реальном расширении здесь будет запрос к вашему API
  // Пока просто обновляем время последнего обновления
  await saveCacheToStorage();
}

/**
 * Сообщить о фишинговом сайте
 */
async function reportPhishingSite(url, details) {
  console.log(`[PhishingProtector] Получен отчет о фишинге:`, { url, details });
  
  // Добавляем в локальный кэш
  try {
    const domain = new URL(url).hostname;
    phishingCache.add(domain);
    await saveCacheToStorage();
  } catch (error) {
    console.error('[PhishingProtector] Ошибка добавления в кэш:', error);
  }
}

/**
 * Проверить безопасность домена с учетом пользовательских настроек
 */
function checkDomainSafetyWithUserSettings(domain) {
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  
  // Проверяем пользовательские настройки в первую очередь
  if (userBlockedSites[cleanDomain] === 'blocked') {
    return {
      safe: "blocked",
      reason: "Заблокировано пользователем",
      details: null,
      score: 0
    };
  }
  
  if (userBlockedSites[cleanDomain] === 'trusted') {
    return {
      safe: "trusted",
      reason: "Доверенный сайт (пользователь)",
      details: { n: "Доверенный сайт", c: "Пользовательское" },
      score: 100
    };
  }
  
  // Стандартная проверка
  const result = {
    safe: "unknown",
    reason: "",
    details: null,
    score: 50
  };
  
  // Проверка в базе безопасных сайтов
  if (SAFE_SITES_DB[cleanDomain]) {
    result.safe = "safe";
    result.reason = "Проверенный безопасный сайт";
    result.details = SAFE_SITES_DB[cleanDomain];
    result.score = 90;
  } else {
    result.safe = "unknown";
    result.reason = "Сайт не проверен";
  }
  
  domainCache.set(domain, result);
  return result;
}

/**
 * Очистить кэш
 */
function clearCache() {
  domainCache.clear();
  console.log("Кэш очищен");
}

/**
 * Обработчик сообщений
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("BG: Received request", request.action);
  
  try {
    switch (request.action) {
      case "checkDomain":
        const safety = checkDomainSafetyWithUserSettings(request.domain);
        sendResponse({ success: true, result: safety });
        break;
        
      case "getAllSites":
        sendResponse({ 
          success: true, 
          sites: SAFE_SITES_DB,
          cacheSize: domainCache.size,
          totalSites: Object.keys(SAFE_SITES_DB).length
        });
        break;
        
      case "getStats":
        const categories = new Set(Object.values(SAFE_SITES_DB).map(site => site.c));
        sendResponse({
          success: true,
          stats: {
            totalSafe: Object.keys(SAFE_SITES_DB).length,
            totalCategories: categories.size,
            cacheSize: domainCache.size
          }
        });
        break;
        
      case "clearCache":
        clearCache();
        sendResponse({ success: true, message: "Кэш очищен" });
        break;
        
      case "updateBlockedSites":
        userBlockedSites = request.blockedSites || {};
        chrome.storage.local.set({ blockedSites: userBlockedSites }, () => {
          sendResponse({ success: true });
        });
        return true;
        
      case "updateSettings":
        const settingsToUpdate = request.settings || {};
        chrome.storage.local.get(['blockedSites', 'hideWarnings', 'showEmailWarnings', 'showUnknownWarnings', 'soundOnWarning', 'theme', 'expertMode'], (result) => {
          const updatedSettings = {
            blockedSites: result.blockedSites || {},
            hideWarnings: result.hideWarnings || {},
            showEmailWarnings: result.showEmailWarnings ?? true,
            showUnknownWarnings: result.showUnknownWarnings ?? true,
            soundOnWarning: result.soundOnWarning || false,
            theme: result.theme || 'auto',
            expertMode: result.expertMode || false,
            ...settingsToUpdate
          };
          chrome.storage.local.set(updatedSettings, () => {
            if (updatedSettings.blockedSites) {
              userBlockedSites = updatedSettings.blockedSites;
            }
            sendResponse({ success: true });
          });
        });
        return true;
        
      case "getSettings":
        chrome.storage.local.get(['blockedSites', 'hideWarnings', 'showEmailWarnings', 'showUnknownWarnings', 'soundOnWarning', 'theme', 'expertMode'], (result) => {
          sendResponse({ 
            success: true, 
            settings: {
              blockedSites: result.blockedSites || {},
              hideWarnings: result.hideWarnings || {},
              showEmailWarnings: result.showEmailWarnings ?? true,
              showUnknownWarnings: result.showUnknownWarnings ?? true,
              soundOnWarning: result.soundOnWarning || false,
              theme: result.theme || 'auto',
              expertMode: result.expertMode || false
            }
          });
        });
        return true;
        
      case "shareSite":
        const sharedSites = JSON.parse(localStorage.getItem('sharedSites') || '[]');
        sharedSites.push({
          domain: request.domain,
          ...request.siteData,
          timestamp: Date.now(),
          status: 'pending'
        });
        localStorage.setItem('sharedSites', JSON.stringify(sharedSites));
        sendResponse({ success: true, message: "Сайт отправлен на модерацию" });
        return true;
        
      // ===================================================================
      // АНТИ-ФИШИНГ: ОБРАБОТЧИКИ СООБЩЕНИЙ
      // ===================================================================
      
      case "checkUrl":
        const checkResult = performFullCheck(request.url);
        sendResponse(checkResult);
        break;
        
      case "reportPhishing":
        reportPhishingSite(request.url, request.details);
        sendResponse({success: true});
        break;
        
      case "getPhishingStats":
        sendResponse({
          success: true,
          stats: {
            phishingCacheSize: phishingCache.size,
            recentChecksCount: recentChecks.size
          }
        });
        break;
        
      default:
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    console.error("BG: Error handling message:", error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true;
});

// Инициализация
console.log("✅ SafeWeb Pro Background инициализирован");
console.log("📊 Безопасных сайтов:", Object.keys(SAFE_SITES_DB).length);

// ===================================================================
// АНТИ-ФИШИНГ: ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ СОБЫТИЙ
// ===================================================================

// Запуск интервала обновления кэша (раз в час)
setInterval(() => {
  updatePhishingCache();
}, CACHE_UPDATE_INTERVAL);

// Обработчик навигации через webNavigation (если доступен)
if (chrome.webNavigation) {
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId === 0) { // Только основной фрейм
      console.log(`[PhishingProtector] Проверка URL перед навигацией: ${details.url}`);
      
      const checkResult = performFullCheck(details.url);
      
      if (checkResult.isSuspicious) {
        console.warn(`[PhishingProtector] Подозрительный URL обнаружен: ${details.url}`, checkResult.reasons);
        
        // Сохраняем результат проверки для последующего использования
        recentChecks.set(details.url, {
          timestamp: Date.now(),
          result: checkResult
        });
        
        // Отправляем сообщение content-скрипту для показа предупреждения
        chrome.tabs.sendMessage(details.tabId, {
          action: 'showPhishingWarning',
          url: details.url,
          reasons: checkResult.reasons,
          score: checkResult.score
        }).catch(err => {
          console.log('[PhishingProtector] Content script не доступен, используем перенаправление');
          // Если content-скрипт недоступен, перенаправляем на страницу блокировки
          const warningUrl = chrome.runtime.getURL('blocked.html?url=' + encodeURIComponent(details.url) + '&reason=phishing&score=' + checkResult.score);
          chrome.tabs.update(details.tabId, { url: warningUrl });
        });
      }
    }
  });
}

// Дополнительная проверка при обновлении вкладки (резервный механизм)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;
  
  try {
    const url = new URL(changeInfo.url);
    const domain = url.hostname.replace(/^www\./, '').toLowerCase();
    
    // Проверяем, заблокирован ли домен пользователем
    if (userBlockedSites[domain] === 'blocked') {
      console.log(`🚫 SafeWeb: Блокировка доступа к ${domain}`);
      
      // Перенаправляем на страницу блокировки
      const blockedUrl = chrome.runtime.getURL('blocked.html?url=' + encodeURIComponent(changeInfo.url) + '&domain=' + encodeURIComponent(domain));
      chrome.tabs.update(tabId, { url: blockedUrl });
    }
  } catch (error) {
    // Игнорируем ошибки парсинга URL
  }
});

// Обработка установки/обновления расширения
chrome.runtime.onInstalled.addListener(() => {
  console.log('[PhishingProtector] Расширение установлено/обновлено');
  updatePhishingCache();
});

console.log('[PhishingProtector] Анти-фишинг модуль активирован');
