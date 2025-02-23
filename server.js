const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const Treatment = require('./models/Treatment');
const Appointment = require('./models/Appointment');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://rahul:rahul@cluster0.l5ugu.mongodb.net/ayurvedic-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Routes
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
  const appointment = new Appointment(req.body);
  try {
    const newAppointment = await appointment.save();
    res.status(201).json(newAppointment);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
