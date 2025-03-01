const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Treatment = require('./models/Treatment');
const Appointment = require('./models/Appointment');

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://rahul:rahul@cluster0.l5ugu.mongodb.net/ayurvedic-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Add to server.js
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Cloudinary configuration
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

console.log('Cloudinary Config:', {
  cloud_name: cloudinaryConfig.cloud_name,
  api_key: cloudinaryConfig.api_key,
  api_secret: cloudinaryConfig.api_secret ? '***' : 'missing'
});

cloudinary.config(cloudinaryConfig);

// Update userSchema in server.js
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  profilePhoto: String
});
const User = mongoose.model('User', userSchema);

// Authentication middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Please authenticate' });
  }
};

// Apply auth middleware to protected routes
app.use('/api/profile', auth);
app.use('/api/upload-profile-photo', auth);

// Profile photo upload endpoint
app.post('/api/upload-profile-photo', auth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    // Create a unique filename
    const uniqueFilename = `profile_${req.user.id}_${Date.now()}`;

    // Convert buffer to base64 and create data URI
    const base64String = req.file.buffer.toString('base64');
    const uploadStr = `data:${req.file.mimetype};base64,${base64String}`;

    // Prepare upload options
    const uploadOptions = {
      folder: 'profile_photos',
      public_id: uniqueFilename,
      overwrite: true,
      resource_type: 'auto'
    };

    console.log('Attempting upload with options:', uploadOptions);

    const result = await cloudinary.uploader.upload(uploadStr, uploadOptions);

    console.log('Upload successful:', result.secure_url);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePhoto: result.secure_url },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      imageUrl: result.secure_url,
      message: 'Profile photo updated successfully',
      user: user
    });
  } catch (error) {
    console.error('Upload error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });

    res.status(500).json({ 
      message: 'Error uploading image. Please try again.',
      error: error.message 
    });
  }
});

// Get profile endpoint
app.get('/api/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
    console.log(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'your-secret-key');
    res.json({ 
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email,
        profilePhoto: user.profilePhoto 
      } 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Treatments
app.get('/api/treatments', async (req, res) => {
  try {
    const treatments = await Treatment.find();
    res.json(treatments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/treatments', async (req, res) => {
  const treatment = new Treatment(req.body);
  try {
    const newTreatment = await treatment.save();
    res.status(201).json(newTreatment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/treatments/:id', async (req, res) => {
  try {
    const treatment = await Treatment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(treatment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Appointments
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await Appointment.find().sort({ date: 1 });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { name, email, phone, date, time, treatment, message } = req.body;

    // Convert time string ("04:00:00") into a valid Date object
    const formattedTime = new Date(`1970-01-01T${time}`);

    const appointment = new Appointment({
      name,
      email,
      phone,
      date: new Date(date), // Convert to Date object
      time: formattedTime, // Store valid Date object
      treatment,
      message
    });

    await appointment.save();
    res.status(201).json({ message: 'Appointment booked successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});



app.patch('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await Appointment.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    res.json(appointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});