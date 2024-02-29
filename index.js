import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import env from "dotenv";

const app = express();
const port = 3000;
env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.connect();

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

//Retrive all posts from the Database
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM notes ORDER BY id ASC");
    const notes = result.rows;
    res.render("index.ejs", {
      notes: notes,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

//a-z filter
app.get("/a-z", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM notes ORDER BY title ASC");
    const notes = result.rows;
    res.render("index.ejs", {
      notes: notes,
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

//rating filter
app.get("/rating", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM notes ORDER BY rating DESC");
    const notes = result.rows;
    res.render("index.ejs", {
      notes: notes,
    });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

//Search for post
app.post("/search", async (req, res) => {
  try {
    const searchTerm = req.body.dramaName;
    const result = await db.query("SELECT * FROM notes WHERE title ILIKE $1", [
      `%${searchTerm}%`,
    ]);
    const note = result.rows[0];
    console.log("Search results:", note); // Add this line for debugging
    res.render("search_results.ejs", { note });
  } catch (error) {
    console.error("Error searching for posts:", error);
    res.status(500).send("Error searching for posts");
  }
});

//show results for clicked post
app.get("/note/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM notes WHERE id=$1", [
      req.params.id,
    ]);
    const note = result.rows[0];
    res.render("search_results.ejs", { note });
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

// Edit form open from database
app.get("/edit/:id", async (req, res) => {
  const result = await db.query("SELECT * FROM notes WHERE id = $1", [
    req.params.id,
  ]);
  const note = result.rows[0];
  res.render("modify.ejs", {
    note: note,
    heading: "Edit Form",
    submit: "Update",
  });
});

//Create new note form open
app.get("/new", (req, res) => {
  res.render("modify.ejs", {
    heading: "New Form",
    submit: "Create",
  });
});

//insert new note in database
app.post("/notes/new", async (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const rating = req.body.rating;
  await db.query(
    "INSERT INTO notes(title, content, rating) VALUES ($1, $2, $3)",
    [title, content, rating]
  );
  res.redirect("/");
});

//update edited note in database
app.post("/notes/update/:id", async (req, res) => {
  const title = req.body.title;
  const content = req.body.content;
  const rating = req.body.rating;
  await db.query(
    "UPDATE notes SET title = ($1), content = ($2), rating=($3) WHERE id = $4",
    [title, content, rating, req.params.id]
  );
  res.redirect("/");
});

//delete the note from database
app.get("/delete/:id", async (req, res) => {
  await db.query("DELETE FROM notes WHERE id = $1", [req.params.id]);
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
