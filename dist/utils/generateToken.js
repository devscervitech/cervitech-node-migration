import jwt from 'jsonwebtoken';
const generateToken = (user) => {
    const token = jwt.sign({ userId: user._id.toString(), email: user.email }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
    return token;
};
export default generateToken;
