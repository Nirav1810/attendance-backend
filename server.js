// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // Ensure CORS is enabled

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(cors()); // Enable CORS for all routes

// --- 1. CONNECT TO MONGODB ---
const MONGO_URI = "mongodb+srv://niravsurati05:Nirav%40181004@cluster0.kpktgxx.mongodb.net/attendanceApp?retryWrites=true&w=majority&appName=Cluster0";

console.log("Attempting to connect with URI:", MONGO_URI);

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB Atlas!'))
    .catch(err => {
        console.error('--- CONNECTION FAILED ---');
        console.error('Error Details:', err);
        console.error('--------------------------');
        console.error('Troubleshooting Tips:');
        console.error('1. Is the MONGO_URI in server.js correct? Check for typos.');
        console.error('2. Did you replace `<password>` with your actual password?');
        // Add a note about IP address for the user's reference.
        console.error('3. Is your current IP address on the "Network Access" list in MongoDB Atlas?');
    });


// --- 2. DEFINE THE CLASSROOM SCHEMA ---
const classroomSchema = new mongoose.Schema({
    name: { type: String, required: true },
    boundary: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]],
            required: true
        }
    }
});

// --- 3. CREATE THE CRITICAL 2DSPHERE INDEX ---
classroomSchema.index({ boundary: '2dsphere' });

const Classroom = mongoose.model('Classroom', classroomSchema);


// --- 4. API ENDPOINTS ---

app.post('/api/setup-classroom', async (req, res) => {
    console.log('Setting up a new classroom...');
    try {
        // Define a sample classroom boundary (e.g., around a specific building or area)
        // This polygon represents a small square area.
        // Coordinates are [longitude, latitude]
        const homeOfficePolygon = {
            type: "Polygon",
            coordinates: [
                [
                    [72.849000, 21.240700], // Example point 1 (longitude, latitude)
                    [72.849000, 21.240900], // Example point 2
                    [72.849200, 21.240900], // Example point 3
                    [72.849200, 21.240700], // Example point 4
                    [72.849000, 21.240700]  // Closing point (same as point 1)
                ]
            ]
        };

        const newClassroom = new Classroom({
            name: "My Home Office (Test Classroom)",
            boundary: homeOfficePolygon
        });

        await newClassroom.save();
        console.log('Classroom saved:', newClassroom);
        res.status(201).json({
            message: "Test classroom created successfully! You can now verify your location against this classroom.",
            classroomId: newClassroom._id
        });

    } catch (error) {
        console.error("Error setting up classroom:", error);
        res.status(500).json({ message: "Error creating classroom", error: error.message });
    }
});

app.post('/api/check-attendance', async (req, res) => {
    const { classroomId, latitude, longitude, accuracy } = req.body;

    if (!classroomId || !latitude || !longitude || accuracy === undefined) {
        return res.status(400).json({ message: "Missing required fields: classroomId, latitude, longitude, accuracy." });
    }

    // --- ADJUSTED FOR HIGH ACCURACY REQUIREMENT ---
    // Reverted MAX_ALLOWED_ACCURACY to a lower value (e.g., 25 meters).
    // A lower number means higher precision is required for the GPS signal.
    const MAX_ALLOWED_ACCURACY = 15; // Reverted to 25 meters for high accuracy
    // --- END ADJUSTMENT ---

    if (accuracy > MAX_ALLOWED_ACCURACY) {
        return res.status(400).json({
            success: false,
            message: `GPS signal too inaccurate (Accuracy: ${accuracy}m). Please try again. Required accuracy: ${MAX_ALLOWED_ACCURACY}m.`
        });
    }

    try {
        const studentLocationPoint = {
            type: "Point",
            coordinates: [longitude, latitude]
        };

        const query = {
            _id: classroomId,
            boundary: {
                $geoIntersects: {
                    $geometry: studentLocationPoint
                }
            }
        };

        const classroomFound = await Classroom.findOne(query);

        if (classroomFound) {
            res.json({ success: true, message: 'Verification SUCCESS: You are inside the classroom boundary.' });
        } else {
            res.status(400).json({ success: false, message: 'Verification FAILED: You are not inside the classroom boundary.' });
        }

    } catch (error) {
        console.error("Error during attendance check:", error);
        res.status(500).json({ message: "Server error during attendance check." });
    }
});


// --- 5. START THE SERVER ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
