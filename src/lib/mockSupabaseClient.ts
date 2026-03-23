type MockUserRecord = {
    id: string;
    email: string;
    password: string;
    created_at: string;
    user_metadata?: {
        name?: string;
    };
};

type MockProfileRecord = {
    id: string;
    email: string;
    name: string;
};

type MockBoardRecord = {
    id: string;
    name: string;
    owner_id: string;
    data: {
        objects: unknown[];
        version: string;
    };
    created_at: string;
    updated_at: string;
};

type MockSessionRecord = {
    userId: string;
};

const STORAGE_KEYS = {
    users: 'mock-supabase-users',
    profiles: 'mock-supabase-profiles',
    boards: 'mock-supabase-boards',
    session: 'mock-supabase-session',
};

const createId = () => globalThis.crypto?.randomUUID?.()
    || `mock-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readStorage = <T,>(key: string, fallback: T): T => {
    if (typeof window === 'undefined') return fallback;

    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;

    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
};

const writeStorage = <T,>(key: string, value: T) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, JSON.stringify(value));
};

const ensureDefaults = () => {
    const users = readStorage<MockUserRecord[]>(STORAGE_KEYS.users, []);
    const profiles = readStorage<MockProfileRecord[]>(STORAGE_KEYS.profiles, []);

    if (!users.some((user) => user.email === 'demo@collabboard.com')) {
        const createdAt = new Date().toISOString();
        users.push({
            id: 'demo-user-id',
            email: 'demo@collabboard.com',
            password: 'demo123',
            created_at: createdAt,
            user_metadata: {
                name: 'Demo User',
            },
        });
    }

    if (!profiles.some((profile) => profile.id === 'demo-user-id')) {
        profiles.push({
            id: 'demo-user-id',
            email: 'demo@collabboard.com',
            name: 'Demo User',
        });
    }

    writeStorage(STORAGE_KEYS.users, users);
    writeStorage(STORAGE_KEYS.profiles, profiles);
};

const getUsers = () => {
    ensureDefaults();
    return readStorage<MockUserRecord[]>(STORAGE_KEYS.users, []);
};

const setUsers = (users: MockUserRecord[]) => {
    writeStorage(STORAGE_KEYS.users, users);
};

const getProfiles = () => {
    ensureDefaults();
    return readStorage<MockProfileRecord[]>(STORAGE_KEYS.profiles, []);
};

const setProfiles = (profiles: MockProfileRecord[]) => {
    writeStorage(STORAGE_KEYS.profiles, profiles);
};

const getBoards = () => readStorage<MockBoardRecord[]>(STORAGE_KEYS.boards, []);

const setBoards = (boards: MockBoardRecord[]) => {
    writeStorage(STORAGE_KEYS.boards, boards);
};

const getSession = () => readStorage<MockSessionRecord | null>(STORAGE_KEYS.session, null);

const setSession = (session: MockSessionRecord | null) => {
    if (typeof window === 'undefined') return;

    if (!session) {
        window.localStorage.removeItem(STORAGE_KEYS.session);
        return;
    }

    writeStorage(STORAGE_KEYS.session, session);
};

const buildAuthUser = (user: MockUserRecord) => ({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    user_metadata: user.user_metadata || {},
});

const selectColumns = <T extends Record<string, unknown>>(record: T, columns?: string | null) => {
    if (!columns || columns === '*') return { ...record };

    return columns
        .split(',')
        .map((column) => column.trim())
        .reduce<Record<string, unknown>>((result, column) => {
            if (column in record) {
                result[column] = record[column];
            }
            return result;
        }, {});
};

export const createMockSupabaseClient = () => {
    const authListeners: Array<(event: 'SIGNED_IN' | 'SIGNED_OUT', session: { user: ReturnType<typeof buildAuthUser> } | null) => void> = [];

    const emitAuthChange = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: { user: ReturnType<typeof buildAuthUser> } | null) => {
        authListeners.forEach((listener) => {
            listener(event, session);
        });
    };

    const createQueryChain = (
        table: 'profiles' | 'boards',
        rows: Array<Record<string, unknown>>,
        columns?: string
    ) => ({
        eq(field: string, value: unknown) {
            const filteredRows = rows.filter((row) => row[field] === value);

            return {
                single: async () => ({
                    data: filteredRows[0] ? selectColumns(filteredRows[0], columns) : null,
                    error: filteredRows[0] ? null : { message: 'Not found' },
                }),
                order: async (fieldName: string, options?: { ascending?: boolean }) => {
                    const orderedRows = filteredRows
                        .slice()
                        .sort((left, right) => {
                            const leftValue = String(left[fieldName] || '');
                            const rightValue = String(right[fieldName] || '');
                            return options?.ascending === false
                                ? rightValue.localeCompare(leftValue)
                                : leftValue.localeCompare(rightValue);
                        })
                        .map((row) => selectColumns(row, columns));

                    return {
                        data: orderedRows,
                        error: null,
                    };
                },
            };
        },
    });

    const createInsertResponse = (inserted: Record<string, unknown> | null) => ({
        data: inserted,
        error: null,
        select() {
            return {
                single: async () => ({
                    data: inserted,
                    error: null,
                }),
            };
        },
    });

    return {
        auth: {
            async signInWithPassword({ email, password }: { email: string; password: string }) {
                const user = getUsers().find((candidate) => candidate.email === email);

                if (!user || user.password !== password) {
                    return {
                        data: {
                            user: null,
                            session: null,
                        },
                        error: {
                            message: '密码错误',
                        },
                    };
                }

                const authUser = buildAuthUser(user);
                const session = {
                    user: authUser,
                    access_token: `mock-token-${user.id}`,
                };

                setSession({ userId: user.id });
                emitAuthChange('SIGNED_IN', { user: authUser });

                return {
                    data: {
                        user: authUser,
                        session,
                    },
                    error: null,
                };
            },

            async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { name?: string } } }) {
                const users = getUsers();

                if (users.some((user) => user.email === email)) {
                    return {
                        data: {
                            user: null,
                            session: null,
                        },
                        error: {
                            message: '该邮箱已被注册',
                        },
                    };
                }

                const createdAt = new Date().toISOString();
                const user: MockUserRecord = {
                    id: createId(),
                    email,
                    password,
                    created_at: createdAt,
                    user_metadata: {
                        name: options?.data?.name || email.split('@')[0] || 'User',
                    },
                };

                users.push(user);
                setUsers(users);

                const profiles = getProfiles();
                profiles.push({
                    id: user.id,
                    email,
                    name: user.user_metadata?.name || 'User',
                });
                setProfiles(profiles);

                const authUser = buildAuthUser(user);
                setSession({ userId: user.id });
                emitAuthChange('SIGNED_IN', { user: authUser });

                return {
                    data: {
                        user: authUser,
                        session: {
                            user: authUser,
                            access_token: `mock-token-${user.id}`,
                        },
                    },
                    error: null,
                };
            },

            async signOut() {
                setSession(null);
                emitAuthChange('SIGNED_OUT', null);
                return { error: null };
            },

            async getUser() {
                const session = getSession();
                if (!session) {
                    return {
                        data: { user: null },
                        error: null,
                    };
                }

                const user = getUsers().find((candidate) => candidate.id === session.userId);
                return {
                    data: { user: user ? buildAuthUser(user) : null },
                    error: null,
                };
            },

            async getSession() {
                const session = getSession();
                const user = session ? getUsers().find((candidate) => candidate.id === session.userId) : null;

                return {
                    data: {
                        session: user ? { user: buildAuthUser(user), access_token: `mock-token-${user.id}` } : null,
                    },
                    error: null,
                };
            },

            onAuthStateChange(callback: (event: 'SIGNED_IN' | 'SIGNED_OUT', session: { user: ReturnType<typeof buildAuthUser> } | null) => void) {
                authListeners.push(callback);

                return {
                    data: {
                        subscription: {
                            unsubscribe: () => {
                                const index = authListeners.indexOf(callback);
                                if (index >= 0) authListeners.splice(index, 1);
                            },
                        },
                    },
                };
            },
        },

        from(table: 'profiles' | 'boards') {
            if (table === 'profiles') {
                return {
                    select(columns = '*') {
                        return createQueryChain(table, getProfiles() as unknown as Array<Record<string, unknown>>, columns);
                    },
                    insert(record: MockProfileRecord) {
                        const profiles = getProfiles();
                        const existing = profiles.find((profile) => profile.id === record.id);
                        const inserted = existing || record;

                        if (!existing) {
                            profiles.push(record);
                            setProfiles(profiles);
                        }

                        return createInsertResponse(inserted as unknown as Record<string, unknown>);
                    },
                };
            }

            return {
                select(columns = '*') {
                    return createQueryChain(table, getBoards() as unknown as Array<Record<string, unknown>>, columns);
                },
                insert(record: { name: string; owner_id: string; data: { objects: unknown[]; version: string } }) {
                    const now = new Date().toISOString();
                    const board: MockBoardRecord = {
                        id: createId(),
                        name: record.name,
                        owner_id: record.owner_id,
                        data: record.data,
                        created_at: now,
                        updated_at: now,
                    };
                    const boards = getBoards();
                    boards.push(board);
                    setBoards(boards);

                    return createInsertResponse(board as unknown as Record<string, unknown>);
                },
                update(updates: Record<string, unknown>) {
                    return {
                        eq: async (field: string, value: unknown) => {
                            const boards = getBoards();
                            const target = boards.find((board) => board[field as keyof MockBoardRecord] === value);

                            if (!target) {
                                return { error: { message: 'Board not found' } };
                            }

                            Object.assign(target, updates);
                            setBoards(boards);
                            return { error: null };
                        },
                    };
                },
                delete() {
                    return {
                        eq: async (field: string, value: unknown) => {
                            const boards = getBoards();
                            const nextBoards = boards.filter((board) => board[field as keyof MockBoardRecord] !== value);
                            const count = boards.length - nextBoards.length;
                            setBoards(nextBoards);
                            return {
                                error: null,
                                count,
                            };
                        },
                    };
                },
            };
        },
    };
};

export default createMockSupabaseClient;
