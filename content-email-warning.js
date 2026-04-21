/**
 * SafeWeb Pro - Предупреждение для почтовых сервисов
 */

class EmailWarning {
  constructor() {
    this.userSettings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    
    if (!this.userSettings.showEmailWarnings) {
      return;
    }
    
    this.setupObserver();
    this.checkCurrentPage();
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

  checkCurrentPage() {
    // Проверяем, находимся ли мы на почтовом сервисе
    const isMailService = window.location.hostname.includes('mail.') ||
                         window.location.hostname.includes('gmail') ||
                         window.location.hostname.includes('mail.ru');
    
    if (isMailService) {
      setTimeout(() => {
        this.showEmailWarning();
      }, 3000); // Показываем через 3 секунды после загрузки
    }
  }

  showEmailWarning() {
    // Проверяем, не показывали ли уже сегодня
    const lastShown = localStorage.getItem('safeweb_email_warning_last_shown');
    const today = new Date().toDateString();
    
    if (lastShown === today) {
      return;
    }
    
    const warning = document.createElement('div');
    warning.id = 'safeweb-email-warning';
    warning.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%);
        color: white;
        padding: 20px;
        border-radius: 12px;
        z-index: 999999;
        max-width: 400px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        animation: slideIn 0.5s ease;
      ">
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
          <div style="font-size: 24px; color: #60a5fa;">🛡️</div>
          <div>
            <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">Безопасность почты</h4>
            <p style="margin: 0; font-size: 13px; line-height: 1.4; opacity: 0.9;">
              ⚠️ <strong>Внимание:</strong> Будьте осторожны с ссылками в письмах, особенно если они:
              <br>• Требуют срочных действий
              <br>• Просят личные данные
              <br>• Выглядят подозрительно
              <br>• Содержат странные адреса
            </p>
          </div>
        </div>
        
        <div style="
          background: rgba(255,255,255,0.1);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 12px;
        ">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="color: #10b981;">✅</span>
            <span>Проверяйте отправителя</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="color: #10b981;">✅</span>
            <span>Не вводите пароли по ссылкам из писем</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #10b981;">✅</span>
            <span>SafeWeb Pro подсветит подозрительные ссылки</span>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <label style="display: flex; align-items: center; gap: 8px; color: #dbeafe; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="safeweb-hide-email-warning" style="cursor: pointer;">
            Не показывать больше
          </label>
          <button id="safeweb-close-email-warning" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 8px 16px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s;
          ">
            Понятно
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(warning);
    
    // Кнопка закрытия
    document.getElementById('safeweb-close-email-warning').addEventListener('click', () => {
      const hideCheckbox = document.getElementById('safeweb-hide-email-warning');
      
      if (hideCheckbox && hideCheckbox.checked) {
        chrome.runtime.sendMessage({
          action: 'updateSettings',
          settings: { showEmailWarnings: false }
        });
      }
      
      localStorage.setItem('safeweb_email_warning_last_shown', today);
      warning.style.animation = 'slideOut 0.5s ease';
      setTimeout(() => warning.remove(), 500);
    });
    
    // Автоматическое скрытие через 30 секунд
    setTimeout(() => {
      if (document.getElementById('safeweb-email-warning')) {
        warning.style.animation = 'slideOut 0.5s ease';
        setTimeout(() => warning.remove(), 500);
      }
    }, 30000);
    
    // Добавляем стили анимации
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
      #safeweb-email-warning button:hover {
        background: rgba(255,255,255,0.3);
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }

  setupObserver() {
    // Отслеживаем изменения в контенте почты
    const observer = new MutationObserver(() => {
      // Здесь можно добавить дополнительную логику для проверки писем
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Запускаем на почтовых сервисах
new EmailWarning();