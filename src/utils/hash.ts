// src/utils/hash.util.ts
import bcrypt from 'bcrypt';

export const HashUtil = {
  async hash(password: string) {
    return await bcrypt.hash(password, 10);
  },
  async compare(password: string, hash: string) {
    return await bcrypt.compare(password, hash);
  }
};
