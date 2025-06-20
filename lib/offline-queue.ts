'use client';

interface QueuedMessage {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  messageType: 'text' | 'image';
  imageUrl?: string;
  timestamp: number;
}

class OfflineMessageQueue {
  private queue: QueuedMessage[] = [];
  private readonly STORAGE_KEY = 'offline_message_queue';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.queue = [];
    }
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  addMessage(message: Omit<QueuedMessage, 'id' | 'timestamp'>) {
    const queuedMessage: QueuedMessage = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    this.queue.push(queuedMessage);
    this.saveToStorage();
    
    console.log('Message queued for offline sending:', queuedMessage);
    return queuedMessage.id;
  }

  async processQueue(sendMessageFn: (message: QueuedMessage) => Promise<boolean>) {
    if (this.queue.length === 0) return;

    console.log(`Processing ${this.queue.length} queued messages`);
    
    const toProcess = [...this.queue];
    this.queue = [];
    this.saveToStorage();

    for (const message of toProcess) {
      try {
        const success = await sendMessageFn(message);
        if (!success) {
          // Re-queue failed messages
          this.queue.push(message);
        }
      } catch (error) {
        console.error('Error processing queued message:', error);
        // Re-queue failed messages
        this.queue.push(message);
      }
    }

    if (this.queue.length > 0) {
      this.saveToStorage();
    }
  }

  getQueueLength() {
    return this.queue.length;
  }

  clearQueue() {
    this.queue = [];
    this.saveToStorage();
  }
}

export const offlineMessageQueue = new OfflineMessageQueue();