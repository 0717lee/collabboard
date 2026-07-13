import type { StateStorage } from 'zustand/middleware';

const DEFAULT_DATABASE_NAME = 'collabboard-client-state';
const STORE_NAME = 'zustand';

interface IndexedDbStorageOptions {
    databaseName?: string;
}

const getLegacyStorage = () => (
    typeof localStorage === 'undefined' ? null : localStorage
);

export const createIndexedDbStorage = (
    options: IndexedDbStorageOptions = {}
): StateStorage => {
    const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
    const indexedDbFactory = globalThis.indexedDB;
    let databasePromise: Promise<IDBDatabase> | null = null;
    let hasWarnedAboutFallback = false;

    const warnAboutFallback = () => {
        if (!hasWarnedAboutFallback) {
            hasWarnedAboutFallback = true;
            console.warn('IndexedDB is unavailable; large local state is using localStorage.');
        }
    };

    const openDatabase = () => {
        if (!indexedDbFactory) {
            return Promise.reject(new Error('IndexedDB is unavailable'));
        }
        if (databasePromise) {
            return databasePromise;
        }

        databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDbFactory.open(databaseName, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                    request.result.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = () => {
                request.result.onversionchange = () => request.result.close();
                resolve(request.result);
            };
            request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
            request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'));
        });

        return databasePromise;
    };

    const runTransaction = async <T>(
        mode: IDBTransactionMode,
        operation: (store: IDBObjectStore) => IDBRequest<T>
    ): Promise<T> => {
        const database = await openDatabase();

        return new Promise<T>((resolve, reject) => {
            const transaction = database.transaction(STORE_NAME, mode);
            const request = operation(transaction.objectStore(STORE_NAME));
            let result: T;

            request.onsuccess = () => {
                result = request.result;
            };
            request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
            transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
        });
    };

    return {
        getItem: (name) => {
            const legacyStorage = getLegacyStorage();
            if (!indexedDbFactory) {
                warnAboutFallback();
                return legacyStorage?.getItem(name) ?? null;
            }

            return (async () => {
                const storedValue = await runTransaction('readonly', (store) => store.get(name));
                if (typeof storedValue === 'string') {
                    return storedValue;
                }

                const legacyValue = legacyStorage?.getItem(name) ?? null;
                if (legacyValue !== null) {
                    await runTransaction('readwrite', (store) => store.put(legacyValue, name));
                    legacyStorage?.removeItem(name);
                }
                return legacyValue;
            })();
        },

        setItem: (name, value) => {
            const legacyStorage = getLegacyStorage();
            if (!indexedDbFactory) {
                warnAboutFallback();
                if (!legacyStorage) {
                    throw new Error('No browser storage is available');
                }
                legacyStorage.setItem(name, value);
                return;
            }

            return runTransaction('readwrite', (store) => store.put(value, name))
                .then(() => {
                    legacyStorage?.removeItem(name);
                });
        },

        removeItem: (name) => {
            const legacyStorage = getLegacyStorage();
            if (!indexedDbFactory) {
                warnAboutFallback();
                legacyStorage?.removeItem(name);
                return;
            }

            return runTransaction('readwrite', (store) => store.delete(name))
                .then(() => {
                    legacyStorage?.removeItem(name);
                });
        },
    };
};

export const largeStateStorage = createIndexedDbStorage();
