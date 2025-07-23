interface StorageData {
  script: string
  parsed: any
  characterImages: Record<string, string>
  backgroundImages: Record<string, string>
  voiceSettings: Record<string, string>
  bgmSettings: {
    fileName: string
    fileData: string
    volume: number
  }
  audioFiles: Record<string, string>
  videoFile?: string
}

const DB_NAME = 'AnimeAIGenDB'
const DB_VERSION = 3 // Increment version to handle schema changes
const STORE_NAME = 'appData'

class StorageManager {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // Clear all existing stores on upgrade
        const storeNames = Array.from(db.objectStoreNames)
        storeNames.forEach(name => {
          db.deleteObjectStore(name)
        })
        
        // Create new store
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    })
  }

  async saveData(key: keyof StorageData, data: any): Promise<void> {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const request = store.put({ key, data })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getData(key: keyof StorageData): Promise<any> {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result?.data || null)
      request.onerror = () => resolve(null)
    })
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deleteData(key: keyof StorageData): Promise<void> {
    if (!this.db) await this.init()
    
    const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    
    return new Promise((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

export const storageManager = new StorageManager()