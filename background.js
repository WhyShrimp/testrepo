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

  // Видео и стриминг
  "twitch.tv": {n:"Twitch", c:"Видео", t:["стриминг", "игры", "трансляции"]},
  "netflix.com": {n:"Netflix", c:"Видео", t:["фильмы", "сериалы", "стриминг"]},
  "rutube.ru": {n:"Rutube", c:"Видео", t:["российское", "видео", "стриминг"]},
  "vimeo.com": {n:"Vimeo", c:"Видео", t:["видео", "креатив", "качество"]},

  // Игры
  "steampowered.com": {n:"Steam", c:"Игры", t:["платформа", "игры", "магазин"]},
  "epicgames.com": {n:"Epic Games", c:"Игры", t:["платформа", "игры", "бесплатно"]},
  "roblox.com": {n:"Roblox", c:"Игры", t:["игры", "создание", "мультиплеер"]},
  "minecraft.net": {n:"Minecraft", c:"Игры", t:["игра", "песочница", "креатив"]},
  "leagueoflegends.com": {n:"League of Legends", c:"Игры", t:["игра", "киберспорт", "моба"]},

  // Покупки
  "amazon.com": {n:"Amazon", c:"Покупки", t:["маркетплейс", "доставка", "электроника"]},
  "aliexpress.com": {n:"AliExpress", c:"Покупки", t:["маркетплейс", "китай", "дешево"]},
  "wildberries.ru": {n:"Wildberries", c:"Покупки", t:["российское", "одежда", "маркетплейс"]},
  "ozon.ru": {n:"Ozon", c:"Покупки", t:["российское", "маркетплейс", "доставка"]},
  "booking.com": {n:"Booking.com", c:"Покупки", t:["отели", "путешествия", "бронирование"]},

  // Работа и образование
  "github.com": {n:"GitHub", c:"Работа", t:["код", "репозитории", "разработка"]},
  "stackoverflow.com": {n:"Stack Overflow", c:"Работа", t:["вопросы", "ответы", "программирование"]},
  "coursera.org": {n:"Coursera", c:"Образование", t:["курсы", "образование", "университеты"]},
  "udemy.com": {n:"Udemy", c:"Образование", t:["курсы", "обучение", "навыки"]},
  "habr.com": {n:"Habr", c:"Работа", t:["программирование", "статьи", "сообщество"]},

  // Поиск и справочники
  "google.com": {n:"Google", c:"Поиск", t:["поиск", "браузер", "сервисы"]},
  "wikipedia.org": {n:"Wikipedia", c:"Энциклопедия", t:["знания", "статьи", "справочник"]},
  "yandex.ru": {n:"Яндекс", c:"Поиск", t:["поиск", "россия", "сервисы"]},

  // ИИ и технологии
  "chat.openai.com": {n:"ChatGPT", c:"ИИ", t:["искусственный интеллект", "чат", "помощник"]},
  "figma.com": {n:"Figma", c:"Дизайн", t:["дизайн", "прототипы", "коллаборация"]},

  // Музыка
  "spotify.com": {n:"Spotify", c:"Музыка", t:["музыка", "подкасты", "стриминг"]},
  "soundcloud.com": {n:"SoundCloud", c:"Музыка", t:["музыка", "аудио", "независимые"]},

  // Новости
  "bbc.com": {n:"BBC", c:"Новости", t:["новости", "медиа", "англия"]},
  "ria.ru": {n:"РИА Новости", c:"Новости", t:["новости", "россия", "агентство"]},

  // Облако и хранение
  "drive.google.com": {n:"Google Drive", c:"Облако", t:["облако", "документы", "хранилище"]},
  "dropbox.com": {n:"Dropbox", c:"Облако", t:["облако", "синхронизация", "файлы"]},

  // Карты
  "maps.google.com": {n:"Google Maps", c:"Карты", t:["карты", "навигация", "панорамы"]},
  
  // Дизайн
  "behance.net": {n:"Behance", c:"Дизайн", t:["дизайн", "портфолио", "креатив"]},
  
  // Фото
  "unsplash.com": {n:"Unsplash", c:"Фото", t:["фото", "сток", "бесплатно"]},

  // Образование
  "khanacademy.org": {n:"Khan Academy", c:"Образование", t:["образование", "бесплатно", "курсы"]},

  // Разработка
  "developer.mozilla.org": {n:"MDN Web Docs", c:"Разработка", t:["документация", "web", "разработка"]},

  // Путешествия
  "airbnb.com": {n:"Airbnb", c:"Путешествия", t:["жилье", "путешествия", "аренда"]},

  // Финансы
  "paypal.com": {n:"PayPal", c:"Финансы", t:["платежи", "деньги", "безопасность"]},

  // Здоровье
  "headspace.com": {n:"Headspace", c:"Здоровье", t:["медитация", "здоровье", "ментальное"]},

  // Продуктивность
  "notion.so": {n:"Notion", c:"Продуктивность", t:["организация", "заметки", "проекты"]},

  // Безопасность
  "haveibeenpwned.com": {n:"Have I Been Pwned", c:"Безопасность", t:["безопасность", "пароли", "утечки"]},

  // Разное
  "canva.com": {n:"Canva", c:"Дизайн", t:["дизайн", "графика", "просто"]},
  "zoom.us": {n:"Zoom", c:"Видео", t:["конференции", "видео", "встречи"]},
  "whatsapp.com": {n:"WhatsApp", c:"Мессенджер", t:["мессенджер", "общение", "шифрование"]}
};

// Кэш проверенных доменов
const domainCache = new Map();

/**
 * Проверить безопасность домена
 */
function checkDomainSafety(domain) {
  const result = {
    safe: "unknown",
    reason: "",
    details: null,
    score: 50  // Балл по умолчанию для неизвестных сайтов
  };
  
  // Приводим к нижнему регистру и удаляем www.
  const cleanDomain = domain.toLowerCase().replace(/^www\./, '');
  
  // 1. Проверка на безопасные сайты (полное совпадение)
  if (SAFE_SITES_DB[cleanDomain]) {
    result.safe = "safe";
    result.reason = "Проверенный безопасный сайт";
    result.details = SAFE_SITES_DB[cleanDomain];
    result.score = calculateSafetyScore(cleanDomain, true);
    domainCache.set(domain, result);
    return result;
  }
  
  // 2. Проверка поддоменов безопасных сайтов
  const parts = cleanDomain.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length; i++) {
      const parentDomain = parts.slice(i).join('.');
      if (SAFE_SITES_DB[parentDomain]) {
        result.safe = "safe";
        result.reason = "Поддомен безопасного сайта";
        result.details = SAFE_SITES_DB[parentDomain];
        result.score = calculateSafetyScore(parentDomain, true, parts[0]);
        domainCache.set(domain, result);
        return result;
      }
    }
  }
  
  // 3. Неизвестный сайт - автоматическая проверка и расчет балла
  result.safe = "unknown";
  result.reason = "Сайт не проверен";
  result.details = null;
  result.score = calculateSafetyScore(cleanDomain, false);
  
  domainCache.set(domain, result);
  return result;
}

/**
 * Расчет балла безопасности (0-100)
 */
function calculateSafetyScore(domain, isKnown, subdomain = '') {
  let score = 70; // Базовый балл
  
  if (isKnown) {
    // Известные сайты получают высокий балл
    score = 90;
    
    // Популярные домены получают максимальный балл
    const popularDomains = ['google.com', 'youtube.com', 'facebook.com', 'twitter.com', 
                           'instagram.com', 'github.com', 'stackoverflow.com', 'wikipedia.org'];
    if (popularDomains.some(d => domain.endsWith(d))) {
      score = 98;
    }
    
    // Поддомены известных сайтов могут иметь немного меньший балл
    if (subdomain && subdomain.length > 10) {
      score = Math.max(75, score - 10);
    }
  } else {
    // Для неизвестных сайтов анализируем домен
    
    // Домены с HTTPS (проверяем наличие в кэше или предполагаем)
    // Длинные домены могут быть подозрительными
    const domainParts = domain.split('.');
    const mainDomainLength = domainParts[domainParts.length - 2]?.length || 0;
    
    // Слишком длинные имена доменов снижают балл
    if (mainDomainLength > 15) {
      score -= 15;
    }
    
    // Домены с цифрами могут быть подозрительными
    if (/\d/.test(domain)) {
      score -= 10;
    }
    
    // Домены с дефисами могут быть фишинговыми
    if ((domain.match(/-/g) || []).length > 1) {
      score -= 15;
    }
    
    // Популярные TLD получают небольшой бонус
    const trustedTLDs = ['.com', '.org', '.net', '.edu', '.gov', '.ru', '.de', '.uk'];
    if (trustedTLDs.some(tld => domain.endsWith(tld))) {
      score += 5;
    }
    
    // Новые/редкие TLD могут снижать балл
    const suspiciousTLDs = ['.xyz', '.top', '.click', '.link', '.work', '.date'];
    if (suspiciousTLDs.some(tld => domain.endsWith(tld))) {
      score -= 20;
    }
    
    // Проверяем наличие слов "login", "secure", "verify" и т.д. (часто используются в фишинге)
    const phishingKeywords = ['login', 'secure', 'verify', 'account', 'update', 'confirm'];
    if (phishingKeywords.some(keyword => domain.includes(keyword))) {
      score -= 15;
    }
    
    // Ограничиваем балл от 0 до 100
    score = Math.max(0, Math.min(100, score));
  }
  
  return Math.round(score);
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
        const safety = checkDomainSafety(request.domain);
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