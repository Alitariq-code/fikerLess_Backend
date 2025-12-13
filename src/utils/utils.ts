import * as jwt from 'jsonwebtoken';
import { Model } from 'mongoose';
import { User, UserDocument } from '../models/schemas/user.schema';

export function generateJwtToken(user: UserDocument): { success: boolean; token?: string; error?: string } {
  try {
    const payload = {
      user_id: user._id.toString(),
      email: user.email,
      user_type: user.user_type,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
    };
    const token = jwt.sign(payload, process.env.SECRET_KEY || 'default-secret', { algorithm: 'HS256' });
    return { success: true, token };
  } catch (error: any) {
    return { success: false, error: `Unable to generate token: ${error?.message || String(error)}` };
  }
}

export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email) {
    return { isValid: false, error: 'Please provide your email address.' };
  }

  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!pattern.test(email)) {
    return { isValid: false, error: 'Please provide a valid email address.' };
  }

  return { isValid: true };
}

export function validatePassword(password: string): { isValid: boolean; error?: string } {
  if (!password) {
    return { isValid: false, error: 'Please provide your password.' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long.' };
  }

  return { isValid: true };
}

export function generateRandomToken(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function parseJsonData(dataString: string): any {
  try {
    return JSON.parse(dataString);
  } catch {
    try {
      return eval(`(${dataString})`);
    } catch {
      try {
        const correctedString = dataString.replace(/'/g, '"');
        return JSON.parse(correctedString);
      } catch {
        throw new Error('Invalid format');
      }
    }
  }
}

export async function findUserByEmail(email: string, userModel: Model<UserDocument>): Promise<{ success: boolean; user?: UserDocument; error?: string }> {
  try {
    const user = await userModel.findOne({ email }).exec();
    
    if (!user) {
      return { success: false, error: 'No account found with this email address. Please sign up first.' };
    }
    return { success: true, user };
  } catch (error: any) {
    return { success: false, error: `Unable to find user: ${error?.message || String(error)}` };
  }
}

export function getUserFromToken(token: string, userModel: Model<UserDocument>): Promise<{ success: boolean; user?: UserDocument; error?: string }> {
  return new Promise(async (resolve) => {
    try {
      if (!token) {
        return resolve({ success: false, error: 'Please log in to access this feature.' });
      }

      if (token.startsWith('Bearer ')) {
        token = token.split(' ')[1];
      }

      const decoded = jwt.verify(token, process.env.SECRET_KEY || 'default-secret') as any;
      const email = decoded.email;

      if (!email) {
        return resolve({ success: false, error: 'Your session has expired. Please log in again.' });
      }

      const result = await findUserByEmail(email, userModel);
      resolve(result);
    } catch (error: any) {
      if (error?.name === 'TokenExpiredError') {
        return resolve({ success: false, error: 'Your session has expired. Please log in again.' });
      }
      if (error?.name === 'JsonWebTokenError') {
        return resolve({ success: false, error: 'Your session is invalid. Please log in again.' });
      }
      return resolve({ success: false, error: `Unable to verify token: ${error?.message || String(error)}` });
    }
  });
}

export async function generateUniqueUsername(
  firstName: string,
  lastName: string,
  email: string,
  userModel: Model<UserDocument>,
  userId?: string
): Promise<string> {
  // Create base username from name or email
  let baseUsername = '';
  
  if (firstName && lastName) {
    // Combine first and last name: "John Doe" -> "johndoe"
    baseUsername = `${firstName}${lastName}`.toLowerCase()
      .replace(/[^a-z0-9]/g, '') // Remove special characters
      .substring(0, 20); // Max 20 chars
  } else if (firstName) {
    baseUsername = firstName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
  } else {
    // Use email prefix: "john.doe@email.com" -> "johndoe"
    baseUsername = email.split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);
  }

  // Ensure minimum length
  if (baseUsername.length < 3) {
    baseUsername = baseUsername + Math.floor(Math.random() * 1000).toString();
  }

  // Check if username exists
  let username = baseUsername;
  let counter = 1;
  const maxAttempts = 1000;

  while (counter < maxAttempts) {
    const query: any = { username };
    if (userId) {
      query._id = { $ne: userId }; // Exclude current user
    }

    const existing = await userModel.findOne(query).exec();
    
    if (!existing) {
      return username; // Username is available
    }

    // Username taken, append number: johndoe -> johndoe1 -> johndoe2
    username = `${baseUsername}${counter}`;
    counter++;
  }

  // Fallback: use timestamp if all attempts fail
  return `${baseUsername}${Date.now().toString().slice(-6)}`;
}

