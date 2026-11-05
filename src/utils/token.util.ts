import jwt  from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET|| 'default';

export const TokenUtil = {
    generateResetToken(userId: string){
        return jwt.sign({userId}, SECRET, {expiresIn:'15m'});
    },


    verifyResetToken(token: string) {
    try {
        return jwt.verify(token, SECRET) as {userId: string};
    } catch {
        throw new Error('Invalid or expired token');
    }
}
};