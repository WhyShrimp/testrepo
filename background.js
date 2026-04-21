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

// Кэш проверенных доменов
const domainCache = new Map();

// Пользовательские заблокированные/доверенные сайты
let userBlockedSites = {};

// Загрузка пользовательских настроек при старте
chrome.storage.local.get(['blockedSites'], (result) => {
  if (result.blockedSites) {
    userBlockedSites = result.blockedSites;
    console.log('✅ Загружено пользовательских сайтов:', Object.keys(userBlockedSites).length);
  }
});

// Обработка изменений в хранилище
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.blockedSites) {
    userBlockedSites = changes.blockedSites.newValue || {};
  }
});

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
