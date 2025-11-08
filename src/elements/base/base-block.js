/**
 * @element base-block
 * @description Базовый класс для всех блоков редактора
 * 
 * @attributes
 * @attr {string} block-id - Уникальный идентификатор блока
 * @attr {boolean} selected - Блок выделен
 * @attr {boolean} editable - Блок в режиме редактирования
 * @attr {boolean} collapsed - Блок свёрнут
 * 
 * @methods
 * @method serialize() => object - Сериализация данных блока
 * @method deserialize(data) - Восстановление блока из данных
 * @method getContent() => any - Получение содержимого блока
 * @method setContent(content) - Установка содержимого блока
 * @method focus() - Установка фокуса на блок
 * 
 * @events
 * @event editor-block-selected - Блок выделен
 * @event editor-block-changed - Содержимое блока изменено
 * @event editor-block-deleted - Блок удалён
 */
class BaseBlock extends HTMLElement {
  static get observedAttributes() {
    return ['block-id', 'selected', 'editable', 'collapsed'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // Генерация уникального ID, если не задан
    this._blockId = this.getAttribute('block-id') || this.generateId();
    this._selected = false;
    this._editable = false;
    this._collapsed = false;
    
    // Инициализация Shadow DOM
    this.initializeShadowDOM();
  }

  /**
   * Генерация уникального идентификатора блока
   * @returns {string} Уникальный ID
   */
  generateId() {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Инициализация Shadow DOM с базовыми стилями
   */
  initializeShadowDOM() {
    const style = document.createElement('style');
    style.textContent = this.getBaseStyles();
    this.shadowRoot.appendChild(style);
    
    const container = document.createElement('div');
    container.className = 'block-container';
    this.shadowRoot.appendChild(container);
  }

  /**
   * Базовые стили для всех блоков
   * @returns {string} CSS стили
   */
  getBaseStyles() {
    return `
      :host {
        display: block;
        position: relative;
        margin: var(--block-margin, 8px 0);
        padding: var(--block-padding, 12px);
        border: 1px solid var(--block-border-color, transparent);
        border-radius: var(--block-border-radius, 4px);
        transition: all 0.2s ease;
        outline: none;
      }

      :host([selected]) {
        border-color: var(--accent-color, #3b82f6);
        background-color: var(--selected-bg, rgba(59, 130, 246, 0.05));
      }

      :host([collapsed]) .block-content {
        display: none;
      }

      :host(:hover) {
        border-color: var(--block-hover-border, #e5e7eb);
      }

      .block-container {
        position: relative;
        width: 100%;
      }

      .block-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
      }

      .block-content {
        position: relative;
      }

      .block-actions {
        position: absolute;
        top: 4px;
        right: 4px;
        display: none;
        gap: 4px;
      }

      :host(:hover) .block-actions {
        display: flex;
      }
    `;
  }

  /**
   * Lifecycle: элемент добавлен в DOM
   */
  connectedCallback() {
    this.setAttribute('tabindex', '0');
    this.setAttribute('role', 'article');
    
    // Обработчики событий
    this.addEventListener('click', this.handleClick.bind(this));
    this.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.addEventListener('focus', this.handleFocus.bind(this));
    this.addEventListener('blur', this.handleBlur.bind(this));
    
    this.render();
  }

  /**
   * Lifecycle: элемент удалён из DOM
   */
  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
    this.removeEventListener('keydown', this.handleKeyDown);
    this.removeEventListener('focus', this.handleFocus);
    this.removeEventListener('blur', this.handleBlur);
  }

  /**
   * Lifecycle: атрибут изменён
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'block-id':
        this._blockId = newValue;
        break;
      case 'selected':
        this._selected = newValue !== null;
        this.handleSelectionChange();
        break;
      case 'editable':
        this._editable = newValue !== null;
        this.handleEditableChange();
        break;
      case 'collapsed':
        this._collapsed = newValue !== null;
        this.render();
        break;
    }
  }

  /**
   * Рендеринг содержимого блока
   * Переопределяется в дочерних классах
   */
  render() {
    const container = this.shadowRoot.querySelector('.block-container');
    if (!container) return;

    container.innerHTML = `
      <div class="block-content">
        <slot></slot>
      </div>
    `;
  }

  /**
   * Обработка клика по блоку
   */
  handleClick(event) {
    if (!this._selected) {
      this.select();
    }
  }

  /**
   * Обработка нажатий клавиш
   */
  handleKeyDown(event) {
    switch (event.key) {
      case 'Delete':
      case 'Backspace':
        if (this._selected && !this._editable) {
          event.preventDefault();
          this.delete();
        }
        break;
      case 'Enter':
        if (this._selected && !this._editable) {
          event.preventDefault();
          this.setEditable(true);
        }
        break;
      case 'Escape':
        if (this._editable) {
          event.preventDefault();
          this.setEditable(false);
        }
        break;
    }
  }

  /**
   * Обработка получения фокуса
   */
  handleFocus() {
    if (!this._selected) {
      this.select();
    }
  }

  /**
   * Обработка потери фокуса
   */
  handleBlur() {
    // Можно добавить логику при потере фокуса
  }

  /**
   * Обработка изменения состояния выделения
   */
  handleSelectionChange() {
    if (this._selected) {
      this.dispatchEvent(new CustomEvent('editor-block-selected', {
        bubbles: true,
        composed: true,
        detail: { blockId: this._blockId }
      }));
    }
  }

  /**
   * Обработка изменения режима редактирования
   */
  handleEditableChange() {
    this.render();
  }

  /**
   * Выделить блок
   */
  select() {
    this.setAttribute('selected', '');
  }

  /**
   * Снять выделение с блока
   */
  deselect() {
    this.removeAttribute('selected');
  }

  /**
   * Установить режим редактирования
   */
  setEditable(editable) {
    if (editable) {
      this.setAttribute('editable', '');
    } else {
      this.removeAttribute('editable');
    }
  }

  /**
   * Свернуть/развернуть блок
   */
  toggleCollapse() {
    if (this._collapsed) {
      this.removeAttribute('collapsed');
    } else {
      this.setAttribute('collapsed', '');
    }
  }

  /**
   * Удалить блок
   */
  delete() {
    this.dispatchEvent(new CustomEvent('editor-block-deleted', {
      bubbles: true,
      composed: true,
      detail: { blockId: this._blockId }
    }));
    this.remove();
  }

  /**
   * Установить фокус на блок
   */
  focus() {
    super.focus();
  }

  /**
   * Получить содержимое блока
   * Переопределяется в дочерних классах
   */
  getContent() {
    return this.textContent;
  }

  /**
   * Установить содержимое блока
   * Переопределяется в дочерних классах
   */
  setContent(content) {
    this.textContent = content;
  }

  /**
   * Получить атрибуты блока для сериализации
   */
  getAttributes() {
    return {
      blockId: this._blockId,
      selected: this._selected,
      editable: this._editable,
      collapsed: this._collapsed
    };
  }

  /**
   * Сериализация блока в объект
   */
  serialize() {
    return {
      id: this._blockId,
      type: this.tagName.toLowerCase(),
      content: this.getContent(),
      attributes: this.getAttributes(),
      timestamp: Date.now()
    };
  }

  /**
   * Десериализация блока из объекта
   */
  deserialize(data) {
    if (data.id) {
      this._blockId = data.id;
      this.setAttribute('block-id', data.id);
    }
    
    if (data.content !== undefined) {
      this.setContent(data.content);
    }
    
    if (data.attributes) {
      const attrs = data.attributes;
      if (attrs.selected) this.select();
      if (attrs.editable) this.setEditable(true);
      if (attrs.collapsed) this.toggleCollapse();
    }
    
    this.render();
  }

  /**
   * Геттеры для свойств
   */
  get blockId() {
    return this._blockId;
  }

  get selected() {
    return this._selected;
  }

  get editable() {
    return this._editable;
  }

  get collapsed() {
    return this._collapsed;
  }
}

// Регистрация элемента
customElements.define('base-block', BaseBlock);

// Экспорт для использования в других модулях
export default BaseBlock;

