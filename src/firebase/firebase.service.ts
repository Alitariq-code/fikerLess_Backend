import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import { existsSync } from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  onModuleInit() {
    if (admin.apps.length === 0) {
      // Try multiple paths to find service-account.json
      const possiblePaths = [
        path.join(process.cwd(), 'src', 'config', 'service-account.json'),
        path.join(process.cwd(), 'dist', 'config', 'service-account.json'),
        path.join(process.cwd(), 'service-account.json'),
      ];

      let serviceAccountPath: string | null = null;
      for (const possiblePath of possiblePaths) {
        if (existsSync(possiblePath)) {
          serviceAccountPath = possiblePath;
          break;
        }
      }

      if (!serviceAccountPath) {
        throw new Error(
          'service-account.json not found. Please ensure it exists in src/config/',
        );
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
      });

      console.log('FirebaseApp initialized');
    }
  }

  getMessaging() {
    return admin.messaging();
  }
}

