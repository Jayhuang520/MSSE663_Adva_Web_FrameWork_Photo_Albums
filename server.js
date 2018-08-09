
var express = require('express'),
    bodyParser = require('body-parser'),
    morgan = require('morgan'),
    passport = require("passport"),
    session = require('express-session'),
    cookieParser = require('cookie-parser'),
    LocalStrategy = require('passport-local').Strategy,
    flash = require('express-flash'),
    multer = require('multer');

var db = require('./data/db.js'),
    album_hdlr = require('./handlers/albums.js'),
    page_hdlr = require('./handlers/pages.js'),
    rename_hdler = require('./handlers/rename'),
    helpers = require('./handlers/helpers.js');

var app = express();

var session_configuration = {
    secret: 'Secret Photo Albums',
    resave: false,
    saveUninitialized: true,
    cookie: {secure: true}
};

app.use(flash());
app.use(session(session_configuration));
app.use(cookieParser('Secret Photo Albums'));
app.use(express.static(__dirname + "/../static"));
app.use(morgan('dev'));
app.use(passport.initialize());
app.use(passport.session());
// Parse application/x-www-form-urlencoded & JSON
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var upload = multer({ dest: "uploads/" });

app.get('/v1/albums.json', album_hdlr.list_all);
app.put('/v1/albums.json', album_hdlr.create_album);
app.get('/v1/albums/:album_name.json', album_hdlr.album_by_name);
app.get('/v1/albums/:album_name/photos.json', album_hdlr.photos_for_album);
app.put('/v1/albums/:album_name/photos.json',
    upload.single("photo_file"),
    album_hdlr.add_photo_to_album);

app.get('/pages/:page_name', page_hdlr.generate);
app.get('/pages/:page_name/:sub_page', page_hdlr.generate);

app.get('/', function (req, res) {
    res.redirect("/pages/login");
    res.end();
});

app.get('*', four_oh_four);

app.post('/pages/login',
    passport.authenticate('local', {
        successRedirect: '/pages/home',
        failureRedirect: '/pages/login',
        successFlash: {message: "welcome back"},
        failureFlash: true
    })
);

// app.post('/pages/home', function (req, res) {
//     rename_hdler.renameAlbum(req, res);
// });

function four_oh_four(req, res) {
    res.writeHead(404, { "Content-Type" : "application/json" });
    res.end(JSON.stringify(helpers.invalid_resource()) + "\n");
}

var users = {
    "id123456": {id: 123456, username: "jay", password: "huang"},
    "id1": {id: 1, username: "root", password: "admin"}
};

passport.use(new LocalStrategy(
    function (username, password, done) {
        setTimeout(function () {
            for (userId in users) {
                var user = users[userId];
                console.log(user);
                if (user.username.toLowerCase() == username.toLowerCase()) {
                    if (user.password == password) {
                        return done(null, user);
                    }
                }
            }
            return done(null, false, {message: 'Incorrect credentials.'});
        }, 1000);
    }
));

passport.serializeUser(function (user, done) {
    if (users["id" + user.id]) {
        done(null, "id" + user.id);
    } else {
        done(new Error("WAT"));
    }
});

passport.deserializeUser(function (userId, done) {
    if (users[userId]) {
        done(null, users[userId]);
    } else {
        done(new Error("CANTFINDUSER"));
    }
});

/**
 * Initialise the server and start listening when we're ready!
 */
db.init( function (err, results) {
    if (err) {
        console.error("** FATAL ERROR ON STARTUP: ");
        console.error(err);
        process.exit(-1);
    }

    console.log("** Database initialised, listening on port 8080");
    app.listen(8080);
});

