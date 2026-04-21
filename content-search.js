/**
 * SafeWeb Pro - Индикаторы безопасности в поисковых системах
 */

class SearchSafety {
  constructor() {
    this.initialized = false;
    this.userSettings = {};
    this.init();
  }

  async init() {
    if (this.initialized) return;
    
    // Загружаем настройки
    await this.loadSettings();
    
    // Ждем загрузки DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getSettings' },
        (response) => {
          if (response?.success) {
            this.userSettings = response.settings;
          }
          resolve();
        }
      );
    });
  }

  async start() {
    try {
      console.log('🔍 SafeWeb: Инициализация на поисковой странице');
      
      // Обрабатываем существующие результаты
      this.processAllResults();
      
      // Наблюдаем за новыми результатами
      this.setupObserver();
      
      this.initialized = true;
    } catch (error) {
      console.error('SafeWeb init error:', error);
    }
  }

  processAllResults() {
    // Универсальные селекторы для поисковых систем
    const selectors = [
      // Google
      '.g',
      'div[data-sokoban-container]',
      '.tF2Cxc',
      
      // Яндекс
      '.serp-item',
      '.organic__url',
      '.link_theme_outer',
      '.Path-Item',
      
      // Bing
      '.b_algo',
      '.b_title',
      
      // DuckDuckGo
      '.result',
      '.result__body'
    ];
    
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        setTimeout(() => this.processResult(element), 100);
      });
    });
  }

  processResult(element) {
    try {
      // Находим ближайшую ссылку
      let linkElement = element.closest('a[href]') || element.querySelector('a[href]');
      if (!linkElement && element.tagName === 'A') {
        linkElement = element;
      }
      
      if (!linkElement || !linkElement.href) return;
      
      const url = new URL(linkElement.href);
      const domain = url.hostname.replace(/^www\./, '');
      
      // Проверяем безопасность
      this.checkAndMark(element, domain);
      
    } catch (error) {
      // Игнорируем ошибки парсинга
    }
  }

  async checkAndMark(element, domain) {
    try {
      // Пропускаем внутренние ссылки поисковиков
      if (domain.includes('google') || domain.includes('yandex') || 
          domain.includes('bing') || domain.includes('duckduckgo')) {
        return;
      }
      
      // Пропускаем, если предупреждение скрыто
      if (this.userSettings.hideWarnings && this.userSettings.hideWarnings[domain]) {
        return;
      }
      
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'checkDomain', domain: domain },
          resolve
        );
      });
      
      if (response?.success) {
        this.addColorStrip(element, response.result);
      }
    } catch (error) {
      console.warn('SafeWeb check error:', error);
    }
  }

  addColorStrip(element, result) {
    // Проверяем, не добавлен ли уже индикатор
    if (element.dataset.safewebProcessed === 'true') return;
    
    // Определяем цвет полоски
    let color, tooltip;
    
    switch(result.safe) {
      case 'safe':
        color = '#10b981'; // зеленый
        tooltip = 'Безопасный сайт';
        break;
      case 'unknown':
      default:
        color = '#f59e0b'; // желтый
        tooltip = 'Неизвестный сайт';
    }
    
    // Добавляем цветную полоску слева
    element.style.borderLeft = `4px solid ${color}`;
    element.style.paddingLeft = '12px';
    element.style.marginLeft = '-12px';
    element.style.position = 'relative';
    element.style.transition = 'all 0.2s ease';
    element.dataset.safewebProcessed = 'true';
    element.title = tooltip;
    
    // Для Яндекса добавляем дополнительный отступ
    if (window.location.hostname.includes('yandex')) {
      element.style.marginBottom = '16px';
      element.style.borderRadius = '8px';
      element.style.padding = '12px';
    }
    
    // Добавляем индикатор для неизвестных сайтов
    if (result.safe === 'unknown') {
      const warningIcon = document.createElement('span');
      warningIcon.innerHTML = '❓';
      warningIcon.style.cssText = `
        position: absolute;
        top: 8px;
        right: 8px;
        font-size: 16px;
        color: ${color};
        cursor: help;
        opacity: 0.6;
        transition: opacity 0.2s;
        z-index: 10;
      `;
      warningIcon.title = 'Неизвестный сайт - не проверен в базе безопасности';
      
      element.appendChild(warningIcon);
      
      // Добавляем обработчик клика для предупреждения
      const link = element.querySelector('a[href]');
      if (link) {
        const originalClick = link.onclick;
        const linkDomain = result.domain || domain;
        link.onclick = (e) => {
          if (confirm(`⚠️ Внимание!\n\nВы собираетесь перейти на сайт, который не проверен в нашей базе безопасности:\n${linkDomain}\n\nПродолжить?`)) {
            if (originalClick) return originalClick.call(link, e);
            return true;
          }
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
      }
    }
    
    // Эффект при наведении
    element.addEventListener('mouseenter', () => {
      element.style.borderLeftWidth = '6px';
      element.style.paddingLeft = '10px';
      element.style.marginLeft = '-10px';
      element.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.borderLeftWidth = '4px';
      element.style.paddingLeft = '12px';
      element.style.marginLeft = '-12px';
      element.style.boxShadow = 'none';
    });
  }

  setupObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            setTimeout(() => this.processResult(node), 100);
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Запускаем на поисковых страницах
if (window.location.hostname.match(/(google|yandex|bing|duckduckgo)\./)) {
  new SearchSafety();
}