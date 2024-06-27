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

// Define DisplayData schema and model
const displayDataSchema = new mongoose.Schema({
  requestId: { type: String, required: true },
  requestDate: { type: Date, required: true },
  serviceType: { type: String, required: true },
  assignedTo: String,
  availedDate: { type: Date },
  daysOpen: Number,
  expectedTimeToClose: {type: Date},
  severity: String,
  status: String
});

const DisplayData = mongoose.model('DisplayData', displayDataSchema);

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
  Password: String,
  Username: String,
  Address: String,
  Bio: String
});

const User = mongoose.model('User', userSchema);

app.use(cors());
app.use(bodyParser.json());

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


// API route to fetch user profile by email
app.get('/api/profile', async (req, res) => {
  const email = req.query.email;
  try {
    const user = await User.findOne({ EmailAddress: email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// API route to update user profile
app.put('/api/profile', async (req, res) => {
  const { email, name, username, phone, address, bio } = req.body;
  try {
    const user = await User.findOneAndUpdate(
      { EmailAddress: email },
      { Name: name, Username: username, MobileNumber: phone, Address: address, Bio: bio },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});


app.get('/users/assigned', async (req, res) => {
  try {
    const users = await User.find({}, 'Name'); // Fetch only the Name field
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Route to handle form submission
app.post('/addbookservice/submit', async (req, res) => {
  try {
    const { name, phoneNumber, email, service, message } = req.body;

    // Get current date and time in Indian timezone
    const currentDate = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

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


// Function to start listening to changes in the BookService collection
async function startChangeStream() {
  try {
    // Define a change stream on the BookService collection
    const changeStream = BookService.watch();

    // Start listening to changes
    changeStream.on('change', async (change) => {
      try {
        console.log('Change detected in BookService:', change);

        // Handle insertions and updates
        if (change.operationType === 'insert' || change.operationType === 'update') {
          const newBooking = change.fullDocument || change.updateDescription.updatedFields;

          // Process and format data for DisplayData
          const reqDate = moment(newBooking.date, 'YYYY-MM-DD HH:mm:ss').toDate();
          if (isNaN(reqDate)) {
            console.error('Invalid Date:', newBooking.date);
            return;
          }
          const now = new Date();
          const diffTime = Math.abs(now - reqDate);
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

           // Count the documents in the BookService collection to generate a sequential ID
           const count = await BookService.countDocuments();
           const formattedRequestId = `SR-${String(count).padStart(2, '0')}`;

          const displayDataEntry = {
            requestId: formattedRequestId,
            requestDate: newBooking.date,
            serviceType: newBooking.service,
            assignedTo: newBooking.assignedTo || '',
            availedDate: '',
            daysOpen: diffDays,
            expectedTimeToClose: '',
            severity: newBooking.severity || '',
            status: 'new'
          };

          // Upsert into DisplayData collection based on requestId
          await DisplayData.updateOne(
            { requestId: formattedRequestId },
            { $set: displayDataEntry },
            { upsert: true }
          );

          console.log('DisplayData updated with new entry:', displayDataEntry);
        }
      } catch (error) {
        console.error('Error processing change:', error);
      }
    });

    console.log('Change stream started for BookService collection.');
  } catch (err) {
    console.error('Error setting up change stream:', err.message);
    throw err; // Re-throw error to handle it in the calling function
  }
}

// Call the function to start the change stream
startChangeStream();

app.get('/displaydata', async (req, res) => {
  try {
    const displayData = await DisplayData.find(); // Fetch all bookings

    // Format data before sending to frontend (if needed)
    const formattedData = displayData.map((item, index) => ({
      ...item.toObject(),
      
      requestId: `SR-${String(index + 1).padStart(2, '0')}`, // Format requestId as needed
      // Format requestDate using moment.js
      requestDate: moment(item.requestDate).format('YYYY-MM-DD HH:mm:ss'),
      daysOpen: calculateDaysOpen(item.requestDate), // Example function to calculate days open
      // Add more formatting as required
    }));

    res.json(formattedData); // Send the formatted data as JSON response
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle errors
  }
});

// Example function to calculate days open
function calculateDaysOpen(requestDate) {
  const now = new Date();
  const diffTime = Math.abs(now - requestDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Endpoint to get data by requestId
app.get('/request/:id', async (req, res) => {
  console.log(`Fetching request with ID: ${req.params.id}`); // Log request ID
  try {
    const request = await DisplayData.findOne({ requestId: req.params.id });
    if (!request) {
      console.log(`Request with ID: ${req.params.id} not found`);
      return res.status(404).send('Request not found');
    }
    res.send(request);
  } catch (error) {
    console.error(`Error fetching request with ID: ${req.params.id}`, error); // Log errors
    res.status(500).send(error);
  }
});


// Endpoint to update data by requestId
app.put('/request/:id', async (req, res) => {
  console.log(`Updating request with ID: ${req.params.id}`); // Log request ID
  try {
    const request = await DisplayData.findOneAndUpdate(
      { requestId: req.params.id },
      req.body,
      { new: true }
    );
    if (!request) {
      console.log(`Request with ID: ${req.params.id} not found`);
      return res.status(404).send('Request not found');
    }

    console.log(`Request with ID: ${req.params.id} updated successfully`);
    res.send(request);
  } catch (error) {
    console.error(`Error updating request with ID: ${req.params.id}`, error); // Log errors
    res.status(500).send(error);
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


// Route to fetch and display ticket details
app.get('/getTicketDetails/:id', async (req, res) => {
  try {
    const ticketId = req.params.id;
    const ticket = await TicketDetails.findOne({ ticketId: ticketId });

    // Fetch ticket details based on the provided ticketId
    // const ticketDetails = await TicketDetails.findOne({ ticketId });

    // Check if ticket details exist
    if (ticket) {
      res.json(ticket);
    } else {
      res.status(404).send('Ticket not found');
    }
  } catch (error) {
    console.error('Error fetching ticket details:', error);
    res.status(500).send('Internal Server Error');
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
