/**
 * DocumentStore - Управление состоянием документа
 * 
 * Использует паттерн Observable для управления состоянием без внешних зависимостей.
 * В будущем можно заменить на Zustand, если потребуется более сложное управление состоянием.
 * 
 * @module DocumentStore
 */

class DocumentStore {
  constructor() {
    // Singleton pattern
    if (DocumentStore.instance) {
      return DocumentStore.instance;
    }
    DocumentStore.instance = this;

    // Состояние документа
    this.state = {
      // Метаданные документа
      documentId: this.generateDocumentId(),
      title: 'Untitled Document',
      version: '1.0.0',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      
      // Блоки документа
      blocks: new Map(), // blockId -> block data
      blockOrder: [], // Порядок блоков
      
      // Выделение и фокус
      selectedBlocks: new Set(),
      focusedBlock: null,
      
      // История изменений (для Undo/Redo)
      history: [],
      historyIndex: -1,
      maxHistorySize: 50,
      
      // Режимы
      editMode: false,
      readOnly: false,
      
      // Метаданные для 1С
      metadata: {
        configuration: null,
        subsystem: null,
        author: null,
        tags: []
      }
    };

    // Подписчики на изменения
    this.subscribers = new Set();
    
    // Debounce для автосохранения
    this.autoSaveTimeout = null;
    this.autoSaveDelay = 2000; // 2 секунды
  }

  /**
   * Генерация ID документа
   */
  generateDocumentId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Подписка на изменения состояния
   * @param {Function} callback - Функция обратного вызова
   * @returns {Function} Функция отписки
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    
    // Возвращаем функцию для отписки
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Уведомление подписчиков об изменениях
   */
  notify(changes = {}) {
    this.state.updatedAt = Date.now();
    
    this.subscribers.forEach(callback => {
      try {
        callback(this.state, changes);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });

    // Автосохранение
    this.scheduleAutoSave();
  }

  /**
   * Получение текущего состояния
   */
  getState() {
    return { ...this.state };
  }

  // ==================== Управление блоками ====================

  /**
   * Добавление блока
   * @param {Object} blockData - Данные блока
   * @param {number} position - Позиция вставки (по умолчанию в конец)
   */
  addBlock(blockData, position = null) {
    const blockId = blockData.id || `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const block = {
      id: blockId,
      type: blockData.type || 'text-block',
      content: blockData.content || '',
      attributes: blockData.attributes || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...blockData
    };

    this.state.blocks.set(blockId, block);
    
    if (position !== null && position >= 0 && position <= this.state.blockOrder.length) {
      this.state.blockOrder.splice(position, 0, blockId);
    } else {
      this.state.blockOrder.push(blockId);
    }

    this.saveToHistory('add-block', { blockId, block });
    this.notify({ type: 'block-added', blockId, block });
    
    return blockId;
  }

  /**
   * Удаление блока
   * @param {string} blockId - ID блока
   */
  removeBlock(blockId) {
    const block = this.state.blocks.get(blockId);
    if (!block) return false;

    this.state.blocks.delete(blockId);
    this.state.blockOrder = this.state.blockOrder.filter(id => id !== blockId);
    this.state.selectedBlocks.delete(blockId);
    
    if (this.state.focusedBlock === blockId) {
      this.state.focusedBlock = null;
    }

    this.saveToHistory('remove-block', { blockId, block });
    this.notify({ type: 'block-removed', blockId });
    
    return true;
  }

  /**
   * Обновление блока
   * @param {string} blockId - ID блока
   * @param {Object} updates - Обновления
   */
  updateBlock(blockId, updates) {
    const block = this.state.blocks.get(blockId);
    if (!block) return false;

    const oldBlock = { ...block };
    const updatedBlock = {
      ...block,
      ...updates,
      updatedAt: Date.now()
    };

    this.state.blocks.set(blockId, updatedBlock);
    
    this.saveToHistory('update-block', { blockId, oldBlock, newBlock: updatedBlock });
    this.notify({ type: 'block-updated', blockId, updates });
    
    return true;
  }

  /**
   * Получение блока
   * @param {string} blockId - ID блока
   */
  getBlock(blockId) {
    return this.state.blocks.get(blockId);
  }

  /**
   * Получение всех блоков в порядке
   */
  getBlocks() {
    return this.state.blockOrder.map(id => this.state.blocks.get(id)).filter(Boolean);
  }

  /**
   * Перемещение блока
   * @param {string} blockId - ID блока
   * @param {number} newPosition - Новая позиция
   */
  moveBlock(blockId, newPosition) {
    const currentIndex = this.state.blockOrder.indexOf(blockId);
    if (currentIndex === -1) return false;

    this.state.blockOrder.splice(currentIndex, 1);
    this.state.blockOrder.splice(newPosition, 0, blockId);

    this.saveToHistory('move-block', { blockId, from: currentIndex, to: newPosition });
    this.notify({ type: 'block-moved', blockId, from: currentIndex, to: newPosition });
    
    return true;
  }

  // ==================== Выделение ====================

  /**
   * Выделение блока
   * @param {string} blockId - ID блока
   * @param {boolean} multiSelect - Множественное выделение
   */
  selectBlock(blockId, multiSelect = false) {
    if (!multiSelect) {
      this.state.selectedBlocks.clear();
    }
    
    this.state.selectedBlocks.add(blockId);
    this.notify({ type: 'selection-changed', selectedBlocks: Array.from(this.state.selectedBlocks) });
  }

  /**
   * Снятие выделения с блока
   * @param {string} blockId - ID блока
   */
  deselectBlock(blockId) {
    this.state.selectedBlocks.delete(blockId);
    this.notify({ type: 'selection-changed', selectedBlocks: Array.from(this.state.selectedBlocks) });
  }

  /**
   * Очистка выделения
   */
  clearSelection() {
    this.state.selectedBlocks.clear();
    this.notify({ type: 'selection-changed', selectedBlocks: [] });
  }

  /**
   * Получение выделенных блоков
   */
  getSelectedBlocks() {
    return Array.from(this.state.selectedBlocks);
  }

  /**
   * Установка фокуса на блок
   * @param {string} blockId - ID блока
   */
  focusBlock(blockId) {
    this.state.focusedBlock = blockId;
    this.notify({ type: 'focus-changed', focusedBlock: blockId });
  }

  // ==================== История (Undo/Redo) ====================

  /**
   * Сохранение действия в историю
   * @param {string} action - Тип действия
   * @param {Object} data - Данные действия
   */
  saveToHistory(action, data) {
    // Удаляем все действия после текущего индекса
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
    
    // Добавляем новое действие
    this.state.history.push({
      action,
      data,
      timestamp: Date.now()
    });

    // Ограничиваем размер истории
    if (this.state.history.length > this.state.maxHistorySize) {
      this.state.history.shift();
    } else {
      this.state.historyIndex++;
    }
  }

  /**
   * Отмена последнего действия
   */
  undo() {
    if (this.state.historyIndex < 0) return false;

    const historyItem = this.state.history[this.state.historyIndex];
    this.applyHistoryItem(historyItem, true);
    
    this.state.historyIndex--;
    this.notify({ type: 'undo', historyItem });
    
    return true;
  }

  /**
   * Повтор отменённого действия
   */
  redo() {
    if (this.state.historyIndex >= this.state.history.length - 1) return false;

    this.state.historyIndex++;
    const historyItem = this.state.history[this.state.historyIndex];
    this.applyHistoryItem(historyItem, false);
    
    this.notify({ type: 'redo', historyItem });
    
    return true;
  }

  /**
   * Применение элемента истории
   * @param {Object} historyItem - Элемент истории
   * @param {boolean} reverse - Обратное применение (для undo)
   */
  applyHistoryItem(historyItem, reverse) {
    const { action, data } = historyItem;

    switch (action) {
      case 'add-block':
        if (reverse) {
          this.state.blocks.delete(data.blockId);
          this.state.blockOrder = this.state.blockOrder.filter(id => id !== data.blockId);
        } else {
          this.state.blocks.set(data.blockId, data.block);
          this.state.blockOrder.push(data.blockId);
        }
        break;

      case 'remove-block':
        if (reverse) {
          this.state.blocks.set(data.blockId, data.block);
          this.state.blockOrder.push(data.blockId);
        } else {
          this.state.blocks.delete(data.blockId);
          this.state.blockOrder = this.state.blockOrder.filter(id => id !== data.blockId);
        }
        break;

      case 'update-block':
        if (reverse) {
          this.state.blocks.set(data.blockId, data.oldBlock);
        } else {
          this.state.blocks.set(data.blockId, data.newBlock);
        }
        break;

      case 'move-block':
        const { blockId, from, to } = data;
        const currentIndex = this.state.blockOrder.indexOf(blockId);
        this.state.blockOrder.splice(currentIndex, 1);
        this.state.blockOrder.splice(reverse ? from : to, 0, blockId);
        break;
    }
  }

  // ==================== Сериализация ====================

  /**
   * Сериализация документа
   */
  serialize() {
    return {
      documentId: this.state.documentId,
      title: this.state.title,
      version: this.state.version,
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt,
      metadata: this.state.metadata,
      blocks: this.getBlocks().map(block => ({
        id: block.id,
        type: block.type,
        content: block.content,
        attributes: block.attributes,
        createdAt: block.createdAt,
        updatedAt: block.updatedAt
      }))
    };
  }

  /**
   * Десериализация документа
   * @param {Object} data - Данные документа
   */
  deserialize(data) {
    this.state.documentId = data.documentId || this.generateDocumentId();
    this.state.title = data.title || 'Untitled Document';
    this.state.version = data.version || '1.0.0';
    this.state.createdAt = data.createdAt || Date.now();
    this.state.updatedAt = data.updatedAt || Date.now();
    this.state.metadata = data.metadata || {};

    // Очистка текущих блоков
    this.state.blocks.clear();
    this.state.blockOrder = [];

    // Загрузка блоков
    if (data.blocks && Array.isArray(data.blocks)) {
      data.blocks.forEach(blockData => {
        this.addBlock(blockData);
      });
    }

    this.notify({ type: 'document-loaded', data });
  }

  // ==================== Автосохранение ====================

  /**
   * Планирование автосохранения
   */
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      this.autoSave();
    }, this.autoSaveDelay);
  }

  /**
   * Автосохранение в localStorage
   */
  autoSave() {
    try {
      const data = this.serialize();
      localStorage.setItem('editor-autosave', JSON.stringify(data));
      console.log('📝 Документ автоматически сохранён');
    } catch (error) {
      console.error('Ошибка автосохранения:', error);
    }
  }

  /**
   * Загрузка из автосохранения
   */
  loadAutoSave() {
    try {
      const saved = localStorage.getItem('editor-autosave');
      if (saved) {
        const data = JSON.parse(saved);
        this.deserialize(data);
        console.log('📂 Документ загружен из автосохранения');
        return true;
      }
    } catch (error) {
      console.error('Ошибка загрузки автосохранения:', error);
    }
    return false;
  }

  // ==================== Метаданные ====================

  /**
   * Обновление метаданных документа
   * @param {Object} metadata - Метаданные
   */
  updateMetadata(metadata) {
    this.state.metadata = {
      ...this.state.metadata,
      ...metadata
    };
    this.notify({ type: 'metadata-updated', metadata: this.state.metadata });
  }

  /**
   * Установка заголовка документа
   * @param {string} title - Заголовок
   */
  setTitle(title) {
    this.state.title = title;
    this.notify({ type: 'title-updated', title });
  }

  // ==================== Утилиты ====================

  /**
   * Очистка документа
   */
  clear() {
    this.state.blocks.clear();
    this.state.blockOrder = [];
    this.state.selectedBlocks.clear();
    this.state.focusedBlock = null;
    this.state.history = [];
    this.state.historyIndex = -1;
    
    this.notify({ type: 'document-cleared' });
  }

  /**
   * Получение статистики документа
   */
  getStats() {
    const blocks = this.getBlocks();
    
    return {
      totalBlocks: blocks.length,
      blockTypes: blocks.reduce((acc, block) => {
        acc[block.type] = (acc[block.type] || 0) + 1;
        return acc;
      }, {}),
      totalCharacters: blocks.reduce((sum, block) => {
        return sum + (block.content?.length || 0);
      }, 0),
      createdAt: this.state.createdAt,
      updatedAt: this.state.updatedAt
    };
  }

  /**
   * Получение singleton instance
   */
  static getInstance() {
    if (!DocumentStore.instance) {
      DocumentStore.instance = new DocumentStore();
    }
    return DocumentStore.instance;
  }
}

// Экспорт singleton instance
export default DocumentStore.getInstance();

