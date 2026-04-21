/**
 * SafeWeb Pro - Индикаторы безопасности в поисковых системах
 */

class SearchSafety {
  constructor() {
    this.initialized = false;
    this.userSettings = {};
    this.userBlockedSites = {};
    // Расширенная база безопасных доменов
    this.safeDomainsBase = new Set([
      'google.com', 'youtube.com', 'wikipedia.org', 'github.com', 'stackoverflow.com',
      'microsoft.com', 'apple.com', 'amazon.com', 'mozilla.org', 'linux.org',
      'cloudflare.com', 'facebook.com', 'twitter.com', 'linkedin.com', 'instagram.com',
      'reddit.com', 'netflix.com', 'spotify.com', 'dropbox.com', 'slack.com',
      'zoom.us', 'adobe.com', 'oracle.com', 'ibm.com', 'intel.com', 'nvidia.com',
      'amd.com', 'telegram.org', 'whatsapp.com', 'signal.org', 'proton.me',
      'archive.org', 'medium.com', 'twitch.tv', 'discord.com', 'pinterest.com',
      'tumblr.com', 'flickr.com', 'vimeo.com', 'soundcloud.com', 'bandcamp.com',
      'shopify.com', 'wordpress.org', 'wix.com', 'squarespace.com', 'godaddy.com',
      'namecheap.com', 'digitalocean.com', 'heroku.com', 'vercel.com', 'netlify.com',
      'aws.amazon.com', 'azure.microsoft.com', 'cloud.google.com', 'alibabacloud.com',
      'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'brilliant.org',
      'nytimes.com', 'bbc.com', 'cnn.com', 'reuters.com', 'apnews.com',
      'who.int', 'cdc.gov', 'nih.gov', 'nature.com', 'science.org',
      'arxiv.org', 'ieee.org', 'acm.org', 'w3.org', 'ietf.org',
      'python.org', 'nodejs.org', 'rust-lang.org', 'golang.org', 'swift.org',
      'docker.com', 'kubernetes.io', 'jenkins.io', 'gitlab.com', 'bitbucket.org',
      'figma.com', 'canva.com', 'notion.so', 'trello.com', 'asana.com',
      'airbnb.com', 'booking.com', 'expedia.com', 'tripadvisor.com', 'yelp.com',
      'uber.com', 'lyft.com', 'doordash.com', 'grubhub.com', 'postmates.com',
      'paypal.com', 'stripe.com', 'square.com', 'coinbase.com', 'binance.com',
      'ebay.com', 'etsy.com', 'aliexpress.com', 'wish.com', 'rakuten.com',
      'hulu.com', 'disneyplus.com', 'hbomax.com', 'peacocktv.com', 'paramountplus.com',
      'espn.com', 'nba.com', 'nfl.com', 'mlb.com', 'nhl.com',
      'weather.com', 'accuweather.com', 'wunderground.com', 'timeanddate.com',
      'mapquest.com', 'openstreetmap.org', 'bing.com', 'duckduckgo.com', 'yahoo.com',
      'mail.ru', 'yandex.ru', 'vk.com', 'ok.ru', 'avito.ru',
      'ozon.ru', 'wildberries.ru', 'sberbank.ru', 'tinkoff.ru', 'alfabank.ru',
      'gosuslugi.ru', 'nalog.ru', 'pfr.gov.ru', 'rospotrebnadzor.ru', 'mvd.ru'
    ]);
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
            // Применяем режим эксперта к body
            if (this.userSettings.expertMode) {
              document.body.classList.add('safeweb-expert-mode');
            }
          }
          resolve();
        }
      );
    });
  }

  async saveSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { 
          action: 'updateSettings', 
          settings: { 
            ...this.userSettings, 
            blockedSites: this.userBlockedSites 
          } 
        },
        resolve
      );
    });
  }

  async exportSettings() {
    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      settings: this.userSettings,
      blockedSites: this.userBlockedSites,
      safeDomainsBase: Array.from(this.safeDomainsBase)
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safeweb-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.showNotification('Настройки экспортированы успешно!');
  }

  async importSettings(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.version || !data.settings) {
            throw new Error('Неверный формат файла');
          }
          
          this.userSettings = data.settings || {};
          this.userBlockedSites = data.blockedSites || {};
          if (data.safeDomainsBase) {
            this.safeDomainsBase = new Set(data.safeDomainsBase);
          }
          
          await this.saveSettings();
          
          if (this.userSettings.expertMode) {
            document.body.classList.add('safeweb-expert-mode');
          } else {
            document.body.classList.remove('safeweb-expert-mode');
          }
          
          this.showNotification('Настройки импортированы успешно!');
          resolve(true);
        } catch (error) {
          this.showNotification('Ошибка импорта: ' + error.message);
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsText(file);
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

  async addColorStrip(element, result, domain, userStatus) {
    if (element.dataset.safewebProcessed === 'true') return;

    let color, tooltip, status, securityScore = 50;

    // Проверяем SSL
    const hasSSL = await this.checkSSL(domain);

    if (userStatus === 'blocked') {
      color = '#ef4444';
      tooltip = 'Заблокированный сайт (пользователь)';
      status = 'blocked';
      securityScore = 0;
    } else if (userStatus === 'trusted') {
      color = '#10b981';
      tooltip = 'Доверенный сайт (пользователь)';
      status = 'trusted';
      securityScore = 100;
    } else if (result.safe === 'safe') {
      color = '#10b981';
      tooltip = 'Безопасный сайт';
      status = 'safe';
      securityScore = hasSSL ? 95 : 70;
    } else {
      color = '#f59e0b';
      tooltip = 'Неизвестный сайт';
      status = 'unknown';
      securityScore = hasSSL ? 50 : 30;
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

    // Добавляем прогресс-бар безопасности и SSL бейдж
    const infoContainer = document.createElement('div');
    infoContainer.className = 'sw-security-info';
    infoContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
      font-size: 11px;
      color: #666;
    `;

    const progressBar = document.createElement('div');
    progressBar.className = 'sw-security-bar';
    progressBar.style.cssText = `
      flex-grow: 1;
      height: 4px;
      background: #e0e0e0;
      border-radius: 2px;
      overflow: hidden;
      max-width: 100px;
    `;

    const progressFill = document.createElement('div');
    progressFill.className = 'sw-security-fill';
    progressFill.style.cssText = `
      height: 100%;
      background: ${securityScore >= 70 ? '#10b981' : securityScore >= 40 ? '#f59e0b' : '#ef4444'};
      width: ${securityScore}%;
      transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s;
    `;

    progressBar.appendChild(progressFill);

    const sslBadge = document.createElement('span');
    sslBadge.className = 'sw-ssl-badge' + (hasSSL ? '' : ' invalid');
    sslBadge.textContent = hasSSL ? '🔒 SSL' : '⚠️ Нет SSL';
    sslBadge.style.cssText = `
      font-size: 10px;
      padding: 1px 4px;
      border-radius: 3px;
      background: ${hasSSL ? '#e8f5e9' : '#ffebee'};
      color: ${hasSSL ? '#2e7d32' : '#c62828'};
      border: 1px solid ${hasSSL ? '#c8e6c9' : '#ffcdd2'};
      white-space: nowrap;
    `;

    infoContainer.appendChild(progressBar);
    infoContainer.appendChild(sslBadge);

    const titleElement = element.querySelector('h3, .title, a[href]');
    if (titleElement && !element.querySelector('.sw-security-info')) {
      titleElement.after(infoContainer);
    }

    if (result.safe === 'unknown' && !userStatus) {
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

  async checkSSL(domain) {
    // Проверяем, есть ли домен в базе безопасных (у них обычно есть SSL)
    if (this.safeDomainsBase.has(domain) || 
        Array.from(this.safeDomainsBase).some(d => domain.endsWith('.' + d))) {
      return true;
    }

    // Для неизвестных доменов предполагаем наличие SSL по умолчанию
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      await fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return true;
    } catch (e) {
      return false;
    }
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
