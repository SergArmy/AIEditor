import EditableBlock from '../base/editable-block.js';

/**
 * @element text-block
 * @description Текстовый блок с поддержкой форматирования
 * 
 * @attributes
 * @attr {string} variant - Вариант отображения (paragraph, note, important, warning)
 * @attr {string} alignment - Выравнивание текста (left, center, right, justify)
 * @attr {string} size - Размер текста (small, normal, large)
 * 
 * @example
 * <text-block variant="note" alignment="left">
 *   Это текстовый блок с заметкой
 * </text-block>
 */
class TextBlock extends EditableBlock {
  static get observedAttributes() {
    return [...super.observedAttributes, 'variant', 'alignment', 'size'];
  }

  constructor() {
    super();
    
    this._variant = 'paragraph'; // paragraph, note, important, warning
    this._alignment = 'left'; // left, center, right, justify
    this._size = 'normal'; // small, normal, large
    
    // Установка placeholder по умолчанию
    this._placeholder = 'Введите текст...';
  }

  /**
   * Стили для текстового блока
   */
  getBaseStyles() {
    return `
      ${super.getBaseStyles()}

      :host {
        --text-color: var(--text-primary, #1f2937);
        --bg-color: transparent;
        --border-left-color: transparent;
        --border-left-width: 0;
      }

      /* Варианты блока */
      :host([variant="note"]) {
        --bg-color: var(--note-bg, #eff6ff);
        --border-left-color: var(--note-border, #3b82f6);
        --border-left-width: 4px;
      }

      :host([variant="important"]) {
        --bg-color: var(--important-bg, #fef3c7);
        --border-left-color: var(--important-border, #f59e0b);
        --border-left-width: 4px;
      }

      :host([variant="warning"]) {
        --bg-color: var(--warning-bg, #fee2e2);
        --border-left-color: var(--warning-border, #ef4444);
        --border-left-width: 4px;
      }

      .block-container {
        background-color: var(--bg-color);
        border-left: var(--border-left-width) solid var(--border-left-color);
        padding-left: calc(12px + var(--border-left-width));
      }

      .editable-content {
        color: var(--text-color);
        line-height: 1.7;
        font-size: var(--text-size, 1rem);
      }

      /* Выравнивание */
      :host([alignment="left"]) .editable-content {
        text-align: left;
      }

      :host([alignment="center"]) .editable-content {
        text-align: center;
      }

      :host([alignment="right"]) .editable-content {
        text-align: right;
      }

      :host([alignment="justify"]) .editable-content {
        text-align: justify;
      }

      /* Размеры текста */
      :host([size="small"]) .editable-content {
        --text-size: 0.875rem;
      }

      :host([size="normal"]) .editable-content {
        --text-size: 1rem;
      }

      :host([size="large"]) .editable-content {
        --text-size: 1.125rem;
      }

      /* Иконка варианта */
      .variant-icon {
        position: absolute;
        left: 8px;
        top: 12px;
        font-size: 1.25rem;
        opacity: 0.6;
      }

      :host([variant="note"]) .variant-icon::before {
        content: 'ℹ️';
      }

      :host([variant="important"]) .variant-icon::before {
        content: '⚠️';
      }

      :host([variant="warning"]) .variant-icon::before {
        content: '🚨';
      }

      /* Toolbar для форматирования */
      .format-toolbar {
        position: absolute;
        top: -40px;
        left: 50%;
        transform: translateX(-50%);
        display: none;
        background: var(--toolbar-bg, #ffffff);
        border: 1px solid var(--toolbar-border, #e5e7eb);
        border-radius: 6px;
        padding: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        gap: 2px;
      }

      :host([editable]) .format-toolbar {
        display: flex;
      }

      .format-btn {
        padding: 6px 10px;
        border: none;
        background: transparent;
        cursor: pointer;
        border-radius: 4px;
        font-size: 0.875rem;
        color: var(--text-secondary, #6b7280);
        transition: all 0.2s;
      }

      .format-btn:hover {
        background: var(--hover-bg, #f3f4f6);
        color: var(--text-primary, #1f2937);
      }

      .format-btn.active {
        background: var(--active-bg, #dbeafe);
        color: var(--accent-color, #3b82f6);
      }
    `;
  }

  /**
   * Lifecycle: атрибут изменён
   */
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);

    switch (name) {
      case 'variant':
        this._variant = newValue || 'paragraph';
        break;
      case 'alignment':
        this._alignment = newValue || 'left';
        break;
      case 'size':
        this._size = newValue || 'normal';
        break;
    }
  }

  /**
   * Рендеринг содержимого блока
   */
  render() {
    const container = this.shadowRoot.querySelector('.block-container');
    if (!container) return;

    const contentEditable = this._editable ? 'true' : 'false';
    const showIcon = this._variant !== 'paragraph';
    
    container.innerHTML = `
      ${showIcon ? '<span class="variant-icon"></span>' : ''}
      <div class="block-content">
        ${this._editable ? this.renderFormatToolbar() : ''}
        <div 
          class="editable-content" 
          contenteditable="${contentEditable}"
          data-placeholder="${this._placeholder}"
          role="textbox"
          aria-multiline="true"
        >
          <slot></slot>
        </div>
      </div>
    `;

    this.setupContentElement();
    this.setupFormatToolbar();
  }

  /**
   * Рендеринг панели форматирования
   */
  renderFormatToolbar() {
    return `
      <div class="format-toolbar" role="toolbar">
        <button class="format-btn" data-command="bold" title="Жирный (Ctrl+B)">
          <strong>B</strong>
        </button>
        <button class="format-btn" data-command="italic" title="Курсив (Ctrl+I)">
          <em>I</em>
        </button>
        <button class="format-btn" data-command="underline" title="Подчёркнутый (Ctrl+U)">
          <u>U</u>
        </button>
        <button class="format-btn" data-command="strikeThrough" title="Зачёркнутый">
          <s>S</s>
        </button>
        <span style="width: 1px; height: 20px; background: #e5e7eb; margin: 0 4px;"></span>
        <button class="format-btn" data-command="insertUnorderedList" title="Маркированный список">
          ☰
        </button>
        <button class="format-btn" data-command="insertOrderedList" title="Нумерованный список">
          ≡
        </button>
      </div>
    `;
  }

  /**
   * Настройка панели форматирования
   */
  setupFormatToolbar() {
    const toolbar = this.shadowRoot.querySelector('.format-toolbar');
    if (!toolbar) return;

    const buttons = toolbar.querySelectorAll('.format-btn');
    buttons.forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Предотвращаем потерю фокуса
        const command = btn.getAttribute('data-command');
        this.applyFormat(command);
        this.updateToolbarState();
      });
    });

    // Обновление состояния кнопок при изменении выделения
    if (this._contentElement) {
      this._contentElement.addEventListener('mouseup', () => this.updateToolbarState());
      this._contentElement.addEventListener('keyup', () => this.updateToolbarState());
    }
  }

  /**
   * Обновление состояния кнопок форматирования
   */
  updateToolbarState() {
    const toolbar = this.shadowRoot.querySelector('.format-toolbar');
    if (!toolbar) return;

    const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList'];
    
    commands.forEach(command => {
      const btn = toolbar.querySelector(`[data-command="${command}"]`);
      if (btn) {
        const isActive = document.queryCommandState(command);
        btn.classList.toggle('active', isActive);
      }
    });
  }

  /**
   * Установить вариант блока
   */
  setVariant(variant) {
    this.setAttribute('variant', variant);
  }

  /**
   * Установить выравнивание
   */
  setAlignment(alignment) {
    this.setAttribute('alignment', alignment);
  }

  /**
   * Установить размер текста
   */
  setSize(size) {
    this.setAttribute('size', size);
  }

  /**
   * Сериализация с дополнительными атрибутами
   */
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      variant: this._variant,
      alignment: this._alignment,
      size: this._size
    };
  }

  /**
   * Десериализация с дополнительными атрибутами
   */
  deserialize(data) {
    super.deserialize(data);
    
    if (data.variant) this.setVariant(data.variant);
    if (data.alignment) this.setAlignment(data.alignment);
    if (data.size) this.setSize(data.size);
  }

  /**
   * Геттеры
   */
  get variant() {
    return this._variant;
  }

  get alignment() {
    return this._alignment;
  }

  get size() {
    return this._size;
  }
}

// Регистрация элемента
customElements.define('text-block', TextBlock);

// Экспорт
export default TextBlock;

