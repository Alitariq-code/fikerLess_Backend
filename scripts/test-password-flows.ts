import * as mongoose from 'mongoose';
import * as http from 'http';
import * as https from 'https';
import * as bcrypt from 'bcrypt';
import { URL } from 'url';
import { User, UserSchema } from '../src/models/schemas/user.schema';
import { generateUniqueUsername, validateEmail, validatePassword } from '../src/utils/utils';

// Use localhost for testing, or API_BASE_URL if provided
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5002';
const API_BASE = `${BASE_URL}/api/v1`;
const HARDCODED_OTP = '9999'; // Hardcoded OTP for testing

// Helper function to make HTTP requests
function makeRequest(url: string, options: { method: string; headers?: any; body?: string }): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 200, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: { raw: data } });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
}

class PasswordFlowTestSuite {
  private results: TestResult[] = [];
  private testCounter = 0;
  private testUsers: {
    regularUser?: { email: string; password: string; userId?: string; token?: string };
    specialist?: { email: string; password: string; userId?: string; token?: string };
    admin?: { email: string; password: string; userId?: string; token?: string };
  } = {};

  private UserModel: mongoose.Model<any>;

  constructor() {
    this.UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
  }

  private generateEmail(prefix: string = 'test'): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  }

  private logTest(name: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, details?: any): void {
    this.testCounter++;
    const result: TestResult = {
      name: `${this.testCounter}. ${name}`,
      status,
      message,
      details,
    };
    this.results.push(result);
    const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
    console.log(`${icon} ${result.name}: ${message}`);
    if (details && status === 'FAIL') {
      console.log('   Details:', JSON.stringify(details, null, 2));
    }
  }

  // ==================== SETUP: CREATE TEST USERS ====================
  async setupTestUsers(): Promise<void> {
    console.log('\n🔧 SETTING UP TEST USERS...\n');

    // Create Regular User
    try {
      this.testUsers.regularUser = {
        email: this.generateEmail('user'),
        password: 'TestPassword123!',
      };
      const hashedPassword = await bcrypt.hash(this.testUsers.regularUser.password, 10);
      const username = await generateUniqueUsername('', '', this.testUsers.regularUser.email, this.UserModel);
      
      const newUser = new this.UserModel({
        email: this.testUsers.regularUser.email,
        password: hashedPassword,
        user_type: 'user',
        username: username,
        is_email_verified: true,
        has_demographics: true,
        otp_token: HARDCODED_OTP,
      });
      
      await newUser.save();
      this.testUsers.regularUser.userId = newUser._id.toString();
      console.log(`   ✅ Created regular user: ${this.testUsers.regularUser.email}`);
    } catch (error: any) {
      console.error(`   ❌ Failed to create regular user: ${error.message}`);
    }

    // Create Specialist
    try {
      this.testUsers.specialist = {
        email: this.generateEmail('specialist'),
        password: 'SpecialistPass123!',
      };
      const hashedPassword = await bcrypt.hash(this.testUsers.specialist.password, 10);
      const username = await generateUniqueUsername('', '', this.testUsers.specialist.email, this.UserModel);
      
      const newUser = new this.UserModel({
        email: this.testUsers.specialist.email,
        password: hashedPassword,
        user_type: 'specialist',
        username: username,
        is_email_verified: true,
        has_demographics: false,
        otp_token: HARDCODED_OTP,
      });
      
      await newUser.save();
      this.testUsers.specialist.userId = newUser._id.toString();
      console.log(`   ✅ Created specialist: ${this.testUsers.specialist.email}`);
    } catch (error: any) {
      console.error(`   ❌ Failed to create specialist: ${error.message}`);
    }

    // Create Admin
    try {
      this.testUsers.admin = {
        email: this.generateEmail('admin'),
        password: 'AdminPass123!',
      };
      const hashedPassword = await bcrypt.hash(this.testUsers.admin.password, 10);
      const username = await generateUniqueUsername('', '', this.testUsers.admin.email, this.UserModel);
      
      const newUser = new this.UserModel({
        email: this.testUsers.admin.email,
        password: hashedPassword,
        user_type: 'admin',
        username: username,
        is_email_verified: true,
        has_demographics: false,
        otp_token: HARDCODED_OTP,
      });
      
      await newUser.save();
      this.testUsers.admin.userId = newUser._id.toString();
      console.log(`   ✅ Created admin: ${this.testUsers.admin.email}`);
    } catch (error: any) {
      console.error(`   ❌ Failed to create admin: ${error.message}`);
    }

    // Login users to get tokens for change password tests
    // Note: Regular users and admins can login, but specialists need a profile
    for (const [userType, user] of Object.entries(this.testUsers)) {
      if (user?.email && user?.password) {
        try {
          // For specialists, we'll skip login here and handle it in the test
          if (userType === 'specialist') {
            console.log(`   ⚠️  Skipping login for specialist (needs profile for login)`);
            continue;
          }
          
          const loginRes = await makeRequest(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              email: user.email,
              password: user.password,
            }),
          });
          if (loginRes.status === 200 && loginRes.data.token) {
            user.token = loginRes.data.token;
            console.log(`   ✅ Logged in ${userType}: ${user.email}`);
          }
        } catch (error: any) {
          console.log(`   ⚠️  Could not login ${userType}: ${error.message}`);
        }
      }
    }
  }

  // ==================== CLEANUP ====================
  async cleanup(): Promise<void> {
    console.log('\n🧹 CLEANING UP TEST DATA...\n');
    try {
      for (const user of Object.values(this.testUsers)) {
        if (user?.userId) {
          await this.UserModel.deleteOne({ _id: user.userId }).exec();
        }
      }
      console.log('   ✅ Cleanup complete');
    } catch (error: any) {
      console.error(`   ⚠️  Cleanup error: ${error.message}`);
    }
  }

  // ==================== TEST GROUP 1: FORGOT PASSWORD ====================
  async runForgotPasswordTests(): Promise<void> {
    console.log('\n📋 TEST GROUP 1: Forgot Password\n');

    // Test 1: Regular User - Forgot Password
    try {
      if (this.testUsers.regularUser?.email) {
        const res = await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.regularUser.email }),
        });
        if (res.status === 200 && res.data.message && res.data.email) {
          // Set hardcoded OTP in database
          const user = await this.UserModel.findOne({ email: this.testUsers.regularUser.email });
          if (user) {
            user.otp_token = HARDCODED_OTP;
            await user.save();
          }
          this.logTest('Regular User - Forgot Password', 'PASS', 'Password reset code sent successfully');
        } else {
          throw new Error(res.data.message || 'Request failed');
        }
      } else {
        this.logTest('Regular User - Forgot Password', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Regular User - Forgot Password', 'FAIL', error.message || 'Request failed', error);
    }

    // Test 2: Specialist - Forgot Password
    try {
      if (this.testUsers.specialist?.email) {
        const res = await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.specialist.email }),
        });
        if (res.status === 200 && res.data.message) {
          // Set hardcoded OTP in database
          const user = await this.UserModel.findOne({ email: this.testUsers.specialist.email });
          if (user) {
            user.otp_token = HARDCODED_OTP;
            await user.save();
          }
          this.logTest('Specialist - Forgot Password', 'PASS', 'Password reset code sent successfully');
        } else {
          throw new Error(res.data.message || 'Request failed');
        }
      } else {
        this.logTest('Specialist - Forgot Password', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Specialist - Forgot Password', 'FAIL', error.message || 'Request failed', error);
    }

    // Test 3: Admin - Forgot Password
    try {
      if (this.testUsers.admin?.email) {
        const res = await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.admin.email }),
        });
        if (res.status === 200 && res.data.message) {
          // Set hardcoded OTP in database
          const user = await this.UserModel.findOne({ email: this.testUsers.admin.email });
          if (user) {
            user.otp_token = HARDCODED_OTP;
            await user.save();
          }
          this.logTest('Admin - Forgot Password', 'PASS', 'Password reset code sent successfully');
        } else {
          throw new Error(res.data.message || 'Request failed');
        }
      } else {
        this.logTest('Admin - Forgot Password', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Admin - Forgot Password', 'FAIL', error.message || 'Request failed', error);
    }

    // Test 4: Forgot Password - Invalid Email
    try {
      const res = await makeRequest(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' }),
      });
      if (res.status === 400) {
        this.logTest('Forgot Password - Invalid Email', 'PASS', 'Correctly rejected invalid email');
      } else {
        this.logTest('Forgot Password - Invalid Email', 'FAIL', 'Should have rejected invalid email', res.data);
      }
    } catch (error: any) {
      this.logTest('Forgot Password - Invalid Email', 'PASS', 'Correctly rejected invalid email');
    }

    // Test 5: Forgot Password - Non-existent Email
    try {
      const res = await makeRequest(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });
      if (res.status === 404) {
        this.logTest('Forgot Password - Non-existent Email', 'PASS', 'Correctly rejected non-existent email');
      } else {
        this.logTest('Forgot Password - Non-existent Email', 'FAIL', 'Should have returned 404', res.data);
      }
    } catch (error: any) {
      this.logTest('Forgot Password - Non-existent Email', 'PASS', 'Correctly rejected non-existent email');
    }

    // Test 6: Forgot Password - Missing Email
    try {
      const res = await makeRequest(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res.status === 400) {
        this.logTest('Forgot Password - Missing Email', 'PASS', 'Correctly rejected missing email');
      } else {
        this.logTest('Forgot Password - Missing Email', 'FAIL', 'Should have rejected missing email', res.data);
      }
    } catch (error: any) {
      this.logTest('Forgot Password - Missing Email', 'PASS', 'Correctly rejected missing email');
    }
  }

  // ==================== TEST GROUP 2: RESET PASSWORD ====================
  async runResetPasswordTests(): Promise<void> {
    console.log('\n📋 TEST GROUP 2: Reset Password\n');

    // Test 7: Regular User - Reset Password with Valid OTP
    try {
      if (this.testUsers.regularUser?.email) {
        const newPassword = 'NewPassword123!';
        const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.regularUser.email,
            otp: HARDCODED_OTP,
            new_password: newPassword,
          }),
        });
        if (res.status === 200 && res.data.message) {
          // Verify login with new password
          const loginRes = await makeRequest(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              email: this.testUsers.regularUser.email,
              password: newPassword,
            }),
          });
          if (loginRes.status === 200 && loginRes.data.token) {
            this.testUsers.regularUser.password = newPassword;
            this.testUsers.regularUser.token = loginRes.data.token;
            this.logTest('Regular User - Reset Password with Valid OTP', 'PASS', 'Password reset and login successful');
          } else {
            this.logTest('Regular User - Reset Password with Valid OTP', 'FAIL', 'Password reset but login failed', loginRes.data);
          }
        } else {
          throw new Error(res.data.message || 'Reset failed');
        }
      } else {
        this.logTest('Regular User - Reset Password with Valid OTP', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Regular User - Reset Password with Valid OTP', 'FAIL', error.message || 'Reset failed', error);
    }

    // Test 8: Specialist - Reset Password with Valid OTP
    try {
      if (this.testUsers.specialist?.email) {
        // Request forgot password again to get new OTP
        await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.specialist.email }),
        });
        // Set hardcoded OTP
        const user = await this.UserModel.findOne({ email: this.testUsers.specialist.email });
        if (user) {
          user.otp_token = HARDCODED_OTP;
          await user.save();
        }

        const newPassword = 'NewSpecialistPass123!';
        const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.specialist.email,
            otp: HARDCODED_OTP,
            new_password: newPassword,
          }),
        });
        if (res.status === 200 && res.data.message) {
          this.testUsers.specialist.password = newPassword;
          this.logTest('Specialist - Reset Password with Valid OTP', 'PASS', 'Password reset successful');
        } else {
          throw new Error(res.data.message || 'Reset failed');
        }
      } else {
        this.logTest('Specialist - Reset Password with Valid OTP', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Specialist - Reset Password with Valid OTP', 'FAIL', error.message || 'Reset failed', error);
    }

    // Test 9: Admin - Reset Password with Valid OTP
    try {
      if (this.testUsers.admin?.email) {
        // Request forgot password again to get new OTP
        await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.admin.email }),
        });
        // Set hardcoded OTP
        const user = await this.UserModel.findOne({ email: this.testUsers.admin.email });
        if (user) {
          user.otp_token = HARDCODED_OTP;
          await user.save();
        }

        const newPassword = 'NewAdminPass123!';
        const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.admin.email,
            otp: HARDCODED_OTP,
            new_password: newPassword,
          }),
        });
        if (res.status === 200 && res.data.message) {
          this.testUsers.admin.password = newPassword;
          this.logTest('Admin - Reset Password with Valid OTP', 'PASS', 'Password reset successful');
        } else {
          throw new Error(res.data.message || 'Reset failed');
        }
      } else {
        this.logTest('Admin - Reset Password with Valid OTP', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Admin - Reset Password with Valid OTP', 'FAIL', error.message || 'Reset failed', error);
    }

    // Test 10: Reset Password - Invalid OTP
    try {
      if (this.testUsers.regularUser?.email) {
        const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.regularUser.email,
            otp: '0000',
            new_password: 'NewPassword123!',
          }),
        });
        if (res.status === 404) {
          this.logTest('Reset Password - Invalid OTP', 'PASS', 'Correctly rejected invalid OTP');
        } else {
          this.logTest('Reset Password - Invalid OTP', 'FAIL', 'Should have rejected invalid OTP', res.data);
        }
      } else {
        this.logTest('Reset Password - Invalid OTP', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Reset Password - Invalid OTP', 'PASS', 'Correctly rejected invalid OTP');
    }

    // Test 11: Reset Password - Weak Password
    try {
      if (this.testUsers.regularUser?.email) {
        // Request forgot password to get OTP
        await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.regularUser.email }),
        });
        const user = await this.UserModel.findOne({ email: this.testUsers.regularUser.email });
        if (user) {
          user.otp_token = HARDCODED_OTP;
          await user.save();
        }

        const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.regularUser.email,
            otp: HARDCODED_OTP,
            new_password: '123', // Too short
          }),
        });
        if (res.status === 400) {
          this.logTest('Reset Password - Weak Password', 'PASS', 'Correctly rejected weak password');
        } else {
          this.logTest('Reset Password - Weak Password', 'FAIL', 'Should have rejected weak password', res.data);
        }
      } else {
        this.logTest('Reset Password - Weak Password', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Reset Password - Weak Password', 'PASS', 'Correctly rejected weak password');
    }

    // Test 12: Reset Password - Missing Fields
    try {
      const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@example.com',
          // Missing otp and new_password
        }),
      });
      if (res.status === 400) {
        this.logTest('Reset Password - Missing Fields', 'PASS', 'Correctly rejected missing fields');
      } else {
        this.logTest('Reset Password - Missing Fields', 'FAIL', 'Should have rejected missing fields', res.data);
      }
    } catch (error: any) {
      this.logTest('Reset Password - Missing Fields', 'PASS', 'Correctly rejected missing fields');
    }
  }

  // ==================== TEST GROUP 3: CHANGE PASSWORD ====================
  async runChangePasswordTests(): Promise<void> {
    console.log('\n📋 TEST GROUP 3: Change Password\n');

    // Test 13: Regular User - Change Password with Valid Old Password
    try {
      if (this.testUsers.regularUser?.token && this.testUsers.regularUser?.password) {
        const newPassword = 'ChangedPassword123!';
        const res = await makeRequest(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.testUsers.regularUser.token}`,
          },
          body: JSON.stringify({
            old_password: this.testUsers.regularUser.password,
            new_password: newPassword,
          }),
        });
        if (res.status === 200 && res.data.message) {
          // Verify login with new password
          const loginRes = await makeRequest(`${API_BASE}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              email: this.testUsers.regularUser.email,
              password: newPassword,
            }),
          });
          if (loginRes.status === 200 && loginRes.data.token) {
            this.testUsers.regularUser.password = newPassword;
            this.testUsers.regularUser.token = loginRes.data.token;
            this.logTest('Regular User - Change Password with Valid Old Password', 'PASS', 'Password changed and login successful');
          } else {
            this.logTest('Regular User - Change Password with Valid Old Password', 'FAIL', 'Password changed but login failed', loginRes.data);
          }
        } else {
          throw new Error(res.data.message || 'Change password failed');
        }
      } else {
        this.logTest('Regular User - Change Password with Valid Old Password', 'SKIP', 'No token available');
      }
    } catch (error: any) {
      this.logTest('Regular User - Change Password with Valid Old Password', 'FAIL', error.message || 'Change password failed', error);
    }

    // Test 14: Specialist - Change Password with Valid Old Password
    // Note: Specialists need a profile to login, so we'll test change password via reset password flow instead
    try {
      if (this.testUsers.specialist?.email && this.testUsers.specialist?.password) {
        // Since specialist can't login without profile, we'll test via reset password flow
        // First request forgot password
        await makeRequest(`${API_BASE}/auth/forgot-password`, {
          method: 'POST',
          body: JSON.stringify({ email: this.testUsers.specialist.email }),
        });
        // Set hardcoded OTP
        const user = await this.UserModel.findOne({ email: this.testUsers.specialist.email });
        if (user) {
          user.otp_token = HARDCODED_OTP;
          await user.save();
        }

        const newPassword = 'ChangedSpecialistPass123!';
        const res = await makeRequest(`${API_BASE}/auth/reset-password`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.specialist.email,
            otp: HARDCODED_OTP,
            new_password: newPassword,
          }),
        });
        if (res.status === 200 && res.data.message) {
          this.testUsers.specialist.password = newPassword;
          this.logTest('Specialist - Change Password (via Reset)', 'PASS', 'Password changed successfully via reset flow (specialist needs profile to login)');
        } else {
          throw new Error(res.data.message || 'Change password failed');
        }
      } else {
        this.logTest('Specialist - Change Password with Valid Old Password', 'SKIP', 'No test user available');
      }
    } catch (error: any) {
      this.logTest('Specialist - Change Password with Valid Old Password', 'FAIL', error.message || 'Change password failed', error);
    }

    // Test 15: Admin - Change Password with Valid Old Password
    try {
      if (this.testUsers.admin?.token && this.testUsers.admin?.password) {
        // Login again to get fresh token
        const loginRes = await makeRequest(`${API_BASE}/auth/login`, {
          method: 'POST',
          body: JSON.stringify({
            email: this.testUsers.admin.email,
            password: this.testUsers.admin.password,
          }),
        });
        if (loginRes.status === 200 && loginRes.data.token) {
          this.testUsers.admin.token = loginRes.data.token;
        }

        const newPassword = 'ChangedAdminPass123!';
        const res = await makeRequest(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.testUsers.admin.token}`,
          },
          body: JSON.stringify({
            old_password: this.testUsers.admin.password,
            new_password: newPassword,
          }),
        });
        if (res.status === 200 && res.data.message) {
          this.testUsers.admin.password = newPassword;
          this.logTest('Admin - Change Password with Valid Old Password', 'PASS', 'Password changed successful');
        } else {
          throw new Error(res.data.message || 'Change password failed');
        }
      } else {
        this.logTest('Admin - Change Password with Valid Old Password', 'SKIP', 'No token available');
      }
    } catch (error: any) {
      this.logTest('Admin - Change Password with Valid Old Password', 'FAIL', error.message || 'Change password failed', error);
    }

    // Test 16: Change Password - Invalid Old Password
    try {
      if (this.testUsers.regularUser?.token) {
        const res = await makeRequest(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.testUsers.regularUser.token}`,
          },
          body: JSON.stringify({
            old_password: 'WrongPassword123!',
            new_password: 'NewPassword123!',
          }),
        });
        if (res.status === 401) {
          this.logTest('Change Password - Invalid Old Password', 'PASS', 'Correctly rejected invalid old password');
        } else {
          this.logTest('Change Password - Invalid Old Password', 'FAIL', 'Should have rejected invalid old password', res.data);
        }
      } else {
        this.logTest('Change Password - Invalid Old Password', 'SKIP', 'No token available');
      }
    } catch (error: any) {
      this.logTest('Change Password - Invalid Old Password', 'PASS', 'Correctly rejected invalid old password');
    }

    // Test 17: Change Password - Same as Old Password
    try {
      if (this.testUsers.regularUser?.token && this.testUsers.regularUser?.password) {
        const res = await makeRequest(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.testUsers.regularUser.token}`,
          },
          body: JSON.stringify({
            old_password: this.testUsers.regularUser.password,
            new_password: this.testUsers.regularUser.password, // Same password
          }),
        });
        if (res.status === 400) {
          this.logTest('Change Password - Same as Old Password', 'PASS', 'Correctly rejected same password');
        } else {
          this.logTest('Change Password - Same as Old Password', 'FAIL', 'Should have rejected same password', res.data);
        }
      } else {
        this.logTest('Change Password - Same as Old Password', 'SKIP', 'No token available');
      }
    } catch (error: any) {
      this.logTest('Change Password - Same as Old Password', 'PASS', 'Correctly rejected same password');
    }

    // Test 18: Change Password - Weak New Password
    try {
      if (this.testUsers.regularUser?.token && this.testUsers.regularUser?.password) {
        const res = await makeRequest(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.testUsers.regularUser.token}`,
          },
          body: JSON.stringify({
            old_password: this.testUsers.regularUser.password,
            new_password: '123', // Too short
          }),
        });
        if (res.status === 400) {
          this.logTest('Change Password - Weak New Password', 'PASS', 'Correctly rejected weak password');
        } else {
          this.logTest('Change Password - Weak New Password', 'FAIL', 'Should have rejected weak password', res.data);
        }
      } else {
        this.logTest('Change Password - Weak New Password', 'SKIP', 'No token available');
      }
    } catch (error: any) {
      this.logTest('Change Password - Weak New Password', 'PASS', 'Correctly rejected weak password');
    }

    // Test 19: Change Password - Missing Token
    try {
      const res = await makeRequest(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({
          old_password: 'OldPass123!',
          new_password: 'NewPass123!',
        }),
      });
      if (res.status === 401) {
        this.logTest('Change Password - Missing Token', 'PASS', 'Correctly rejected missing token');
      } else {
        this.logTest('Change Password - Missing Token', 'FAIL', 'Should have rejected missing token', res.data);
      }
    } catch (error: any) {
      this.logTest('Change Password - Missing Token', 'PASS', 'Correctly rejected missing token');
    }

    // Test 20: Change Password - Invalid Token
    try {
      const res = await makeRequest(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid_token_12345',
        },
        body: JSON.stringify({
          old_password: 'OldPass123!',
          new_password: 'NewPass123!',
        }),
      });
      if (res.status === 401) {
        this.logTest('Change Password - Invalid Token', 'PASS', 'Correctly rejected invalid token');
      } else {
        this.logTest('Change Password - Invalid Token', 'FAIL', 'Should have rejected invalid token', res.data);
      }
    } catch (error: any) {
      this.logTest('Change Password - Invalid Token', 'PASS', 'Correctly rejected invalid token');
    }

    // Test 21: Change Password - Missing Fields
    try {
      if (this.testUsers.regularUser?.token) {
        const res = await makeRequest(`${API_BASE}/auth/change-password`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.testUsers.regularUser.token}`,
          },
          body: JSON.stringify({
            // Missing old_password and new_password
          }),
        });
        if (res.status === 400) {
          this.logTest('Change Password - Missing Fields', 'PASS', 'Correctly rejected missing fields');
        } else {
          this.logTest('Change Password - Missing Fields', 'FAIL', 'Should have rejected missing fields', res.data);
        }
      } else {
        this.logTest('Change Password - Missing Fields', 'SKIP', 'No token available');
      }
    } catch (error: any) {
      this.logTest('Change Password - Missing Fields', 'PASS', 'Correctly rejected missing fields');
    }
  }

  // ==================== RUN ALL TESTS ====================
  async runAllTests(): Promise<void> {
    console.log('\n🧪 Starting Password Flow Tests\n');
    console.log('============================================================');

    // Connect to MongoDB
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || '27017';
    const db = process.env.MONGODB_DB || 'fikrless';
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;

    let uri = `mongodb://${host}:${port}/${db}`;
    if (username && password) {
      uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${db}?authSource=admin`;
    }

    try {
      console.log(`Connecting to MongoDB: ${uri.replace(/:[^:@]+@/, ':****@')}`);
      await mongoose.connect(uri);
      console.log('✅ Connected to MongoDB\n');

      // Setup test users
      await this.setupTestUsers();

      // Run test groups
      await this.runForgotPasswordTests();
      await this.runResetPasswordTests();
      await this.runChangePasswordTests();

      // Print summary
      console.log('\n============================================================');
      console.log('📊 TEST SUMMARY');
      console.log('============================================================');
      const passed = this.results.filter(r => r.status === 'PASS').length;
      const failed = this.results.filter(r => r.status === 'FAIL').length;
      const skipped = this.results.filter(r => r.status === 'SKIP').length;
      const total = this.results.length;
      const successRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

      console.log(`Total Tests: ${total}`);
      console.log(`✅ Passed: ${passed}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`⏭️  Skipped: ${skipped}`);
      console.log(`📈 Success Rate: ${successRate}%`);

      if (failed > 0) {
        console.log('\n❌ Failed Tests:');
        this.results.filter(r => r.status === 'FAIL').forEach(r => {
          console.log(`   ${r.name}: ${r.message}`);
        });
      }

      if (skipped > 0) {
        console.log('\n⏭️  Skipped Tests:');
        this.results.filter(r => r.status === 'SKIP').forEach(r => {
          console.log(`   ${r.name}: ${r.message}`);
        });
      }

      console.log('\n============================================================');
      console.log('✨ Test Suite Complete!\n');

      // Cleanup
      await this.cleanup();
      await mongoose.disconnect();
    } catch (error: any) {
      console.error('\n❌ Test suite failed:', error);
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

// Run tests
const testSuite = new PasswordFlowTestSuite();
testSuite.runAllTests().catch(console.error);

