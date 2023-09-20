require('dotenv').config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");

// passport
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

// OAuth with google
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
    extended: true
}));

// security 5
app.use(session({
    secret: 'Our little secret.',
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null,user.id);
  });
   
passport.deserializeUser(function(id, done) {
    User.findById(id, (err,user)=>{
        done(err,user); // ??
    })
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets", 
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo" 
},
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile.id, profile.name);
    User.findOrCreate({ googleId: profile.id }, function ( user, err) {
        return cb( user, err);
    });
  }
));

app.get("/",(req, res)=>{
    res.render("home");
})

app.get("/auth/google",
    passport.authenticate("google",{ scope: ["profile"] })
);

// so that after logging in to google it jumps back to /secrets
app.get('/auth/google/secrets', 
  passport.authenticate('google', { 
    successRedirect: '/secrets',
    failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });

app.get("/login",(req, res)=>{
    if(req.isAuthenticated()){
        res.redirect("/secrets");
    } else {
        res.render("login");
    }
})

app.get("/register",(req, res)=>{
    res.render("register");
})

app.get("/secrets", (req, res)=>{
    User.find({"secret": {$ne: null}}).then((foundUsers, err)=>{
        if (err){console.log(err);}
        else
         {if (foundUsers){
            res.render("secrets",{usersWithSecrets: foundUsers});
        }}
    })
})

app.get("/submit", (req, res)=>{
    if (req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})

app.get("/logout", (req, res)=>{
    req.logout((err)=>{
        if (err){console.log(err);}
        else {
            res.redirect("/");
            console.log("User Logged out and this session ended: " + req.headers.cookie);
        }
    });
})

app.post("/submit", (req, res)=>{
    const submittedSecret = req.body.secret;
    User.findById(req.user.id).then((foundUser,err)=>{
        if (err){console.log(err);}
        else {if (foundUser){
            foundUser.secret = submittedSecret;
            foundUser.save().then(()=>{res.redirect("/secrets");})
        }}
    })
    // not adding to but replacing the last secret
})

app.post("/register", (req, res)=>{
    User.register({username: req.body.username}, req.body.password).then((user, err)=>{
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res,()=>{
                console.log("going to secrets");
                res.redirect("/secrets");
            });
        }
    })
})

app.post("/login", (req, res)=>{
    const user = new User({
        username: req.body.username,
        password: req.body.password
      });
    
      req.login(user, function(err){
        if (err) {
          console.log(err);
        } else {
          passport.authenticate("local")(req, res, function(){
            console.log("redirecting to secrets");
            res.redirect("/secrets");
          });
        }
      });
    
})

app.listen(3000,()=>{
    console.log("Server started on port 3000.");
})