/**
 * 本地数据库层 - 基于 IndexedDB
 * 台账数据完全存在手机本地，电脑关机/断网都能正常读写。
 */
(function () {
  const DB_NAME = "dianli-assistant-db";
  const DB_VERSION = 1;
  const STORE = "records";

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function generateId() {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }

  const db = {
    // 保存一条记录（新增或更新）
    async saveRecord(record) {
      const db = await openDB();
      const rec = {
        ...record,
        id: record.id || generateId(),
        updatedAt: new Date().toISOString(),
      };
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = () => resolve(rec);
        tx.onerror = () => reject(tx.error);
      });
    },

    // 获取全部记录（按日期倒序）
    async getAllRecords() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    },

    // 删除一条记录
    async deleteRecord(id) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },

    // 清空全部
    async clearAll() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
  };

  window.AppDB = db;
})();
