import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema, User, UserDocument } from '../src/models/schemas/user.schema';
import { DemographicsSchema, Demographics, DemographicsDocument } from '../src/models/schemas/demographics.schema';
import { generateUniqueUsername } from '../src/utils/utils';

// Sample demographics data
const demographicsTemplates = [
  {
    first_name: 'Ahmed',
    last_name: 'Khan',
    age_range: '25-34',
    gender_identity: 'Male',
    country_of_residence: 'Pakistan',
    relationship_status: 'Single',
    what_brings_you_here: ['Anxiety', 'Stress Management', 'Personal Growth'],
    goals_for_using_app: ['Manage anxiety', 'Improve sleep', 'Build confidence'],
    mental_health_diagnosis: 'Anxiety Disorder',
    diagnosed_conditions: ['Generalized Anxiety Disorder'],
    seeing_professional: 'Yes, currently',
    suicidal_thoughts: 'Never',
    exercise_frequency: '3-4 times per week',
    substance_use: 'Never',
    support_system: 'Family and friends',
    preferred_support_type: ['Individual Therapy', 'Support Groups'],
    preferred_therapist_gender: 'No preference',
    preferred_language: 'English',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Fatima',
    last_name: 'Ali',
    age_range: '18-24',
    gender_identity: 'Female',
    country_of_residence: 'Pakistan',
    relationship_status: 'In a relationship',
    what_brings_you_here: ['Depression', 'Self-Care'],
    goals_for_using_app: ['Improve mood', 'Develop coping strategies', 'Self-care routine'],
    mental_health_diagnosis: 'Major Depressive Disorder',
    diagnosed_conditions: ['Depression'],
    seeing_professional: 'Yes, previously',
    suicidal_thoughts: 'Rarely',
    exercise_frequency: '1-2 times per week',
    substance_use: 'Never',
    support_system: 'Partner and close friends',
    preferred_support_type: ['Individual Therapy', 'Mindfulness'],
    preferred_therapist_gender: 'Female',
    preferred_language: 'Urdu',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Hassan',
    last_name: 'Raza',
    age_range: '35-44',
    gender_identity: 'Male',
    country_of_residence: 'Pakistan',
    relationship_status: 'Married',
    what_brings_you_here: ['Work-Life Balance', 'Stress Management'],
    goals_for_using_app: ['Reduce stress', 'Better work-life balance', 'Improve relationships'],
    mental_health_diagnosis: 'None',
    diagnosed_conditions: [],
    seeing_professional: 'No',
    suicidal_thoughts: 'Never',
    exercise_frequency: '5+ times per week',
    substance_use: 'Occasionally',
    support_system: 'Spouse',
    preferred_support_type: ['Self-help resources', 'Meditation'],
    preferred_therapist_gender: 'No preference',
    preferred_language: 'English',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Ayesha',
    last_name: 'Malik',
    age_range: '25-34',
    gender_identity: 'Female',
    country_of_residence: 'Pakistan',
    relationship_status: 'Single',
    what_brings_you_here: ['Trauma Healing', 'Personal Growth'],
    goals_for_using_app: ['Process trauma', 'Build resilience', 'Self-discovery'],
    mental_health_diagnosis: 'PTSD',
    diagnosed_conditions: ['Post-Traumatic Stress Disorder'],
    seeing_professional: 'Yes, currently',
    suicidal_thoughts: 'Sometimes',
    exercise_frequency: '2-3 times per week',
    substance_use: 'Never',
    support_system: 'Therapist and support group',
    preferred_support_type: ['Individual Therapy', 'Trauma-focused therapy'],
    preferred_therapist_gender: 'Female',
    preferred_language: 'English',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Usman',
    last_name: 'Ahmed',
    age_range: '18-24',
    gender_identity: 'Male',
    country_of_residence: 'Pakistan',
    relationship_status: 'Single',
    what_brings_you_here: ['Anxiety', 'Social Anxiety'],
    goals_for_using_app: ['Overcome social anxiety', 'Build confidence', 'Make friends'],
    mental_health_diagnosis: 'Social Anxiety Disorder',
    diagnosed_conditions: ['Social Anxiety'],
    seeing_professional: 'No',
    suicidal_thoughts: 'Never',
    exercise_frequency: 'Rarely',
    substance_use: 'Never',
    support_system: 'Online communities',
    preferred_support_type: ['Online therapy', 'Self-help resources'],
    preferred_therapist_gender: 'No preference',
    preferred_language: 'Urdu',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Zainab',
    last_name: 'Hussain',
    age_range: '35-44',
    gender_identity: 'Female',
    country_of_residence: 'Pakistan',
    relationship_status: 'Married',
    what_brings_you_here: ['Parenting & Family', 'Stress Management'],
    goals_for_using_app: ['Parenting support', 'Manage family stress', 'Self-care'],
    mental_health_diagnosis: 'None',
    diagnosed_conditions: [],
    seeing_professional: 'No',
    suicidal_thoughts: 'Never',
    exercise_frequency: '1-2 times per week',
    substance_use: 'Never',
    support_system: 'Family',
    preferred_support_type: ['Family therapy', 'Support groups'],
    preferred_therapist_gender: 'Female',
    preferred_language: 'Urdu',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Bilal',
    last_name: 'Iqbal',
    age_range: '25-34',
    gender_identity: 'Male',
    country_of_residence: 'Pakistan',
    relationship_status: 'In a relationship',
    what_brings_you_here: ['Addiction Recovery', 'Personal Growth'],
    goals_for_using_app: ['Maintain sobriety', 'Build healthy habits', 'Repair relationships'],
    mental_health_diagnosis: 'Substance Use Disorder',
    diagnosed_conditions: ['Alcohol Use Disorder'],
    seeing_professional: 'Yes, currently',
    suicidal_thoughts: 'Rarely',
    exercise_frequency: '3-4 times per week',
    substance_use: 'In recovery',
    support_system: 'Recovery group and sponsor',
    preferred_support_type: ['Group therapy', '12-step programs'],
    preferred_therapist_gender: 'No preference',
    preferred_language: 'English',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Sana',
    last_name: 'Shah',
    age_range: '18-24',
    gender_identity: 'Female',
    country_of_residence: 'Pakistan',
    relationship_status: 'Single',
    what_brings_you_here: ['Depression', 'Self-Care', 'Relationships'],
    goals_for_using_app: ['Improve self-esteem', 'Better relationships', 'Self-love'],
    mental_health_diagnosis: 'Depression',
    diagnosed_conditions: ['Major Depressive Disorder'],
    seeing_professional: 'Yes, previously',
    suicidal_thoughts: 'Sometimes',
    exercise_frequency: 'Rarely',
    substance_use: 'Never',
    support_system: 'Close friends',
    preferred_support_type: ['Individual Therapy', 'Art therapy'],
    preferred_therapist_gender: 'Female',
    preferred_language: 'English',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Omar',
    last_name: 'Butt',
    age_range: '35-44',
    gender_identity: 'Male',
    country_of_residence: 'Pakistan',
    relationship_status: 'Married',
    what_brings_you_here: ['Grief & Loss', 'Trauma Healing'],
    goals_for_using_app: ['Process grief', 'Find meaning', 'Move forward'],
    mental_health_diagnosis: 'None',
    diagnosed_conditions: [],
    seeing_professional: 'Yes, currently',
    suicidal_thoughts: 'Rarely',
    exercise_frequency: '2-3 times per week',
    substance_use: 'Never',
    support_system: 'Family and therapist',
    preferred_support_type: ['Grief counseling', 'Individual Therapy'],
    preferred_therapist_gender: 'No preference',
    preferred_language: 'Urdu',
    understands_emergency_disclaimer: true,
  },
  {
    first_name: 'Nida',
    last_name: 'Rashid',
    age_range: '25-34',
    gender_identity: 'Female',
    country_of_residence: 'Pakistan',
    relationship_status: 'Single',
    what_brings_you_here: ['Mindfulness', 'Meditation', 'Personal Growth'],
    goals_for_using_app: ['Develop mindfulness', 'Reduce stress', 'Inner peace'],
    mental_health_diagnosis: 'None',
    diagnosed_conditions: [],
    seeing_professional: 'No',
    suicidal_thoughts: 'Never',
    exercise_frequency: 'Daily',
    substance_use: 'Never',
    support_system: 'Meditation group',
    preferred_support_type: ['Mindfulness programs', 'Meditation'],
    preferred_therapist_gender: 'No preference',
    preferred_language: 'English',
    understands_emergency_disclaimer: true,
  },
];

async function createDummyUsers() {
  try {
    // Connect to MongoDB
    const host = process.env.MONGODB_HOST || 'localhost';
    const port = process.env.MONGODB_PORT || 27017;
    const db = process.env.MONGODB_DB || process.env.MONGODB_DATABASE || 'fikrless';
    const username = process.env.MONGODB_USERNAME;
    const password = process.env.MONGODB_PASSWORD;

    let uri = `mongodb://${host}:${port}/${db}`;

    if (username && password) {
      uri = `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${db}?authSource=admin`;
    }

    console.log(`Connecting to MongoDB: ${uri.replace(/:[^:@]+@/, ':****@')}`);
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    // Create models
    const UserModel = mongoose.model<UserDocument>('User', UserSchema);
    const DemographicsModel = mongoose.model<DemographicsDocument>('Demographics', DemographicsSchema);

    const defaultPassword = 'User@123'; // Default password for all dummy users
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Create 10 users (mix of regular users and specialists)
    for (let i = 0; i < 10; i++) {
      const template = demographicsTemplates[i];
      const email = `user${i + 1}@fikrless.com`;
      const userType = i < 7 ? 'user' : 'specialist'; // First 7 are users, last 3 are specialists

      // Check if user already exists
      let user = await UserModel.findOne({ email }).exec();

      if (user) {
        console.log(`⏭️  User ${i + 1}: ${email} already exists, skipping...`);
        skippedCount++;
        continue;
      }

      // Generate username
      const username = await generateUniqueUsername(
        template.first_name,
        template.last_name,
        email,
        UserModel
      );

      // Create user
      user = new UserModel({
        email,
        password: hashedPassword,
        user_type: userType,
        is_email_verified: true,
        username,
        first_name: template.first_name,
        last_name: template.last_name,
        phone_number: `+92${3000000000 + i}`,
        has_demographics: false, // Will be set to true after demographics are saved
        is_disabled: false,
      });

      await user.save();
      console.log(`✅ Created user ${i + 1}: ${email} (${userType})`);

      // Create demographics
      const demographics = new DemographicsModel({
        user_id: user._id,
        age_range: template.age_range,
        gender_identity: template.gender_identity,
        country_of_residence: template.country_of_residence,
        relationship_status: template.relationship_status,
        what_brings_you_here: template.what_brings_you_here,
        goals_for_using_app: template.goals_for_using_app,
        mental_health_diagnosis: template.mental_health_diagnosis,
        diagnosed_conditions: template.diagnosed_conditions,
        seeing_professional: template.seeing_professional,
        suicidal_thoughts: template.suicidal_thoughts,
        exercise_frequency: template.exercise_frequency,
        substance_use: template.substance_use,
        support_system: template.support_system,
        preferred_support_type: template.preferred_support_type,
        preferred_therapist_gender: template.preferred_therapist_gender,
        preferred_language: template.preferred_language,
        understands_emergency_disclaimer: template.understands_emergency_disclaimer,
      });

      await demographics.save();

      // Update user to mark demographics as complete
      user.has_demographics = true;
      await user.save();

      console.log(`   📋 Demographics added for ${email}`);
      createdCount++;
    }

    console.log('\n📊 Summary:');
    console.log(`   ✅ Created: ${createdCount} users`);
    console.log(`   ⏭️  Skipped: ${skippedCount} users (already exist)`);
    console.log(`\n🔑 Default password for all users: ${defaultPassword}`);
    console.log('⚠️  Please change passwords after first login!\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error creating dummy users:', error);
    process.exit(1);
  }
}

// Run the script
createDummyUsers();

