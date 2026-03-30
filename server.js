require('dotenv').config();

// 1. Import the express library
const express = require('express');

// 2. Initialize the application
const app = express();

// 3. Define a "Port" (The door the server listens on)
const PORT = process.env.PORT || 3000;

const bookData = {
  "name": "The way of Kings",
  "author": "Spielberg",
  "tags": ["Fantasy", "Dark", "Adventure"],
  "stock": {
      "quantity": 23,
      "isAvailable": true
    }
}

// This is a custom middleware function
app.use((req, res, next) => {
  const time = new Date().toLocaleTimeString();
  console.log(`[${time}] ${req.method} request to ${req.url}`);
  
  // CRITICAL: You must call next() or the request will hang forever!
  next(); 
});

const gatekeeper = (req, res, next) => {
  const adminKey = req.get('admin-key');
  
  // Use the secret from your .env file
  const validKey = process.env.ADMIN_SECRET || "12345"; 

  if (adminKey === validKey) {
    return next(); // 'return' ensures no other code in this function runs
  }

  // Providing a clear reason for the failure is great for API consumers
  return res.status(403).json({ 
    success: false,
    message: "Access Denied: Invalid or missing admin-key" 
  });
};


// Built-in Middleware to handle JSON data from clients
app.use(express.json());

// Another middleware
app.get('/secret-vault', gatekeeper, (req, res) => {

  res.status(200).json({ "data": "This is top secret gold!" })
})

// 4. Create your first Route (GET request to the home path '/')
app.get('/', (req, res) => {
  // req = Request (what the client sent)
  // res = Response (what we send back)
  res.status(200).json({
    message: "Welcome to my first production API! You have finally installed Nodemon",
    status: "Success"
  });
});

app.get('/book', (req, res) => {
  res.status(200).json(bookData)
})
app.get('/admin', (req, res) => {
  res.status(403).json("Access Denied")
})

app.get('/config', (req, res) => {
  res.json({
    port_used: PORT,
    message: "Secrets are safe!"
  });
});

// 5. Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});