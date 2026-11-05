// src/utils/hash.util.ts
import bcrypt from 'bcrypt';
export const HashUtil = {
    async hash(password) {
        return await bcrypt.hash(password, 10);
    },
    async compare(password, hash) {
        return await bcrypt.compare(password, hash);
    }
};
