/**
* Файл: content.js
* SafeWeb Pro - Инжекция индикаторов безопасности в Google Search
*/

class GoogleSearchIndicator {
  constructor() {
    this.sitesData = {};
    this.checkedDomains = new Map();
    this.observerActive = false;
    this.init();
  }

  async init() {
    try {
      // Ждем загрузки DOM
      await this.waitForDOM();
      
      // Загружаем базу данных
      await this.loadDatabase();
      
      // Обрабатываем текущие результаты
      this.processSearchResults();
      
      // Наблюдаем за новыми результатами (infinite scroll)
      this.observeNewResults();
      
      console.log('🛡️ SafeWeb Pro - инициализирован на странице поиска Google');
    } catch (error) {
      console.error('Init error:', error);
    }
  }

  waitForDOM() {
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  async loadDatabase() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getAllSites' },
        (response) => {
          if (response && response.sites) {
            this.sitesData = response.sites;
          }
          resolve();
        }
      );
    });
  }

  /**
  * Обработать все результаты поиска на странице
  */
  processSearchResults() {
    // Google использует data-sokoban-container для результатов поиска
    const searchResults = document.querySelectorAll('div[data-sokoban-container]');
    if (searchResults.length === 0) {
      // Старая версия Google - ищем по другому селектору
      const oldResults = document.querySelectorAll('g-card-container, .g');
      oldResults.forEach(card => this.processResultCard(card));
    } else {
      searchResults.forEach(container => {
        this.processResultCard(container);
      });
    }
  }

  /**
  * Обработать отдельную карточку результата
  */
  processResultCard(cardElement) {
    try {
      // Пытаемся найти ссылку в результате
      const linkElement = cardElement.querySelector('a[href]');
      if (!linkElement || !linkElement.href) {
        return;
      }

      // Извлекаем домен из URL
      const url = linkElement.href;
      const domain = this.extractDomain(url);
      if (!domain) {
        return;
      }

      // Проверяем статус безопасности
      const status = this.checkDomainSafety(domain);

      // Добавляем цветную полоску
      this.addColorStrip(cardElement, status);
    } catch (error) {
      console.error('Error processing card:', error);
    }
  }

  /**
  * Извлечь домен из URL
  */
  extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname.replace(/^www\./, '').toLowerCase();
      return domain;
    } catch (e) {
      return null;
    }
  }

  /**
  * Проверить безопасность домена
  */
  checkDomainSafety(domain) {
    // Проверяем кеш
    if (this.checkedDomains.has(domain)) {
      return this.checkedDomains.get(domain);
    }

    let status = 'unknown'; // желтая полоска

    // Прямое совпадение
    if (this.sitesData[domain]) {
      status = 'safe'; // зеленая полоска
    } else {
      // Проверяем поддомены
      const parts = domain.split('.');
      if (parts.length > 2) {
        for (let i = 1; i < parts.length; i++) {
          const parentDomain = parts.slice(i).join('.');
          if (this.sitesData[parentDomain]) {
            status = 'safe';
            break;
          }
        }
      }
    }

    this.checkedDomains.set(domain, status);
    return status;
  }

  /**
  * Добавить цветную полоску
  */
  addColorStrip(cardElement, status) {
    // Проверяем, чтобы не добавить дубликат
    if (cardElement.dataset.safewebProcessed === 'true') {
      return;
    }

    // Определяем цвет полоски
    let color, title;
    switch(status) {
      case 'safe':
        color = '#10b981'; // зелёный
        title = '✓ Безопасный сайт';
        break;
      case 'unknown':
      default:
        color = '#f59e0b'; // жёлтый
        title = '? Неизвестный сайт';
    }

    // Добавляем цветную полоску слева
    cardElement.style.borderLeft = `4px solid ${color}`;
    cardElement.style.paddingLeft = '12px';
    cardElement.style.marginLeft = '-12px';
    cardElement.style.position = 'relative';
    cardElement.style.transition = 'all 0.2s ease';
    cardElement.dataset.safewebProcessed = 'true';
    cardElement.title = title;

    // Добавляем индикатор для неизвестных сайтов
    if (status === 'unknown') {
      const warningIcon = document.createElement('div');
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
      `;
      warningIcon.title = 'Неизвестный сайт - не проверен в базе безопасности';
      
      cardElement.appendChild(warningIcon);
      
      // Добавляем обработчик клика для предупреждения
      const link = cardElement.querySelector('a[href]');
      if (link) {
        link.addEventListener('click', (e) => {
          if (confirm(`⚠️ Внимание!\n\nВы собираетесь перейти на сайт, который не проверен в нашей базе безопасности:\n${this.extractDomain(link.href)}\n\nПродолжить?`)) {
            return true;
          }
          e.preventDefault();
          e.stopPropagation();
          return false;
        });
      }
    }

    // Эффект при наведении
    cardElement.addEventListener('mouseenter', () => {
      cardElement.style.borderLeftWidth = '6px';
      cardElement.style.paddingLeft = '10px';
      cardElement.style.marginLeft = '-10px';
    });

    cardElement.addEventListener('mouseleave', () => {
      cardElement.style.borderLeftWidth = '4px';
      cardElement.style.paddingLeft = '12px';
      cardElement.style.marginLeft = '-12px';
    });
  }

  /**
  * Наблюдать за новыми результатами (infinite scroll)
  */
  observeNewResults() {
    if (this.observerActive) {
      return;
    }

    // Ищем контейнер с результатами
    const resultsContainer = document.querySelector('#rso') ||
      document.querySelector('[role="main"]') ||
      document.body;

    if (!resultsContainer) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      // Обрабатываем только новые добавленные элементы
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            // Проверяем, не результат ли поиска
            if (node.matches && node.matches('[data-sokoban-container], .g, g-card-container')) {
              setTimeout(() => this.processResultCard(node), 100);
            }

            // Проверяем потомков
            const cards = node.querySelectorAll('[data-sokoban-container], .g, g-card-container');
            cards.forEach(card => setTimeout(() => this.processResultCard(card), 100));
          }
        });
      });
    });

    const observerConfig = {
      childList: true,
      subtree: true,
      attributes: false,
    };

    observer.observe(resultsContainer, observerConfig);
    this.observerActive = true;
    console.log('🛡️ SafeWeb Pro - Observer активирован для динамической загрузки');
  }
}

// Инициализируем расширение только на страницах Google Search
if (window.location.hostname.includes('google.')) {
  // Ждём полной загрузки DOM перед инициализацией
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new GoogleSearchIndicator();
    });
  } else {
    new GoogleSearchIndicator();
  }
}