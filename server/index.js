const dotenv = require('dotenv');
const path = require('path');
const app = require('./src/app');
const connectDB = require('./src/config/db');

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing in environment variables.');
    }

    await connectDB();
    console.log('Connected to MongoDB Atlas');

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
}

startServer();
