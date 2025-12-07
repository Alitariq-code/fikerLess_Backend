const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless_db';

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  phone_number: String,
  otp_token: String,
  is_email_verified: Boolean,
  user_type: String,
  has_demographics: Boolean,
  first_name: String,
  last_name: String,
}, { timestamps: true });

const User = mongoose.model('User', userSchema, 'users');

async function createTestUsers() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create Specialist User
    const specialistPassword = await bcrypt.hash('password123', 10);
    const specialist = await User.findOneAndUpdate(
      { email: 'specialist@test.com' },
      {
        email: 'specialist@test.com',
        password: specialistPassword,
        user_type: 'specialist',
        otp_token: '1234',
        is_email_verified: true,
        has_demographics: false,
        first_name: '',
        last_name: '',
      },
      { upsert: true, new: true }
    );
    console.log('✓ Specialist user created/updated:', specialist._id.toString());

    // Create Regular User
    const userPassword = await bcrypt.hash('password123', 10);
    const user = await User.findOneAndUpdate(
      { email: 'user@test.com' },
      {
        email: 'user@test.com',
        password: userPassword,
        user_type: 'user',
        otp_token: '5678',
        is_email_verified: true,
        has_demographics: true,
        first_name: 'Test',
        last_name: 'User',
      },
      { upsert: true, new: true }
    );
    console.log('✓ Regular user created/updated:', user._id.toString());

    await mongoose.disconnect();
    console.log('Users created successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createTestUsers();

