const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fikrless_db';

const specialistSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const SpecialistProfile = mongoose.model('SpecialistProfile', specialistSchema, 'specialist_profiles');

const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
const User = mongoose.model('User', userSchema, 'users');

async function createProfile() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const specialist = await User.findOne({ email: 'specialist@test.com' });
    if (!specialist) {
      console.error('Specialist user not found');
      process.exit(1);
    }

    const profile = await SpecialistProfile.findOneAndUpdate(
      { user_id: specialist._id },
      {
        user_id: specialist._id.toString(),
        full_name: 'Dr. Sarah Ahmed',
        designation: 'Clinical Psychologist',
        location: 'Karachi, Pakistan',
        hourly_rate: 500,
        currency: 'PKR',
        specializations: ['CBT', 'Anxiety', 'Depression'],
        languages: ['English', 'Urdu'],
        categories: ['Mindfulness & Meditation', 'Life Coaching'],
        rating: 0,
        total_reviews: 0,
        experience_years: 8,
        profile_photo: 'https://example.com/profile.jpg',
        education: [{
          degree: 'Ph.D. in Clinical Psychology',
          institute_name: 'University of Karachi'
        }],
        certifications: [{
          certificate_title: 'Licensed Clinical Psychologist',
          provider: 'Pakistan Psychological Association'
        }],
        profile_completed: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        is_verified: false,
      },
      { upsert: true, new: true }
    );

    console.log('✓ Specialist profile created:', profile._id.toString());
    await mongoose.disconnect();
    console.log('Profile created successfully!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createProfile();

