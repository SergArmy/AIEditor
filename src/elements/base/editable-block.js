import BaseBlock from './base-block.js';

/**
 * @element editable-block
 * @description Базовый класс для блоков с редактируемым содержимым
 * 
 * @attributes
 * @attr {string} placeholder - Текст-заполнитель для пустого блока
 * @attr {boolean} multiline - Поддержка многострочного ввода
 * @attr {string} format - Формат содержимого (plain, html, markdown)
 * 
 * @methods
 * @method getContent() => string - Получение содержимого
 * @method setContent(content) - Установка содержимого
 * @method clearContent() - Очистка содержимого
 * @method isEmpty() => boolean - Проверка на пустоту
 * 
 * @events
 * @event editor-content-changed - Содержимое изменено
 * @event editor-content-focused - Содержимое получило фокус
 * @event editor-content-blurred - Содержимое потеряло фокус
 */
class EditableBlock extends BaseBlock {
  static get observedAttributes() {
    return [...super.observedAttributes, 'placeholder', 'multiline', 'format'];
  }

  constructor() {
    super();
    
    this._placeholder = '';
    this._multiline = true;
    this._format = 'plain'; // plain, html, markdown
    this._contentElement = null;
    this._isComposing = false; // Для обработки IME ввода
  }

  /**
   * Расширение базовых стилей
   */
  getBaseStyles() {
    return `
      ${super.getBaseStyles()}

      .editable-content {
        position: relative;
        min-height: 1.5em;
        outline: none;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .editable-content:empty:before {
        content: attr(data-placeholder);
        color: var(--placeholder-color, #9ca3af);
        pointer-events: none;
      }

      .editable-content:focus {
        outline: none;
      }

      :host([editable]) .editable-content {
        cursor: text;
      }

      :host(:not([editable])) .editable-content {
        cursor: default;
      }

      .editable-content[contenteditable="true"] {
        background-color: var(--editable-bg, transparent);
      }

      /* Стили для форматирования */
      .editable-content b,
      .editable-content strong {
        font-weight: 600;
      }

      .editable-content i,
      .editable-content em {
        font-style: italic;
      }

      .editable-content u {
        text-decoration: underline;
      }

      .editable-content code {
        font-family: 'Courier New', monospace;
        background-color: var(--code-bg, #f3f4f6);
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 0.9em;
      }
    `;
  }

  /**
   * Lifecycle: элемент добавлен в DOM
   */
  connectedCallback() {
    super.connectedCallback();
    this.setupContentElement();
  }

  /**
   * Lifecycle: атрибут изменён
   */
  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);

    switch (name) {
      case 'placeholder':
        this._placeholder = newValue || '';
        this.updatePlaceholder();
        break;
      case 'multiline':
        this._multiline = newValue !== null;
        break;
      case 'format':
        this._format = newValue || 'plain';
        break;
    }
  }

  /**
   * Настройка элемента содержимого
   */
  setupContentElement() {
    this._contentElement = this.shadowRoot.querySelector('.editable-content');
    
    if (this._contentElement) {
      // Обработчики событий для редактирования
      this._contentElement.addEventListener('input', this.handleInput.bind(this));
      this._contentElement.addEventListener('paste', this.handlePaste.bind(this));
      this._contentElement.addEventListener('keydown', this.handleContentKeyDown.bind(this));
      this._contentElement.addEventListener('focus', this.handleContentFocus.bind(this));
      this._contentElement.addEventListener('blur', this.handleContentBlur.bind(this));
      this._contentElement.addEventListener('compositionstart', this.handleCompositionStart.bind(this));
      this._contentElement.addEventListener('compositionend', this.handleCompositionEnd.bind(this));
    }
  }

  /**
   * Рендеринг содержимого блока
   */
  render() {
    const container = this.shadowRoot.querySelector('.block-container');
    if (!container) return;

    const contentEditable = this._editable ? 'true' : 'false';
    
    container.innerHTML = `
      <div class="block-content">
        <div 
          class="editable-content" 
          contenteditable="${contentEditable}"
          data-placeholder="${this._placeholder}"
          role="textbox"
          aria-multiline="${this._multiline}"
        >
          <slot></slot>
        </div>
      </div>
    `;

    this.setupContentElement();
  }

  /**
   * Обработка изменения режима редактирования
   */
  handleEditableChange() {
    super.handleEditableChange();
    
    if (this._contentElement) {
      this._contentElement.contentEditable = this._editable;
      
      if (this._editable) {
        // Установить фокус на содержимое при входе в режим редактирования
        setTimeout(() => {
          this._contentElement.focus();
          this.moveCursorToEnd();
        }, 0);
      }
    }
  }

  /**
   * Обработка ввода текста
   */
  handleInput(event) {
    if (this._isComposing) return;

    this.dispatchContentChangedEvent();
  }

  /**
   * Обработка вставки содержимого
   */
  handlePaste(event) {
    event.preventDefault();

    const text = event.clipboardData.getData('text/plain');
    
    if (this._format === 'plain') {
      // Вставка только текста без форматирования
      document.execCommand('insertText', false, text);
    } else {
      // Вставка с сохранением форматирования
      const html = event.clipboardData.getData('text/html');
      if (html) {
        document.execCommand('insertHTML', false, this.sanitizeHTML(html));
      } else {
        document.execCommand('insertText', false, text);
      }
    }

    this.dispatchContentChangedEvent();
  }

  /**
   * Обработка нажатий клавиш в содержимом
   */
  handleContentKeyDown(event) {
    // Enter в однострочном режиме
    if (event.key === 'Enter' && !this._multiline) {
      event.preventDefault();
      this.setEditable(false);
      return;
    }

    // Escape - выход из режима редактирования
    if (event.key === 'Escape') {
      event.preventDefault();
      this.setEditable(false);
      this.focus();
      return;
    }

    // Tab - переход к следующему блоку
    if (event.key === 'Tab') {
      event.preventDefault();
      this.setEditable(false);
      
      if (event.shiftKey) {
        this.focusPreviousBlock();
      } else {
        this.focusNextBlock();
      }
      return;
    }
  }

  /**
   * Обработка получения фокуса содержимым
   */
  handleContentFocus() {
    this.dispatchEvent(new CustomEvent('editor-content-focused', {
      bubbles: true,
      composed: true,
      detail: { blockId: this._blockId }
    }));
  }

  /**
   * Обработка потери фокуса содержимым
   */
  handleContentBlur() {
    this.dispatchEvent(new CustomEvent('editor-content-blurred', {
      bubbles: true,
      composed: true,
      detail: { blockId: this._blockId }
    }));
  }

  /**
   * Начало композиции (IME ввод)
   */
  handleCompositionStart() {
    this._isComposing = true;
  }

  /**
   * Конец композиции (IME ввод)
   */
  handleCompositionEnd() {
    this._isComposing = false;
    this.dispatchContentChangedEvent();
  }

  /**
   * Отправка события изменения содержимого
   */
  dispatchContentChangedEvent() {
    this.dispatchEvent(new CustomEvent('editor-content-changed', {
      bubbles: true,
      composed: true,
      detail: {
        blockId: this._blockId,
        content: this.getContent()
      }
    }));
  }

  /**
   * Обновление placeholder
   */
  updatePlaceholder() {
    if (this._contentElement) {
      this._contentElement.setAttribute('data-placeholder', this._placeholder);
    }
  }

  /**
   * Перемещение курсора в конец
   */
  moveCursorToEnd() {
    if (!this._contentElement) return;

    const range = document.createRange();
    const selection = window.getSelection();
    
    range.selectNodeContents(this._contentElement);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  /**
   * Фокус на предыдущем блоке
   */
  focusPreviousBlock() {
    const prevBlock = this.previousElementSibling;
    if (prevBlock && prevBlock.focus) {
      prevBlock.focus();
    }
  }

  /**
   * Фокус на следующем блоке
   */
  focusNextBlock() {
    const nextBlock = this.nextElementSibling;
    if (nextBlock && nextBlock.focus) {
      nextBlock.focus();
    }
  }

  /**
   * Очистка HTML от опасных тегов
   */
  sanitizeHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Удаление скриптов и опасных атрибутов
    const scripts = div.querySelectorAll('script');
    scripts.forEach(script => script.remove());
    
    const allElements = div.querySelectorAll('*');
    allElements.forEach(el => {
      // Удаление обработчиков событий
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return div.innerHTML;
  }

  /**
   * Получить содержимое блока
   */
  getContent() {
    if (!this._contentElement) return '';

    if (this._format === 'html') {
      return this._contentElement.innerHTML;
    } else {
      return this._contentElement.textContent || '';
    }
  }

  /**
   * Установить содержимое блока
   */
  setContent(content) {
    if (!this._contentElement) {
      // Если элемент ещё не создан, сохраняем в textContent
      this.textContent = content;
      return;
    }

    if (this._format === 'html') {
      this._contentElement.innerHTML = this.sanitizeHTML(content);
    } else {
      this._contentElement.textContent = content;
    }
  }

  /**
   * Очистить содержимое
   */
  clearContent() {
    if (this._contentElement) {
      this._contentElement.textContent = '';
    }
    this.dispatchContentChangedEvent();
  }

  /**
   * Проверка на пустоту
   */
  isEmpty() {
    const content = this.getContent();
    return !content || content.trim().length === 0;
  }

  /**
   * Применить форматирование
   */
  applyFormat(command, value = null) {
    if (!this._editable || !this._contentElement) return;

    document.execCommand(command, false, value);
    this._contentElement.focus();
    this.dispatchContentChangedEvent();
  }

  /**
   * Геттеры
   */
  get placeholder() {
    return this._placeholder;
  }

  get multiline() {
    return this._multiline;
  }

  get format() {
    return this._format;
  }
}

// Регистрация элемента
customElements.define('editable-block', EditableBlock);

// Экспорт
export default EditableBlock;

