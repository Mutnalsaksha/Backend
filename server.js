//hms website backend
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect('mongodb+srv://saksha:1234@cluster0.xnvkwgq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { useUnifiedTopology: true, useNewUrlParser: true});
const db = mongoose.connection;

// Define MongoDB schema and model for ticket details
const ticketDetailsSchema = new mongoose.Schema({
  ticketId: { type: Number, required: true, unique: true },
  assignedTo: { type: String, required: true },
  availedDate: { type: Date, required: true },
  expectedTimeToClose: { type: String, required: true },
  severity: { type: String, required: true },
  status: { type: String, required: true }
});

const TicketDetails = mongoose.model('TicketDetails', ticketDetailsSchema);
module.exports = TicketDetails;



// Define MongoDB schema and model
const bookserviceSchema = new mongoose.Schema({
  // date: {type: String, default: () => new Date().toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })  },
  date: { type: String, required: true},
  name: { type: String, required: true, minlength:3, maxlength:30},
  phoneNumber: {type: String, required: true,  match: /^[0-9]{10}$/ },
  email: { type: String, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  service:  {type: String, required: true},
  message: { type: String, minlength: 0, maxlength: 500,},
},{
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
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

// Login endpoint
// Define user schema
const userSchema = new mongoose.Schema({
  Name: String,
  Usertype: String,
  MobileNumber: String,
  EmailAddress: String,
  Password: String 
});

const User = mongoose.model('User', userSchema);

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await User.findOne({ EmailAddress :email });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    if (user.Password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Authentication successful
    res.json({ message: 'Login successful', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Route to handle form submission
app.post('/addbookservice/submit', async (req, res) => {
  try {
    const { name, phoneNumber, email, service, message } = req.body;

    // Get current date and time in Indian timezone
    const currentDate = moment().tz('Asia/Kolkata').format('YYYY/MM/DD HH:mm:ss');

    const newBooking = new BookService({
      date: currentDate, 
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


const displayDataSchema = new mongoose.Schema({
  requestId: { type: String, required: true },
  requestDate: { type: Date, required: true },
  serviceType: { type: String, required: true },
  assignedTo: String,
  availedDate: { type: Date },
  daysOpen: Number,
  expectedTimeToClose: String,
  severity: String,
  status: String
});

let count = 0; // Define a counter variable outside the pre-save hook

displayDataSchema.pre('save', function(next) {
  this.requestId = ++count; // Increment and assign sequential ID
  next();
});

const DisplayData = mongoose.model('DisplayData', displayDataSchema);

module.exports = DisplayData;

app.get('/displaydata', async (req, res) => {
  try {
    const bookings = await BookService.find(); // Fetch all bookings
    const displayData = bookings.map((booking, index) => {
      const reqDate = moment(booking.date, 'YYYY/MM/DD HH:mm:ss').toDate();// Convert request date to a Date object
      // const formattedDate = formatDate(reqDate); // Format date
      if (isNaN(reqDate)) {
        console.error('Invalid Date:', booking.date);
      }
      const now = new Date(); // Get the current date and time

      // Calculate the difference in milliseconds between the current date and the request date
      const diffTime = Math.abs(now - reqDate);

      // Convert the difference in milliseconds to days
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      console.log('Current Date:', now);
      console.log('Request Date:', reqDate);
      console.log('Number of open days:', diffDays);


      return {
        requestId: index + 1, // Assuming _id is the unique ID generated by MongoDB
        requestDate: booking.date,
        serviceType: booking.service,
        assignedTo: booking.assignedTo|| '',
        availedDate: '',
        daysOpen: diffDays, // Number of days the request has been open
        expectedTimeToClose: '', // You need to fill this based on your logic
        severity: booking.severity|| '',
        status: booking.status|| ''
      };

    });

    res.json(displayData); // Send the formatted data as JSON response
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle errors
  }
});

// Helper method to format date
function formatDate(date) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  };
  return date.toLocaleString('en-IN', options).replace(/\//g, '-');
}


// Route to handle ticket details submission
app.post('/addticketdetails', async (req, res) => {
  try {
    const { ticketId, assignedTo, availedDate, expectedTimeToClose, severity, status } = req.body;

    // Check if the ticketId already exists in the database
    const existingTicket = await TicketDetails.findOne({ ticketId });

    if (existingTicket) {
      return res.status(400).json({ error: 'Ticket already exists' });
    }

    // Create a new ticket details object
    const newTicketDetails = new TicketDetails({
      ticketId,
      assignedTo,
      availedDate,
      expectedTimeToClose,
      severity,
      status
    });

    // Save the new ticket details to the database
    const savedTicketDetails = await newTicketDetails.save();

    // Return the saved ticket details
    res.status(201).json(savedTicketDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route to fetch and display ticket details
app.get('/getTicketDetails/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;

    // Fetch ticket details based on the provided ticketId
    const ticketDetails = await TicketDetails.findOne({ ticketId });

    // Check if ticket details exist
    if (!ticketDetails) {
      return res.status(404).json({ error: 'Ticket details not found' });
    }

    // Return the fetched ticket details
    res.json(ticketDetails);
  } catch (err) {
    res.status(500).json({ error: err.message }); // Handle errors
  }
});

// Add this route in your backend (app.js or index.js)
app.get('/api/bookservice/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const booking = await BookService.findById(bookingId, 'date service');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
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
