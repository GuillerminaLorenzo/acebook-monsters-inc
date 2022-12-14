const createError = require("http-errors");
const mongoose = require("mongoose");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const methodOverride = require("method-override");
const flash = require("connect-flash"); // ADDED
const crypto = require("crypto"); // ADDED
const multer = require("multer"); // ADDED
const GridFsStorage = require("multer-gridfs-storage").GridFsStorage; // ADDED
const Grid = require("gridfs-stream"); // ADDED
const bodyParser = require("body-parser"); // ADDED

const homeRouter = require("./routes/home");
const postsRouter = require("./routes/posts");
const sessionsRouter = require("./routes/sessions");
const usersRouter = require("./routes/users");
const imagesRouter = require("./routes/images");
// const { connect } = require("http2");

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(methodOverride("_method"));

app.use(
  session({
    key: "user_sid",
    secret: "super_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      expires: 600000,
    },
  })
);

// clear the cookies after user logs out
app.use((req, res, next) => {
  if (req.cookies.user_sid && !req.session.user) {
    res.clearCookie("user_sid");
  }
  next();
});

// middleware function to check for logged-in users
const sessionChecker = (req, res, next) => {
  if (!req.session.user && !req.cookies.user_sid) {
    res.redirect("/sessions/new");
  } else {
    next();
  }
};

//Middleware
app.use(bodyParser.json());

// Mongo URI test or development
const password = encodeURIComponent("//");

const mongoDbUrl = process.env.MONGODB_URL || `mongodb+srv://makers:${password}@learning.vltc2du.mongodb.net/?retryWrites=true&w=majority`;
const conn = mongoose.createConnection(mongoDbUrl);

// Init gfs for streaming images
let gfs;

// File transfer system
conn.once("open", () => {
  // init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection("uploads");
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoDbUrl,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString("hex") + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: "uploads",
        };
        resolve(fileInfo);
      });
    });
  },
});

// attach files to req.files
const upload = multer({ storage });

// route setup
app.use("/", homeRouter);
app.use("/images", imagesRouter);
app.use("/posts", sessionChecker, upload.single("image"), postsRouter);
app.use("/sessions", sessionsRouter);
app.use("/users", upload.single("image"), usersRouter);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

app.use(flash());

app.get("/sessions/new", (req, res) => {
  req.flash("message", "Invalid Details");
  res.redirect("/sessions/new");
});

module.exports = app;
