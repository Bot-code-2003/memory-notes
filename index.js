import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import GoogleStrategy from "passport-google-oauth2";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: {
    rejectUnauthorized: false, // For development or if the server uses a self-signed certificate
  },
});
db.connect();

app.set("view engine", "ejs");

//Get the register page as default
app.get("/", (req, res) => {
  console.log("Registration on going");
  res.render("register.ejs");
});

//Get the login page
app.get("/login", (req, res) => {
  console.log("In login page");
  res.render("login.ejs");
});

//Retrive all posts from the Database of logged in user only.
app.get("/user_notes", async (req, res) => {
  if (req.isAuthenticated()) {
    console.log("isAuthenticated = True");
    console.log(req.user);
    try {
      const result = await db.query(
        "SELECT * FROM user_data WHERE user_id = $1",
        [req.user.id]
      );
      const result2 = await db.query("SELECT * FROM users WHERE id = $1", [
        req.user.id,
      ]);
      const notes = result.rows;
      const notes2 = result2.rows;
      console.log(notes);
      res.render("index.ejs", {
        notes: notes,
        notes2: notes2,
      });
    } catch (error) {
      console.error("Error fetching user notes:", error);
      res.render("index.ejs", {
        notes: [],
        errorMessage: "Error fetching user notes. Please try again later.",
      });
    }
  } else {
    console.log("isAuthenticated: False");
    res.redirect("/login");
  }
});

//get modify page to add new notes
app.get("/new", (req, res) => {
  res.render("modify.ejs", {
    heading: "New Form",
    submit: "Create",
  });
});

//logout and go to home page
app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

////////ABOUT passport.authenticate("google"....) IN /auth/google ROUTE//////////
//passport.authenticate triggers google strategy (First parameter)
//Scope: By defining these we ask user for permission for scope variables and retrive the info
app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/notes",
  passport.authenticate("google", {
    successRedirect: "/user_notes",
    failureRedirect: "/login",
  })
);

//Insert the registered mail, password into the users table database
app.post("/register", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const username = req.body.username;
  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      console.log("User already present in database");
      res.redirect("/login");
    } else {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          const result = await db.query(
            "INSERT INTO users (email, password, username) VALUES ($1, $2, $3) RETURNING *",
            [email, hash, username]
          );
          res.redirect("/login");
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

//after user clicks on login after entering all his credentials
app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/user_notes",
    failureRedirect: "/login",
  })
);

//insert new note in database
app.post("/notes/new", async (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const rating = req.body.rating;
  const id = req.user.id;
  await db.query(
    "INSERT INTO user_data(title, content, rating, user_id) VALUES ($1, $2, $3, $4)",
    [title, content, rating, id]
  );
  res.redirect("/user_notes");
});

// Local strategy
passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [
        username,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false, { message: "Invalid password" });
            }
          }
        });
      } else {
        console.log("User not found branch");
        return cb(null, false, { message: "User not found" });
      }
    } catch (err) {
      console.error(err);
      return cb(err);
    }
  })
);

//This is a google strategy
//it starts when /google/auth route hits and continus and ends when /google/auth/secrets route also gets executed
passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/notes",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password, username) VALUES ($1, $2, $3)",
            [profile.email, "google", profile.displayName]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
