// 1. Import the express library
const express = require('express');

// 2. Initialize the application
const app = express();

// 3. Define a "Port" (The door the server listens on)
const PORT = 3000;

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
  res.status(200).json({
    "name": "The way of Kings",
    "author": "Spielberg",
    "tags": ["Fantasy", "Dark", "Adventure"],
    "stock": {
        "quantity": 23,
        "isAvailable": true
      }
  })
})

// 5. Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});