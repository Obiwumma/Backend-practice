require('dotenv').config();


// 1. Import the express library
const express = require('express');

const db = require('./db');

const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt')

const rateLimit = require('express-rate-limit');

const { z } = require('zod');

// 2. Initialize the application
const app = express();

// 3. Define a "Port" (The door the server listens on)
const PORT = process.env.PORT || 3000;

// Built-in Middleware to handle JSON data from clients
app.use(express.json());

const bookData = {
  "name": "The way of Kings",
  "author": "Spielberg",
  "tags": ["Fantasy", "Dark", "Adventure"],
  "stock": {
      "quantity": 23,
      "isAvailable": true
    }
}

const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  price: z.number().positive("Price must be a positive number"),
  description: z.string().optional(), // It's okay if they leave this blank
  quantity: z.number().int().nonnegative("Quantity cannot be negative")
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per `window` (here, per 15 minutes)
  message: { error: "Too many login attempts from this IP, please try again after 15 minutes" },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

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


// JWT middleware

const authenticateToken = (req, res, next) => {
  // 1. Get the token from the request headers
  // The standard format is: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Splits "Bearer" and the token

  if (!token) {
    return res.status(401).json({ error: "Access Denied: No token provided" });
  }

  // 2. Verify the token using your secret
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // If the token is expired or was tampered with by a hacker!
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    // 3. Attach the decoded user data to the request so routes can use it
    req.user = user; 
    next(); // Let them pass!
  });
};

// Another middleware
app.get('/secret-vault', gatekeeper, (req, res) => {

  res.status(200).json({ "data": "This is top secret gold!" })
})

// ZOD middleawre
const validateProduct = (req, res, next) => {
  try {
    // Zod tries to fit the request body into the blueprint
    productSchema.parse(req.body);
    
    // If it succeeds, let them pass to the route!
    next(); 
  } catch (error) {
    // If Zod catches an error, it throws an exception.
    // We catch it and send a 400 Bad Request back to the user.
    return res.status(400).json({ 
      error: "Validation failed", 
      details: error.errors 
    });
  }
};

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

app.get('/status', async (req, res) => {
  try {
    const result = await db.query('SELECT NOW()');
    res.json({
      status: 'Online',
      serverTime: result.rows[0].now
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.post('/products', validateProduct, async (req, res) => {
  try {
    // 1. Get the data from the request body
    const { name, price, description, quantity } = req.body;

    // 2. Check if the database connection (pool) is actually working
    // We use $1, $2, etc. to prevent "SQL Injection" (A major security risk)
    const query = `
      INSERT INTO products (name, price, description, quantity)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [name, price, description, quantity];
    
    const result = await db.query(query, values);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    // 3. Log the ACTUAL error to your terminal so you can see it!
    console.error("DATABASE ERROR:", error.message); 
    res.status(500).json({ error: error.message }); // Send the real error to Thunder Client for now
  }
});

app.get('/products', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.status(200).json(result.rows);
    // In production, we send an empty array [] if no items exist, 
    // rather than an error.
  } catch (error) {
    console.error("DATABASE ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// The ':id' is a placeholder for whatever number the user types in the URL
app.get('/products/:id', async (req, res) => {
  const { id } = req.params; // Extract the ID from the URL
  try {
    const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, price, description, quantity } = req.body;

  try {
    const query = `
      UPDATE products 
      SET name = $1, price = $2, description = $3, quantity = $4
      WHERE id = $5
      RETURNING *;
    `;
    const result = await db.query(query, [name, price, description, quantity, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found to update" });
    }

    res.json({ message: "Update successful!", product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
})

app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully", deletedProduct: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// Working on Authentincation

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Hash the password
    // "10" is the salt rounds. It determines how complex the math is.
    // 10 is the standard balance between security and speed.
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Save the user to the database
    const query = `
      INSERT INTO users (email, password_hash) 
      VALUES ($1, $2) 
      RETURNING id, email, role, created_at; 
      -- Notice we purposefully leave out password_hash in the RETURNING clause!
    `;

    const result = await db.query(query, [email, hashedPassword])

    res.status(201).json({ 
      message: "User registered successfully!", 
      user: result.rows[0] 
    });

  } catch (error) {
    // '23505' is the specific PostgreSQL error code for "Unique Violation"
    if (error.code === '23505') {
      return res.status(400).json({ error: "An account with this email already exists." });
    }
    console.error(error);
    res.status(500).json({ error: error });
  }
})

app.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Check if the user exists
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      // SECURITY TIP: Never say "Email not found". It helps hackers guess emails.
      // Always use a generic "Invalid credentials".
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // 2. Check if the password is correct
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 3. Create the JWT (The Passport)
    const payload = { userId: user.id, role: user.role };
    
    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' } // The passport expires in 1 hour
    );

    // 4. Send the token to the user
    res.json({
      message: "Login successful!",
      token: token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Login failed" });
  }
});

//Get profile route 

app.get('/profile', authenticateToken, async (req, res) => {
  try {
    // We know req.user.userId exists because our middleware decoded it!
    const result = await db.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.userId]);
    
    res.json({
      message: "Welcome to your private profile!",
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});


// 5. Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});