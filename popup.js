/**
 * Попап SafeWeb Pro
 */

class SafeWebProPopup {
  constructor() {
    this.currentUrl = null;
    this.currentDomain = null;
    this.allSitesData = {};
    this.isDarkMode = false;
    this.searchTimer = null;
    this.databaseSort = 'name';
    this.userStats = {};
    this.userSettings = {};
    this.init();
  }

  async init() {
    try {
      console.log('Initializing SafeWeb Pro Popup...');
      
      // Настройка темы
      await this.setupTheme();
      
      // Настройка событий
      this.setupEventListeners();
      this.setupTabs();
      
      // Получаем текущую вкладку
      await this.getCurrentTab();
      
      // Загружаем базу данных
      await this.loadDatabase();
      
      // Загружаем статистику
      await this.loadStats();
      
      // Загружаем настройки
      await this.loadSettings();
      
      // Показываем начальное состояние
      this.showInitialState();
      
      console.log('✅ SafeWeb Pro Popup инициализирован');
    } catch (error) {
      console.error('Init error:', error);
      this.showNotification('Ошибка при загрузке расширения', 'error');
    }
  }

  async setupTheme() {
    try {
      const result = await chrome.storage.local.get(['theme']);
      if (result.theme === 'dark') {
        this.enableDarkMode();
      } else if (result.theme === 'light') {
        this.disableDarkMode();
      }
    } catch (error) {
      console.error('Theme setup error:', error);
    }
  }

  setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Поиск сайтов
    const siteSearch = document.getElementById('siteSearch');
    if (siteSearch) {
      siteSearch.addEventListener('input', (e) => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.performSearch(e.target.value);
        }, 300);
      });
    }
    
    // Кнопки управления базой данных
    const sortByNameBtn = document.getElementById('sortByName');
    if (sortByNameBtn) {
      sortByNameBtn.addEventListener('click', () => {
        this.databaseSort = 'name';
        this.updateDatabaseSortButtons();
        this.displayAllSites();
      });
    }
    
    const sortByCategoryBtn = document.getElementById('sortByCategory');
    if (sortByCategoryBtn) {
      sortByCategoryBtn.addEventListener('click', () => {
        this.databaseSort = 'category';
        this.updateDatabaseSortButtons();
        this.displayAllSites();
      });
    }
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportDatabase());
    }
    
    // Основные кнопки в header
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleDarkMode());
    }
    
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }
    
    // Инструменты
    const checkCurrentSite = document.getElementById('checkCurrentSite');
    if (checkCurrentSite) {
      checkCurrentSite.addEventListener('click', () => this.checkCurrentSiteSafety());
    }
    
    const clearCache = document.getElementById('clearCache');
    if (clearCache) {
      clearCache.addEventListener('click', () => this.clearCache());
    }
    
    const exportDatabaseTool = document.getElementById('exportDatabase');
    if (exportDatabaseTool) {
      exportDatabaseTool.addEventListener('click', () => this.exportDatabase());
    }

    const exportUserSettingsBtn = document.getElementById('exportUserSettingsBtn');
    if (exportUserSettingsBtn) {
      exportUserSettingsBtn.addEventListener('click', () => this.exportUserSettings());
    }

    const importUserSettingsBtn = document.getElementById('importUserSettingsBtn');
    if (importUserSettingsBtn) {
      importUserSettingsBtn.addEventListener('click', () => this.importUserSettings());
    }
    
    // Аккаунт
    const resetStatsBtn = document.getElementById('resetStatsBtn');
    if (resetStatsBtn) {
      resetStatsBtn.addEventListener('click', () => this.showResetStatsConfirm());
    }
    
    const exportStatsBtn = document.getElementById('exportStatsBtn');
    if (exportStatsBtn) {
      exportStatsBtn.addEventListener('click', () => this.exportStats());
    }
    
    const resetStatsModalBtn = document.getElementById('resetStatsModalBtn');
    if (resetStatsModalBtn) {
      resetStatsModalBtn.addEventListener('click', () => this.resetStats());
    }
    
    // Настройки
    const settingEmailWarnings = document.getElementById('settingEmailWarnings');
    if (settingEmailWarnings) {
      settingEmailWarnings.addEventListener('change', (e) => {
        this.updateSetting('showEmailWarnings', e.target.checked);
      });
    }
    
    const settingUnknownWarnings = document.getElementById('settingUnknownWarnings');
    if (settingUnknownWarnings) {
      settingUnknownWarnings.addEventListener('change', (e) => {
        this.updateSetting('showUnknownWarnings', e.target.checked);
      });
    }
    
    const settingSoundOnWarning = document.getElementById('settingSoundOnWarning');
    if (settingSoundOnWarning) {
      settingSoundOnWarning.addEventListener('change', (e) => {
        this.updateSetting('soundOnWarning', e.target.checked);
      });
    }

    const settingExpertMode = document.getElementById('settingExpertMode');
    if (settingExpertMode) {
      settingExpertMode.addEventListener('change', (e) => {
        this.updateSetting('expertMode', e.target.checked);
        this.userSettings.expertMode = e.target.checked;
        this.showNotification(
          e.target.checked ? 'Режим опытного пользователя включен' : 'Режим опытного пользователя выключен',
          e.target.checked ? 'success' : 'info'
        );
      });
    }
    
    const settingTheme = document.getElementById('settingTheme');
    if (settingTheme) {
      settingTheme.addEventListener('change', (e) => {
        this.updateSetting('theme', e.target.value);
        this.applyTheme(e.target.value);
      });
    }
    
    const restoreWarningsBtn = document.getElementById('restoreWarningsBtn');
    if (restoreWarningsBtn) {
      restoreWarningsBtn.addEventListener('click', () => this.restoreWarnings());
    }
    
    const clearHiddenWarningsBtn = document.getElementById('clearHiddenWarningsBtn');
    if (clearHiddenWarningsBtn) {
      clearHiddenWarningsBtn.addEventListener('click', () => this.clearHiddenWarnings());
    }
    
    // Модальные окна
    const modalClose = document.querySelectorAll('.modal-close');
    modalClose.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) {
          this.closeModal(modal.id);
        } else {
          this.closeModal('siteDetailsModal');
        }
      });
    });
    
    const openSiteBtn = document.getElementById('openSiteBtn');
    if (openSiteBtn) {
      openSiteBtn.addEventListener('click', () => {
        const url = document.getElementById('modalSiteUrl')?.textContent;
        if (url) {
          chrome.tabs.create({ url: `https://${url}` });
          window.close();
        }
      });
    }
    
    // Закрытие модалок по клику вне окна
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal.id);
        }
      });
    });
    
    console.log('✅ Event listeners установлены');
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // Скрываем все табы
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    
    // Убираем активный класс у всех кнопок
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    // Показываем выбранный таб
    const targetTab = document.getElementById(`${tabName}Tab`);
    const targetButton = document.querySelector(`.tab[data-tab="${tabName}"]`);
    
    if (targetTab) targetTab.classList.add('active');
    if (targetButton) targetButton.classList.add('active');
    
    // Обновляем контент в зависимости от таба
    switch(tabName) {
      case 'database':
        this.displayAllSites();
        break;
      case 'account':
        this.displayAccountStats();
        break;
      case 'settings':
        this.displaySettings();
        break;
    }
  }

  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          this.currentUrl = new URL(url);
          this.currentDomain = this.currentUrl.hostname.replace(/^www\./, '').toLowerCase();
          console.log('Current domain:', this.currentDomain);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error getting current tab:', error);
      return false;
    }
  }

  async loadDatabase() {
    return new Promise((resolve) => {
      console.log('Loading database...');
      
      chrome.runtime.sendMessage(
        { action: 'getAllSites' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            this.allSitesData = {};
            this.showNotification('Ошибка загрузки базы данных', 'error');
          } else if (response && response.success) {
            this.allSitesData = response.sites || {};
            console.log('✅ База загружена:', Object.keys(this.allSitesData).length, 'сайтов');
          } else {
            this.allSitesData = {};
            console.warn('No sites data received');
          }
          
          this.updateStats();
          resolve();
        }
      );
    });
  }

  async loadStats() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getStats' },
        (response) => {
          if (response?.success) {
            this.userStats = response.stats || {};
            console.log('📈 Статистика загружена:', this.userStats);
          }
          resolve();
        }
      );
    });
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getSettings' },
        (response) => {
          if (response?.success) {
            this.userSettings = response.settings || {};
            console.log('⚙️ Настройки загружены:', this.userSettings);
            
            // Применяем настройки темы
            if (this.userSettings.theme) {
              this.applyTheme(this.userSettings.theme);
            }
          }
          resolve();
        }
      );
    });
  }

  showInitialState() {
    const resultsContainer = document.getElementById('resultsContainer');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-text">Введите URL или название сайта для поиска</div>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;">
            Пример: google.com, youtube.com
          </div>
        </div>
      `;
    }
  }

  performSearch(query) {
    const resultsContainer = document.getElementById('resultsContainer');
    if (!query || !query.trim()) {
      this.showInitialState();
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const results = this.searchInDatabase(normalizedQuery);
    this.displaySearchResults(results, normalizedQuery, resultsContainer);
  }

  searchInDatabase(query) {
    return Object.entries(this.allSitesData)
      .filter(([domain, site]) => {
        return domain.includes(query) ||
               site.n.toLowerCase().includes(query) ||
               site.c.toLowerCase().includes(query) ||
               (site.t && site.t.some(tag => tag.toLowerCase().includes(query)));
      })
      .sort((a, b) => a[1].n.localeCompare(b[1].n));
  }

  displaySearchResults(results, query = '', container) {
    if (!container) return;

    if (results.length === 0) {
      container.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">🔍</div>
          <div class="no-results-text">Ничего не найдено по запросу "${query}"</div>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;">
            Попробуйте другой запрос или проверьте сайт вручную
          </div>
        </div>
      `;
    } else {
      container.innerHTML = results.map(([domain, site]) => `
        <div class="result-card" data-domain="${domain}">
          <div class="result-header">
            <div class="result-name">
              <div class="site-icon-small">${this.getSiteIcon(site.c)}</div>
              <div>
                <div class="site-name">${site.n}</div>
                <div class="site-url">${domain}</div>
              </div>
            </div>
            <span class="safety-status safe">✓ БЕЗОПАСНЫЙ</span>
          </div>
          
          <div class="site-details">
            <div class="category-badge">${site.c}</div>
            ${site.t && site.t.length > 0 ? `
              <div class="result-tags">
                ${site.t.map(tag => `<span class="tag">${tag}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          
          <div class="result-actions">
            <button class="btn btn-secondary" data-action="details">Подробнее</button>
            <button class="btn btn-primary" data-action="open">Открыть</button>
          </div>
        </div>
      `).join('');

      // Добавляем обработчики событий для карточек
      container.querySelectorAll('.result-card').forEach(card => {
        const domain = card.dataset.domain;
        
        card.querySelector('[data-action="open"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.tabs.create({ url: `https://${domain}` });
          window.close();
        });
        
        card.querySelector('[data-action="details"]')?.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showSiteDetails(domain);
        });
        
        card.addEventListener('click', (e) => {
          if (!e.target.closest('button')) {
            this.showSiteDetails(domain);
          }
        });
      });
    }
  }

  displayAllSites() {
    const resultsContainer = document.getElementById('databaseResults');
    if (!resultsContainer) return;

    const results = Object.entries(this.allSitesData);
    
    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="no-results">
          <div class="no-results-icon">📋</div>
          <div class="no-results-text">База данных пуста</div>
        </div>
      `;
      return;
    }

    // Группируем по категориям если сортировка по категориям
    if (this.databaseSort === 'category') {
      const grouped = {};
      results.forEach(([domain, site]) => {
        if (!grouped[site.c]) grouped[site.c] = [];
        grouped[site.c].push([domain, site]);
      });

      resultsContainer.innerHTML = Object.entries(grouped)
        .sort(([catA], [catB]) => catA.localeCompare(catB))
        .map(([category, sites]) => `
          <div class="category-section">
            <div class="category-header">
              ${category}
              <span>(${sites.length})</span>
            </div>
            ${sites
              .sort((a, b) => a[1].n.localeCompare(b[1].n))
              .map(([domain, site]) => this.createDatabaseCard(domain, site))
              .join('')}
          </div>
        `).join('');
    } else {
      resultsContainer.innerHTML = results
        .sort((a, b) => a[1].n.localeCompare(b[1].n))
        .map(([domain, site]) => this.createDatabaseCard(domain, site))
        .join('');
    }

    // Добавляем обработчики событий
    resultsContainer.querySelectorAll('.result-card').forEach(card => {
      const domain = card.dataset.domain;
      
      card.querySelector('[data-action="details"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showSiteDetails(domain);
      });
      
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.showSiteDetails(domain);
        }
      });
    });
  }

  createDatabaseCard(domain, site) {
    return `
      <div class="result-card" data-domain="${domain}">
        <div class="result-header">
          <div class="result-name">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="site-icon-small">${this.getSiteIcon(site.c)}</div>
              <div>
                <div style="font-weight: bold;">${site.n}</div>
                <div style="font-size: 12px; color: var(--color-text-secondary);">${domain}</div>
              </div>
            </div>
          </div>
          <span class="category-badge">${site.c}</span>
        </div>
        
        ${site.t && site.t.length > 0 ? `
          <div class="result-tags">
            ${site.t.map(tag => `<span class="tag">${tag}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="result-actions">
          <button class="btn btn-secondary" data-action="details">Подробнее</button>
        </div>
      </div>
    `;
  }

  displayAccountStats() {
    // Обновляем основные статистики
    document.getElementById('statTotalVisits').textContent = this.userStats.totalVisits || 0;
    document.getElementById('statSafeVisits').textContent = this.userStats.safeVisits || 0;
    document.getElementById('statUnknownVisits').textContent = this.userStats.unknownVisits || 0;
    document.getElementById('statUniqueSites').textContent = Object.keys(this.userStats.sitesVisited || {}).length;
    
    // Обновляем счетчик последних посещений
    const visitsCount = Math.min(Object.keys(this.userStats.sitesVisited || {}).length, 10);
    document.getElementById('lastVisitsCount').textContent = `(${visitsCount})`;
    
    // Отображаем последние посещения
    this.displayLastVisits();
  }

  displayLastVisits() {
    const container = document.getElementById('lastVisitsContainer');
    if (!container) return;
    
    const sitesVisited = this.userStats.sitesVisited || {};
    const sortedSites = Object.entries(sitesVisited)
      .sort(([,a], [,b]) => new Date(b.lastVisit) - new Date(a.lastVisit))
      .slice(0, 10);
    
    if (sortedSites.length === 0) {
      container.innerHTML = `
        <div class="no-results" style="padding: 40px 20px;">
          <div class="no-results-icon">📊</div>
          <div class="no-results-text">Статистика посещений пуста</div>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 8px;">
            Начните посещать сайты для сбора статистики
          </div>
        </div>
      `;
      return;
    }
    
    container.innerHTML = sortedSites.map(([domain, stats]) => {
      let statusColor, statusIcon, statusText;
      
      switch(stats.lastStatus) {
        case 'safe':
          statusColor = '#10b981';
          statusIcon = '✅';
          statusText = 'Безопасный';
          break;
        default:
          statusColor = '#f59e0b';
          statusIcon = '❓';
          statusText = 'Неизвестный';
      }
      
      const visitDate = new Date(stats.lastVisit).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      return `
        <div class="visit-item">
          <div class="visit-header">
            <div class="visit-domain">${domain}</div>
            <div class="visit-status" style="color: ${statusColor}">
              ${statusIcon} ${statusText}
            </div>
          </div>
          <div class="visit-details">
            <div class="visit-count">
              <span>👁️ Посещений:</span>
              <strong>${stats.count}</strong>
            </div>
            <div class="visit-category">
              <span>📁 Категория:</span>
              <strong>${stats.category}</strong>
            </div>
            <div class="visit-date">
              <span>🕒 Последнее:</span>
              <strong>${visitDate}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  displaySettings() {
    // Устанавливаем значения переключателей из настроек
    document.getElementById('settingEmailWarnings').checked = this.userSettings.showEmailWarnings !== false;
    document.getElementById('settingUnknownWarnings').checked = this.userSettings.showUnknownWarnings !== false;
    document.getElementById('settingSoundOnWarning').checked = this.userSettings.soundOnWarning === true;
    document.getElementById('settingExpertMode').checked = this.userSettings.expertMode === true;
    document.getElementById('settingTheme').value = this.userSettings.theme || 'auto';
  }

  async updateSetting(key, value) {
    this.userSettings[key] = value;
    
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { 
          action: 'updateSettings',
          settings: { [key]: value }
        },
        resolve
      );
    });
    
    this.showNotification('Настройка сохранена', 'success');
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      this.enableDarkMode();
    } else if (theme === 'light') {
      this.disableDarkMode();
    } else {
      // Авто режим - сброс атрибута
      document.documentElement.removeAttribute('data-color-scheme');
    }
    
    // Обновляем кнопку темы
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  getSiteIcon(category) {
    const icons = {
      'Соцсети': '👥',
      'Видео': '🎥',
      'Игры': '🎮',
      'Покупки': '🛒',
      'Работа': '💼',
      'Поиск': '🔍',
      'Энциклопедия': '📚',
      'ИИ': '🤖',
      'Дизайн': '🎨',
      'Музыка': '🎵',
      'Новости': '📰',
      'Облако': '☁️',
      'Карты': '🗺️',
      'Образование': '📖',
      'Разработка': '💻',
      'Путешествия': '✈️',
      'Финансы': '💰',
      'Здоровье': '❤️',
      'Продуктивность': '📊',
      'Безопасность': '🛡️',
      'Мессенджер': '💬',
      'Технологии': '💻'
    };
    
    return icons[category] || '🌐';
  }

  updateStats() {
    const total = Object.keys(this.allSitesData).length;
    const categories = new Set(Object.values(this.allSitesData).map(site => site.c)).size;
    
    const totalSitesElement = document.getElementById('totalSites');
    const totalCategoriesElement = document.getElementById('totalCategories');
    
    if (totalSitesElement) totalSitesElement.textContent = total;
    if (totalCategoriesElement) totalCategoriesElement.textContent = categories;
  }

  updateDatabaseSortButtons() {
    const nameBtn = document.getElementById('sortByName');
    const categoryBtn = document.getElementById('sortByCategory');
    
    if (nameBtn && categoryBtn) {
      nameBtn.classList.toggle('active', this.databaseSort === 'name');
      categoryBtn.classList.toggle('active', this.databaseSort === 'category');
    }
  }

  showSiteDetails(domain) {
    const siteInfo = this.allSitesData[domain];
    if (!siteInfo) return;

    // Заполняем модальное окно
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    if (modalTitle && modalBody) {
      modalTitle.textContent = siteInfo.n;
      
      modalBody.innerHTML = `
        <div style="
          background: linear-gradient(135deg, var(--color-surface) 0%, rgba(var(--color-teal-500-rgb), 0.05) 100%);
          border-radius: 16px;
          padding: 24px;
          margin-bottom: 24px;
          border: 1px solid rgba(var(--color-teal-500-rgb), 0.1);
        ">
          <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
            <div style="
              width: 64px;
              height: 64px;
              background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
              border-radius: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 28px;
              color: var(--color-btn-primary-text);
              box-shadow: 0 8px 20px rgba(var(--color-teal-500-rgb), 0.3);
              flex-shrink: 0;
            ">
              ${this.getSiteIcon(siteInfo.c)}
            </div>
            <div style="flex: 1;">
              <div style="
                font-size: 22px;
                font-weight: 700;
                color: var(--color-text);
                margin-bottom: 6px;
                letter-spacing: -0.3px;
              ">${siteInfo.n}</div>
              <div style="
                font-size: 14px;
                color: var(--color-text-secondary);
                font-family: 'SF Mono', 'Monaco', monospace;
                word-break: break-all;
              ">${domain}</div>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
            <div style="
              background: linear-gradient(135deg, var(--color-success) 0%, var(--color-primary-hover) 100%);
              color: var(--color-btn-primary-text);
              padding: 8px 16px;
              border-radius: 50px;
              font-size: 13px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 8px;
              box-shadow: 0 4px 12px rgba(var(--color-teal-500-rgb), 0.2);
            ">
              <span>✓</span>
              <span>БЕЗОПАСНЫЙ</span>
            </div>
            
            <div style="
              background: var(--tag-green);
              color: var(--tag-green-text);
              padding: 8px 16px;
              border-radius: 50px;
              font-size: 13px;
              font-weight: 600;
              border: 1px solid var(--tag-green-border);
            ">
              ${siteInfo.c}
            </div>
          </div>
          
          ${siteInfo.t && siteInfo.t.length > 0 ? `
            <div style="margin-top: 20px;">
              <div style="
                font-size: 13px;
                color: var(--color-text-secondary);
                margin-bottom: 12px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
              ">
                <span>🏷️</span>
                <span>Теги</span>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${siteInfo.t.map(tag => `
                  <span style="
                    background: rgba(var(--color-teal-500-rgb), 0.1);
                    color: var(--color-primary);
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                    font-weight: 500;
                    border: 1px solid rgba(var(--color-teal-500-rgb), 0.2);
                    transition: all 0.2s;
                  ">${tag}</span>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div style="
          background: var(--color-secondary);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          border: 1px solid var(--color-border);
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--color-text-secondary);
            font-size: 14px;
          ">
            <span style="color: var(--color-success);">✅</span>
            <span>Этот сайт проверен и находится в базе безопасных ресурсов</span>
          </div>
        </div>
        
        <div style="
          font-size: 12px;
          color: var(--color-text-secondary);
          text-align: center;
          padding: 12px;
          border-top: 1px solid var(--color-border);
          margin-top: 16px;
          opacity: 0.7;
        ">
          ID: ${domain.replace(/\./g, '-')}
        </div>
      `;
      
      // Сохраняем URL для кнопки открытия
      modalBody.querySelector = null;
      const urlElement = document.createElement('div');
      urlElement.id = 'modalSiteUrl';
      urlElement.style.display = 'none';
      urlElement.textContent = domain;
      modalBody.appendChild(urlElement);
    }

    this.openModal('siteDetailsModal');
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      setTimeout(() => {
        modal.classList.add('active');
      }, 10);
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    }
  }

  async checkCurrentSiteSafety() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].url) {
        const url = new URL(tabs[0].url);
        const domain = url.hostname.replace(/^www\./, '');
        
        chrome.runtime.sendMessage(
          { action: 'checkDomain', domain: domain },
          (response) => {
            if (response?.success) {
              const result = response.result;
              let message = '';
              
              if (result.safe === 'safe') {
                message = `✅ Сайт ${domain} безопасен`;
              } else {
                message = `❓ Сайт ${domain} не найден в базе данных`;
              }
              
              this.showNotification(message, result.safe === 'safe' ? 'success' : 'warning');
            }
          }
        );
      }
    } catch (error) {
      this.showNotification('Ошибка при проверке сайта', 'error');
    }
  }

  clearCache() {
    chrome.runtime.sendMessage(
      { action: 'clearCache' },
      (response) => {
        if (response?.success) {
          this.showNotification('Кэш очищен', 'success');
        }
      }
    );
  }

  exportDatabase() {
    const data = {
      version: '2.0.2',
      exportDate: new Date().toISOString(),
      description: 'База безопасных сайтов SafeWeb Pro',
      sites: this.allSitesData,
      stats: this.userStats
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `safeweb-pro-database-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    this.showNotification('База данных экспортирована', 'success');
  }

  exportStats() {
    const data = {
      version: '2.0.2',
      exportDate: new Date().toISOString(),
      description: 'Статистика SafeWeb Pro',
      stats: this.userStats,
      lastReset: this.userStats.lastReset
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `safeweb-pro-stats-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    
    this.showNotification('Статистика экспортирована', 'success');
  }

  exportUserSettings() {
    chrome.runtime.sendMessage(
      { action: 'exportUserSettings' },
      (response) => {
        if (response?.success) {
          const data = response.data;
          const json = JSON.stringify(data, null, 2);
          const blob = new Blob([json], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `safeweb-pro-settings-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          
          URL.revokeObjectURL(url);
          
          this.showNotification('Настройки экспортированы', 'success');
        } else {
          this.showNotification('Ошибка экспорта настроек', 'error');
        }
      }
    );
  }

  importUserSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target.result);
          chrome.runtime.sendMessage(
            { action: 'importUserSettings', data },
            (response) => {
              if (response?.success) {
                this.showNotification('Настройки импортированы. Перезагрузите страницу.', 'success');
                setTimeout(() => location.reload(), 1500);
              } else {
                this.showNotification('Ошибка импорта настроек', 'error');
              }
            }
          );
        } catch (error) {
          this.showNotification('Неверный формат файла', 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  refreshData() {
    this.loadDatabase();
    this.loadStats();
    this.showNotification('Данные обновлены', 'success');
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    
    if (this.isDarkMode) {
      this.enableDarkMode();
    } else {
      this.disableDarkMode();
    }
    
    // Сохраняем настройку
    const theme = this.isDarkMode ? 'dark' : 'light';
    this.updateSetting('theme', theme);
    this.applyTheme(theme);
    
    this.showNotification(
      this.isDarkMode ? 'Тёмная тема включена' : 'Светлая тема включена', 
      'info'
    );
  }

  enableDarkMode() {
    document.documentElement.setAttribute('data-color-scheme', 'dark');
    this.isDarkMode = true;
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.textContent = '☀️';
  }

  disableDarkMode() {
    document.documentElement.setAttribute('data-color-scheme', 'light');
    this.isDarkMode = false;
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.textContent = '🌙';
  }

  showResetStatsConfirm() {
    // Заполняем детали статистики
    document.getElementById('detailTotalChecks').textContent = this.userStats.totalVisits || 0;
    document.getElementById('detailSafeChecks').textContent = this.userStats.safeVisits || 0;
    document.getElementById('detailUnknownChecks').textContent = this.userStats.unknownVisits || 0;
    document.getElementById('detailLastReset').textContent = this.userStats.lastReset ? 
      new Date(this.userStats.lastReset).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'Никогда';
    
    // Отображаем популярные сайты
    this.displayPopularSites();
    
    this.openModal('statsDetailsModal');
  }

  displayPopularSites() {
    const container = document.getElementById('popularSitesList');
    if (!container) return;
    
    const sitesVisited = this.userStats.sitesVisited || {};
    const sortedSites = Object.entries(sitesVisited)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 5);
    
    if (sortedSites.length === 0) {
      container.innerHTML = `
        <div style="
          color: var(--color-text-secondary);
          text-align: center;
          padding: 24px;
          font-size: 13px;
          opacity: 0.7;
        ">
          Нет данных о посещениях
        </div>
      `;
      return;
    }
    
    container.innerHTML = sortedSites.map(([domain, stats], index) => {
      const isSafe = stats.lastStatus === 'safe';
      
      return `
        <div style="
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          margin-bottom: 8px;
          background: var(--color-surface);
          border-radius: 12px;
          border: 1px solid var(--color-border);
          transition: transform 0.2s;
        ">
          <div style="
            width: 32px;
            height: 32px;
            background: ${isSafe ? 'var(--color-success)' : 'var(--color-warning)'};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 14px;
            flex-shrink: 0;
          ">
            ${index + 1}
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="
              font-size: 13px;
              font-weight: 500;
              color: var(--color-text);
              margin-bottom: 2px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            ">${domain}</div>
            <div style="
              font-size: 11px;
              color: var(--color-text-secondary);
              display: flex;
              gap: 12px;
            ">
              <span>${stats.count} посещений</span>
              <span>${isSafe ? '✅ Безопасный' : '❓ Неизвестный'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async resetStats() {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'resetStats' },
        resolve
      );
    });
    
    await this.loadStats();
    this.displayAccountStats();
    this.closeModal('statsDetailsModal');
    this.showNotification('Статистика сброшена', 'success');
  }

  async restoreWarnings() {
    await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'restoreWarnings' },
        resolve
      );
    });
    
    await this.loadSettings();
    this.showNotification('Все предупреждения восстановлены', 'success');
  }

  async clearHiddenWarnings() {
    await this.updateSetting('hideWarnings', {});
    this.showNotification('Список скрытых предупреждений очищен', 'success');
  }

  showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.notification');
    oldNotifications.forEach(n => n.remove());
    
    // Определяем цвета
    const colors = {
      'error': '#ef4444',
      'success': '#10b981',
      'warning': '#f59e0b',
      'info': '#3b82f6'
    };
    
    const bgColor = colors[type] || colors.info;
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${bgColor};
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 320px;
      font-size: 14px;
      animation: notificationSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      white-space: pre-line;
      line-height: 1.5;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.1);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Добавляем иконку
    const icons = {
      'error': '❌',
      'success': '✅',
      'warning': '⚠️',
      'info': 'ℹ️'
    };
    
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 18px;">${icons[type] || icons.info}</span>
        <span style="flex: 1;">${message}</span>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Добавляем стили анимации
    const style = document.createElement('style');
    style.textContent = `
      @keyframes notificationSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes notificationSlideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Удаляем через 5 секунд
    setTimeout(() => {
      notification.style.animation = 'notificationSlideOut 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
      setTimeout(() => notification.remove(), 400);
    }, 5000);
  }
}

// Инициализируем при загрузке
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, creating SafeWebProPopup instance...');
  new SafeWebProPopup();
});