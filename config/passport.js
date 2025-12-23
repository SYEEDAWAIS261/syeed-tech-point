// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // Your existing user model
require('dotenv').config(); // ✅ Required to load .env variables

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
  passReqToCallback: true, // required to access `req.query.state`
},
async (req, accessToken, refreshToken, profile, done) => {
  try {
    const loginOrSignup = req.query.state; // 'login' or 'signup'

    let user = await User.findOne({ googleId: profile.id });

    if (!user) {
      // Try to find user by email (existing manual signup)
      const existingEmailUser = await User.findOne({ email: profile.emails[0].value });

      if (existingEmailUser) {
        // Attach Google ID to existing manual account
        existingEmailUser.googleId = profile.id;
        existingEmailUser.isVerified = true;
        user = await existingEmailUser.save();
      } else {
        if (loginOrSignup === 'login') {
          // User is trying to login, but no account exists
          return done(null, false, { message: 'No account associated with this Google account. Please sign up first.' });
        }

        // Signup mode: create a new user
        user = new User({
          username: profile.displayName,
          email: profile.emails[0].value,
          googleId: profile.id,
          isVerified: true,
        });
        await user.save();
      }
    }

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));


passport.serializeUser((user, done) => {
  done(null, user._id);
});
passport.deserializeUser((id, done) => {
  User.findById(id).then(user => done(null, user));
});
