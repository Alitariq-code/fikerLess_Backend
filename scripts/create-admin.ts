import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserSchema, User, UserDocument } from '../src/models/schemas/user.schema';
import { generateUniqueUsername } from '../src/utils/utils';

async function createAdmin() {
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
    console.log('✅ Connected to MongoDB');

    // Get admin credentials from environment or use defaults
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@fikrless.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

    // Create User model
    const UserModel = mongoose.model<UserDocument>('User', UserSchema);

    // Check if admin already exists
    const existingAdmin = await UserModel.findOne({ email: adminEmail }).exec();
    
    if (existingAdmin) {
      if (existingAdmin.user_type === 'admin') {
        console.log('✅ Admin user already exists!');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   User Type: ${existingAdmin.user_type}`);
        console.log(`   User ID: ${existingAdmin._id}`);
        await mongoose.disconnect();
        return;
      } else {
        // Update existing user to admin
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        existingAdmin.password = hashedPassword;
        existingAdmin.user_type = 'admin';
        existingAdmin.is_email_verified = true;
        await existingAdmin.save();
        console.log('✅ Updated existing user to admin!');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${adminPassword}`);
        await mongoose.disconnect();
        return;
      }
    }

    // Create new admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const adminUsername = await generateUniqueUsername('Admin', 'User', adminEmail, UserModel);

    const adminUser = new UserModel({
      email: adminEmail,
      password: hashedPassword,
      user_type: 'admin',
      is_email_verified: true,
      username: adminUsername,
      first_name: 'Admin',
      last_name: 'User',
    });

    await adminUser.save();

    console.log('\n✅ Admin user created successfully!');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   User Type: admin`);
    console.log(`   User ID: ${adminUser._id}`);
    console.log('\n⚠️  Please change the default password after first login!');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error: any) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the script
createAdmin();

