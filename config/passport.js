// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    passReqToCallback: true,
    proxy: true, // ✅ Zaroori: Agar aap Vercel ya kisi proxy ke piche hain toh ye help karega
  },
  async (req, accessToken, refreshToken, profile, done) => {
    try {
      const loginOrSignup = req.query.state; 

      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        const existingEmailUser = await User.findOne({ email: profile.emails[0].value });

        if (existingEmailUser) {
          existingEmailUser.googleId = profile.id;
          existingEmailUser.isVerified = true;
          user = await existingEmailUser.save();
        } else {
          // Localhost debugging ke liye message check
          if (loginOrSignup === 'login') {
            return done(null, false, { message: 'Account not found. Please sign up.' });
          }

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
  }
));

// DeserializeUser mein async/await use karna behtar hai (Newer Node versions)
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});