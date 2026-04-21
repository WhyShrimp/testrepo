/**
 * SafeWeb Pro - Индикаторы безопасности в поисковых системах
 */

class SearchSafety {
  constructor() {
    this.initialized = false;
    this.userSettings = {};
    this.userBlockedSites = {};
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
            this.userSettings = response.settings || {};
            this.userBlockedSites = response.settings?.blockedSites || {};
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
    const selectors = [
      '.g', 'div[data-sokoban-container]', '.tF2Cxc',
      '.serp-item', '.organic__url', '.link_theme_outer', '.Path-Item',
      '.b_algo', '.b_title',
      '.result', '.result__body'
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
      let linkElement = element.closest('a[href]') || element.querySelector('a[href]');
      if (!linkElement && element.tagName === 'A') {
        linkElement = element;
      }
      
      if (!linkElement || !linkElement.href) return;
      
      const url = new URL(linkElement.href);
      const domain = url.hostname.replace(/^www\./, '');
      
      this.checkAndMark(element, domain);
      
    } catch (error) {
      // Игнорируем ошибки парсинга
    }
  }

  async checkAndMark(element, domain) {
    try {
      if (domain.includes('google') || domain.includes('yandex') || 
          domain.includes('bing') || domain.includes('duckduckgo')) {
        return;
      }
      
      const userSiteStatus = this.userBlockedSites[domain];
      
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
        this.addColorStrip(element, response.result, domain, userSiteStatus);
      }
    } catch (error) {
      console.warn('SafeWeb check error:', error);
    }
  }

  addColorStrip(element, result, domain, userStatus) {
    if (element.dataset.safewebProcessed === 'true') return;
    
    let color, tooltip, status;
    
    if (userStatus === 'blocked') {
      color = '#ef4444';
      tooltip = 'Заблокированный сайт (пользователь)';
      status = 'blocked';
    } else if (userStatus === 'trusted') {
      color = '#10b981';
      tooltip = 'Доверенный сайт (пользователь)';
      status = 'trusted';
    } else if (result.safe === 'safe') {
      color = '#10b981';
      tooltip = 'Безопасный сайт';
      status = 'safe';
    } else {
      color = '#f59e0b';
      tooltip = 'Неизвестный сайт';
      status = 'unknown';
    }
    
    element.style.borderLeft = `4px solid ${color}`;
    element.style.paddingLeft = '12px';
    element.style.marginLeft = '-12px';
    element.style.position = 'relative';
    element.style.transition = 'all 0.2s ease';
    element.dataset.safewebProcessed = 'true';
    element.dataset.safewebStatus = status;
    element.title = tooltip;
    
    if (window.location.hostname.includes('yandex')) {
      element.style.marginBottom = '16px';
      element.style.borderRadius = '8px';
      element.style.padding = '12px';
    }
    
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
      
      const link = element.querySelector('a[href]');
      if (link) {
        const originalClick = link.onclick;
        link.onclick = (e) => {
          if (confirm(`⚠️ Внимание!\n\nВы собираетесь перейти на сайт, который не проверен в нашей базе безопасности:\n${domain}\n\nПродолжить?`)) {
            if (originalClick) return originalClick.call(link, e);
            return true;
          }
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
      }
    }
    
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
    
    element.addEventListener('contextmenu', (e) => {
      this.showSiteContextMenu(e, domain, status, element);
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

  getStatusIcon(status) {
    switch(status) {
      case 'blocked': return '🚫';
      case 'trusted': return '✅';
      case 'safe': return '✓';
      case 'unknown': 
      default: return '❓';
    }
  }

  async showSiteContextMenu(event, domain, status, element) {
    event.preventDefault();
    event.stopPropagation();
    
    const existingMenu = document.querySelector('.safeweb-context-menu');
    if (existingMenu) existingMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'safeweb-context-menu';
    menu.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      padding: 8px 0;
      min-width: 200px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Позиционируем меню прямо под местом клика
    const rect = element.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 200;
    
    let left = event.clientX;
    let top = event.clientY + 10; // Небольшой отступ сверху
    
    // Проверяем, не выходит ли меню за правый край экрана
    if (left + menuWidth > window.innerWidth) {
      left = window.innerWidth - menuWidth - 10;
    }
    
    // Проверяем, не выходит ли меню за нижний край экрана
    if (top + menuHeight > window.innerHeight) {
      top = event.clientY - menuHeight - 10; // Показываем над элементом
    }
    
    menu.style.left = Math.max(10, left) + 'px';
    menu.style.top = Math.max(10, top) + 'px';
    
    const isExpertMode = this.userSettings.expertMode === true;
    
    const actions = [
      { icon: '🔒', text: 'Добавить в доверенные', action: 'trust', show: status !== 'trusted' },
      { icon: isExpertMode ? '🔴' : '🚫', text: isExpertMode ? 'Заблокировать сайт' : 'Заблокировать (только эксперт)', action: 'block', show: status !== 'blocked', disabled: !isExpertMode },
      { icon: '↩️', text: 'Убрать из доверенных', action: 'untrust', show: status === 'trusted' },
      { icon: '✅', text: 'Разблокировать сайт', action: 'unblock', show: status === 'blocked' },
      { icon: '📤', text: 'Поделиться в базе', action: 'share', show: true }
    ];
    
    menu.innerHTML = actions.filter(a => a.show).map(item => `
      <div class="context-menu-item" data-action="${item.action}" style="
        padding: 10px 16px;
        cursor: ${item.disabled ? 'not-allowed' : 'pointer'};
        display: flex;
        align-items: center;
        gap: 10px;
        transition: background 0.2s;
        opacity: ${item.disabled ? '0.5' : '1'};
      " onmouseover="if(!${item.disabled}) this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
        <span>${item.icon}</span>
        <span>${item.text}</span>
      </div>
    `).join('');
    
    menu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (item.style.opacity === '0.5') return;
        
        const action = item.dataset.action;
        await this.handleSiteAction(action, domain);
        menu.remove();
        element.dataset.safewebProcessed = 'false';
        this.processResult(element);
      });
    });
    
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });
    
    document.body.appendChild(menu);
  }

  async handleSiteAction(action, domain) {
    const blockedSites = this.userBlockedSites || {};
    
    switch(action) {
      case 'trust':
        blockedSites[domain] = 'trusted';
        break;
      case 'block':
        if (!this.userSettings.expertMode) {
          alert('Функция блокировки доступна только в режиме "Опытный пользователь"');
          return;
        }
        blockedSites[domain] = 'blocked';
        break;
      case 'untrust':
        delete blockedSites[domain];
        break;
      case 'unblock':
        blockedSites[domain] = 'trusted';
        break;
      case 'share':
        await this.shareSiteToDatabase(domain);
        return;
    }
    
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'updateBlockedSites', blockedSites },
        resolve
      );
    });
    
    this.userBlockedSites = blockedSites;
    this.showNotification(`Сайт ${domain} обновлен`);
  }

  async shareSiteToDatabase(domain) {
    const siteName = prompt(`Введите название сайта ${domain}:`, domain);
    if (!siteName) return;
    
    const category = prompt('Категория (например: Другое):', 'Пользовательское');
    if (!category) return;
    
    const tags = prompt('Теги через запятую:', 'пользовательское');
    
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { 
          action: 'shareSite', 
          domain, 
          siteData: { n: siteName, c: category || 'Другое', t: (tags || '').split(',').map(t => t.trim()) }
        },
        resolve
      );
    });
    
    alert('Спасибо! Ваш сайт отправлен на модерацию в общую базу.');
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10001;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }
}

// Запускаем на поисковых страницах
if (window.location.hostname.match(/(google|yandex|bing|duckduckgo)\./)) {
  new SearchSafety();
}
