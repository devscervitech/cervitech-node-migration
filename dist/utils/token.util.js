import jwt from 'jsonwebtoken';
const SECRET = process.env.JWT_SECRET || 'default';
export const TokenUtil = {
    generateResetToken(userId) {
        return jwt.sign({ userId }, SECRET, { expiresIn: '15m' });
    },
    verifyResetToken(token) {
        try {
            return jwt.verify(token, SECRET);
        }
        catch {
            throw new Error('Invalid or expired token');
        }
    }
};
