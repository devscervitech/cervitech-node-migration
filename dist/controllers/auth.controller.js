import { AuthService } from '../services/auth.service.js';
export const AuthController = {
    async signup(req, res) {
        try {
            const result = await AuthService.signup(req.body);
            res.status(201).json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
    async sendPasswordToken(req, res) {
        try {
            const result = await AuthService.sendPasswordResetToken(req.body);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
    async resetPassword(req, res) {
        try {
            const result = await AuthService.resetPassword(req.body);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = await AuthService.login(email, password);
            res.status(200).json(result);
        }
        catch (err) {
            res.status(400).json({ error: err.message });
        }
    },
    async logout(req, res) {
        try {
            // Send back logout confirmation
            res.status(200).json({ message: 'Logged out successfully' });
        }
        catch (err) {
            res.status(500).json({ error: 'Logout failed' });
        }
    },
};
