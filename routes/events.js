const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const Event = require('../models/Event'); // Adjust path as per your project

// Multer Storage

const bodyParser = require('body-parser');

const app = express();

app.use(express.json()); // For parsing JSON
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(bodyParser.json()); // Ensures JSON body parsing


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads')); // Ensure correct path
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Upload Event Image
router.post('/events/:id/upload', upload.single('eventImage'), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).send('Event not found');

        event.images.push(req.file.filename);
        await event.save();
        res.redirect(`/event/${req.params.id}`);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Get Event Images
router.get('/events/:id/images', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json({ images: event.images }); // Sends image paths stored in DB
    } catch (error) {
        console.error('Error fetching event images:', error);
        res.status(500).json({ message: 'Server error' });
    }
});



// Remove an image
router.post('/events/:id/remove-image', async (req, res) => {
    try {
        console.log("Received request body:", req.body); // Debugging output

        const eventId = req.params.id;
        const imagePath = req.body.imagePath;

        if (!imagePath) {
            return res.status(400).json({ error: "Image path is required." });
        }

        // Find event in DB
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ error: "Event not found." });
        }

        // Check if image exists in the array
        const imageIndex = event.images.indexOf(imagePath);
        if (imageIndex === -1) {
            return res.status(400).json({ error: "Image not found in event." });
        }

        // Delete file from uploads folder
        const fullPath = path.join(__dirname, '..', 'uploads', imagePath);

        fs.unlink(fullPath, async (err) => {
            if (err && err.code !== 'ENOENT') {
                console.error("Error deleting file:", err);
                return res.status(500).json({ error: "Error deleting the image file." });
            }

            // Remove image from DB
            event.images.splice(imageIndex, 1);
            await event.save();

            console.log("Image removed successfully.");
            res.redirect(`/event/${eventId}`);
        });

    } catch (error) {
        console.error("Error removing image:", error);
        res.status(500).json({ error: "Internal server error." });
    }
});




module.exports = router;
