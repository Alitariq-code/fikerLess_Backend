# Specialist Registration & Profile Creation Flow

## Complete Flow Overview

### Step 1: Signup as Specialist
**Endpoint:** `POST /signup`

**Payload:**
```json
{
  "email": "drsarah@example.com",
  "password": "password123",
  "user_type": "specialist"
}
```

**Response:**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "email": "drsarah@example.com",
  "user_id": "..."
}
```

**What happens:**
- User account created with `user_type: "specialist"`
- OTP token generated and sent to email
- Account is NOT verified yet (`is_email_verified: false`)

---

### Step 2: Email Verification
**Endpoint:** `POST /email-verify`

**Payload:**
```json
{
  "token": "1234"  // OTP from email
}
```

**Response:**
```json
{
  "user_id": "...",
  "message": "OTP successfully verified!",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."  // JWT token
}
```

**What happens:**
- Email is verified (`is_email_verified: true`)
- JWT token is returned (use this for authenticated requests)

---

### Step 3: Login (After Profile Created)
**Endpoint:** `POST /login`

**Payload:**
```json
{
  "email": "drsarah@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user_id": "...",
  "email": "drsarah@example.com",
  "user_type": "specialist",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Note:** Login requires:
- Email to be verified ✅
- For specialists: Specialist profile must be completed ✅
- For regular users: Demographics must be completed ✅

---

### Step 4: Create Specialist Profile
**Endpoint:** `POST /api/v1/specialist/profile`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Payload (Basic Info - Step 1):**
```json
{
  "basic_info": {
    "full_name": "Dr. Sarah Ahmed",
    "designation": "Clinical Psychologist",
    "location": "Karachi, Pakistan",
    "hourly_rate": 500,
    "currency": "PKR",
    "specializations": ["CBT", "Anxiety"],
    "languages": ["English", "Urdu"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Specialist profile created successfully",
  "data": {
    "id": "...",
    "user_id": "...",
    "basic_info": {...},
    "education": [],
    "certifications": [],
    "profile_completed": false,
    "is_verified": false
  }
}
```

---

### Step 5: Update Profile with Education & Certifications
**Endpoint:** `PUT /api/v1/specialist/profile`

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Payload (Education & Certifications - Step 2):**
```json
{
  "education": [
    {
      "degree": "Ph.D. in Clinical Psychology",
      "institute_name": "University of Karachi"
    },
    {
      "degree": "M.Sc. in Psychology",
      "institute_name": "Karachi University"
    }
  ],
  "certifications": [
    {
      "certificate_title": "Licensed Clinical Psychologist",
      "provider": "Pakistan Psychological Association"
    },
    {
      "certificate_title": "CBT Certification",
      "provider": "International CBT Institute"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Specialist profile updated successfully",
  "data": {
    "id": "...",
    "basic_info": {...},
    "education": [...],
    "certifications": [...],
    "profile_completed": true,  // Auto-set to true when all fields filled
    "is_verified": false
  }
}
```

---

### Step 6: Get Profile
**Endpoint:** `GET /api/v1/specialist/profile`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "user_id": "...",
    "basic_info": {
      "full_name": "Dr. Sarah Ahmed",
      "designation": "Clinical Psychologist",
      "location": "Karachi, Pakistan",
      "hourly_rate": 500,
      "currency": "PKR",
      "specializations": ["CBT", "Anxiety"],
      "languages": ["English", "Urdu"]
    },
    "education": [...],
    "certifications": [...],
    "profile_completed": true,
    "is_verified": false,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

---

### Step 7: View All Specialists (Public)
**Endpoint:** `GET /api/v1/specialist/specialists`

**Query Parameters (Optional):**
- `?verified=true` - Only verified specialists
- `?location=Karachi` - Filter by location
- `?specialization=CBT` - Filter by specialization

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "user_id": "...",
      "basic_info": {...},
      "education": [...],
      "certifications": [...],
      "profile_completed": true,
      "is_verified": false
    }
  ]
}
```

---

## Complete Flow Summary

1. **Signup** → Get user_id, OTP sent to email
2. **Email Verify** → Get JWT token, email verified
3. **Create Profile (Basic Info)** → Profile created with basic information
4. **Update Profile (Education & Certifications)** → Complete profile
5. **Get Profile** → View own profile
6. **Get All Specialists** → Public listing (for users to find specialists)

---

## Important Notes

- **Signup & Login:** Same flow as regular users
- **Profile Creation:** Only specialists can create profiles (checked by `user_type`)
- **Profile Completion:** Auto-set to `true` when basic_info, education, and certifications are all provided
- **Verification:** `is_verified` is separate - set by admin later
- **Authentication:** All profile endpoints require JWT token (except GET all specialists)

---

## Error Cases

1. **Signup with existing email:** `Email already registered. Please login.`
2. **Create profile without specialist user_type:** `Only specialists can create specialist profiles`
3. **Create profile when already exists:** `Profile already exists. Use update endpoint.`
4. **Access without token:** `Please log in to access this feature`

