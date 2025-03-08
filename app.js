require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const User = require('./models/User');  // ✅ Fix: Import User model
const Event = require('./models/Event');
const Donation = require('./models/Donation');
const Review = require('./models/Review');
const Transaction = require('./models/Transaction');

const app = express();
const flash = require('connect-flash'); // Ensure this is required

// Import Routes
const eventRoutes = require('./routes/events');

// Use Routes
app.use(eventRoutes);

const bodyParser = require('body-parser');

app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.json()); // For parsing JSON data
app.use(bodyParser.json()); // Ensure JSON body parsing

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('view engine', 'ejs');
app.use(express.static('public')); // For CSS, images, etc.

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: 'sessions'
    }),
    cookie: {
      maxAge: 1 * 24 * 60 * 60 * 1000 //  1 day
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

app.use(flash()); // Initialize express-flash

app.use((req, res, next) => {
    res.locals.messages = req.flash(); // ✅ Make flash messages available in all EJS templates
    next();
});

// Passport Google Auth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔹 Google Profile:', profile);  // Debugging Line
      
      let user = await User.findOne({ googleId: profile.id });
  
      if (!user) {
        user = new User({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value,  // Safe access
          profilePic: profile.photos?.[0]?.value
        });
  
        await user.save();
        console.log('✅ New User Saved:', user);  // Debugging Line
      } else {
        console.log('🟢 User Exists:', user);  // Debugging Line
      }
      
      done(null, user);
    } catch (err) {
      console.error('❌ Error Saving User:', err);
      done(err, null);
    }
  }));
  

// ✅ Fix: Serialize only user ID
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect('/');
}

// Google Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/dashboard');
  }
);

// ✅ Fix: Logout properly
app.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});



app.post('/create-event', ensureAuthenticated, async (req, res) => {
    try {

        const newEvent = new Event({
            title,
            description,
            date,
            location,
            createdBy: req.user._id
        });

        await newEvent.save();
        res.redirect('/dashboard'); // Redirect to dashboard after creating event
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating event');
    }
});


app.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {

      const events = await Event.find({ createdBy: req.user._id });

      res.render('dashboard', { title: 'Dashboard', user: req.user, events });
  } catch (err) {
      console.error(err);
      res.status(500).send('Error loading events');
  }
});




app.get('/events', async (req, res) => {
  try {
      const { search = '', location = '' } = req.query; // Default to empty string if not provided
      let query = {};

      if (search) {
          query.title = { $regex: search, $options: 'i' }; // Case-insensitive title search
      }
      if (location) {
          query.location = { $regex: location, $options: 'i' }; // Case-insensitive location search
      }

      const events = await Event.find(query).populate('createdBy', 'name');

      res.render('events', { title: 'Available Events', events, search, location, user: req.user });
  } catch (err) {
      console.error('Error fetching events:', err);
      res.status(500).send('Error retrieving events');
  }
});


app.post('/events/:eventId/volunteer', ensureAuthenticated, async (req, res) => {
  try {
      const event = await Event.findById(req.params.eventId);
      if (!event) {
          return res.status(404).send('Event not found');
      }

      // Check if user is already a volunteer
      if (event.volunteers.includes(req.user._id)) {
        req.flash('error', 'You have already signed up for this event');
        return res.redirect('/events');
        
      }

      // Add user to volunteers list
      event.volunteers.push(req.user._id);
      req.flash('success','You have signed up successfully');
      await event.save();

      res.redirect('/events');
  } catch (err) {
      console.error(err);
      res.status(500).send('Error signing up for event');
  }
});


app.get("/event/:id", async (req, res) => {
  try {
      const event = await Event.findById(req.params.id).populate("volunteers", "name email");
      if (!event) return res.status(404).send("Event not found");

      res.render("eventDetails", { event });
  } catch (error) {
      console.error(error);
      res.redirect("/my-events");
  }
});


app.post('/events/update/:id', async (req, res) => {
  const { title, date, location, description } = req.body;
  try {
      await Event.findByIdAndUpdate(req.params.id, { title, date, location, description });
      res.redirect(`/event/${req.params.id}`);
  } catch (error) {
      res.status(500).send("Error updating event.");
  }
});

app.post("/events/remove-volunteer/:eventId/:volunteerId", async (req, res) => {
  try {
    const { eventId, volunteerId } = req.params;

    await Event.findByIdAndUpdate(eventId, {
      $pull: { volunteers: new mongoose.Types.ObjectId(volunteerId) } // Ensure correct ObjectId format
    });
    req.flash('success','Volunteer removed successfully!');

    res.redirect(`/event/${eventId}`);
  } catch (error) {
    console.error("Error removing volunteer:", error);
    req.flash("error_msg", "Error removing volunteer.");
    res.redirect(`/event/${eventId}`);
  }
});





// Home Route
app.get('/', (req, res) => {
    res.render('index', { title: 'Home', user: req.user });
});

// Start Server
app.listen(3000, () => console.log('🚀 Server running on port 3000'));
