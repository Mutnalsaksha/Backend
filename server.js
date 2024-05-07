const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://saksha:1234@cluster0.xnvkwgq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useUnifiedTopology: true, useNewUrlParser: true});

// Define MongoDB schema and model
const bookserviceSchema = new mongoose.Schema({
  date: {type: String, default: () => new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })  },
  name: { type: String, required: true, minlength:3, maxlength:30},
  phoneNumber: {type: String, required: true,  match: /^[0-9]{10}$/ },
  email: { type: String, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  service:  {type: String, required: true},
  message: { type: String, minlength: 0, maxlength: 500,},
},{
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

bookserviceSchema.virtual('formattedDate').get(function () {
  // You can adjust the formatting options as needed
  return new Date(this.date).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
});


const BookService = mongoose.model('BookService', bookserviceSchema);

//Use cors middleware
app.use(cors());

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// CORS middleware to allow cross-origin requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Middleware to set Content-Type for JavaScript files
app.use(express.static('public', { 
  setHeaders: (res, path, stat) => {
      if (path.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript');
      }
  }
}));

// Route to handle form submission
app.post('/addbookservice/submit', async (req, res) => {
  try {
    const { name, phoneNumber, email, service, message } = req.body;

    const newBooking = new BookService({
      date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 
      name: name,
      phoneNumber: phoneNumber,
      email: email,
      service: service,
      message: message,
    });

    const savedContact = await newBooking.save();

    res.status(201).json(savedContact);
  } catch (error) {
    //console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


let count = 0;

const displayDataSchema = new mongoose.Schema({
  requestId: { type: String, required: true },
  requestDate: { type: Date, required: true },
  availedDate: { type: Date },
  serviceType: { type: String, required: true },
  assignedTo: String,
  status: String,
  daysOpen: Number,
  expectedTimeToClose: String,
  severity: String
});

displayDataSchema.pre('save', function(next) {
  const shortId = Math.floor(Math.random() * 100).toString(); // generate a random 2-digit ID
  this.requestId = shortId;
  next();
});


const DisplayData = mongoose.model('DisplayData', displayDataSchema);

module.exports = DisplayData;

app.get('/displaydata', async (req, res) => {
  try {
      const bookings = await BookService.find();
      const displayData = bookings.map(booking => {
          const now = new Date();
          const reqDate = new Date(booking.date);
          const diffTime = Math.abs(now - reqDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return {
              requestId: booking._id, // assuming _id is the unique ID generated by MongoDB
              requestDate: reqDate,
              availedDate: null, // You need to fill this based on your logic
              serviceType: booking.service,
              assignedTo: booking.assignedTo,
              status: booking.status,
              daysOpen: diffDays,
              expectedTimeToClose: null, // You need to fill this based on your logic
              severity: booking.severity
          };
      });
      res.json(displayData);
  } catch (err) {
      res.status(500).json({ message: err.message });
  }
});


// Simple route for the root path
app.get('/', (req, res) => {
  res.send('Welcome to your server!');
});

// Start the server
app.listen(PORT, () => {
  //console.log(`Server is running on port ${PORT}`);
});