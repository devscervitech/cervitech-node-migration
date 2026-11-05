"use strict";
// // token-generator.service.ts
// import { Injectable, Logger } from '@nestjs/common';
// import { DataSource } from 'typeorm';
// import PasswordResetToken from '../models/PasswordResetToken';
// @Injectable()
// export class TokenGeneratorService {
//   private readonly logger = new Logger(TokenGeneratorService.name);
//   constructor(private readonly dataSource: DataSource) {}
//   async getToken(): Promise<string> {
//     const token = this.generateToken();
//     const exists = await this.tokenExists(token);
//     if (exists) {
//       this.logger.debug(`Token ${token} already exists. Generating a new one.`);
//       return this.getToken(); // recursion
//     }
//     return token;
//   }
//   private generateToken(): string {
//     const randomNumber = Math.floor(Math.random() * 100000);
//     return randomNumber.toString().padStart(5, '0');
//   }
//   private async tokenExists(token: string): Promise<boolean> {
//     const repo = this.dataSource.getRepository(PasswordResetToken);
//     return await repo.exist({ where: { token } });
//   }
// }
