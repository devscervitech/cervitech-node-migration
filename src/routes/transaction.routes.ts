import express from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = express.Router();

/**
 * @openapi
 * /transaction:
 *   get:
 *     tags: [Transaction]
 *     summary: List the authenticated user's transaction records
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Records found
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: No transaction records found for this user
 */
router.get('/', authenticateJWT, TransactionController.getTransactionRecordsByUserId);

/**
 * @openapi
 * /transaction/{id}:
 *   get:
 *     tags: [Transaction]
 *     summary: Get one of the authenticated user's transaction records by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record found
 *       400:
 *         description: Invalid transaction ID
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Transaction record not found
 */
router.get('/:id', authenticateJWT, TransactionController.getTransactionRecordById);

/**
 * @openapi
 * /transaction:
 *   post:
 *     tags: [Transaction]
 *     summary: Create a transaction record for the authenticated user
 *     description: >
 *       Requires purchaseToken, packageName, and subscriptionId. The backend
 *       verifies the configured package and allowed product with Google Play.
 *       Client status and paymentRef never authorize access. Amount must be positive.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransactionRequest'
 *     responses:
 *       201:
 *         description: Transaction created
 *       400:
 *         description: >
 *           Transaction data missing/invalid, creation failed, or (for a
 *           Play purchase) the purchase token could not be verified
 *       401:
 *         description: Not authenticated
 */
router.post('/', authenticateJWT, TransactionController.createTransactionRecord);

export default router;
