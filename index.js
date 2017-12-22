const express = require('express');
const bodyParser = require('body-parser');
const graphqlHTTP = require('express-graphql');
const root = require('./src/resolvers/RootResolver');
const schema = require('./src/schema/schema');
const GitHubStrategy = require('passport-github2').Strategy;
const session = require('express-session');
const passport = require('passport');
const partials = require('express-partials');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
/* eslint-disable no-unused-vars */
const envIsDev = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 8000;
const GITHUB_CLIENT_ID = envIsDev
  ? process.env.LOCAL_GITHUB_CLIENT_ID
  : process.env.PRODUCTION_GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = envIsDev
  ? process.env.LOCAL_GITHUB_CLIENT_SECRET
  : process.env.PRODUCTION_GITHUB_CLIENT_SECRET;
//
const API_BASE_URL = envIsDev
  ? process.env.LOCAL_API_BASE_URL
  : process.env.PRODUCTION_API_BASE_URL;
const REDIRECT_URL = envIsDev
  ? process.env.LOCAL_REDIRECT_URL
  : process.env.PRODUCTION_REDIRECT_URL;
const DOMAIN_FOR_COOKIES = envIsDev ? 'localhost' : process.env.DOMAIN_FOR_COOKIES;

app.use(morgan('combined'));
app.use('/', partials());
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SECRET,
    keys: [process.env.SESSION_KEY1, process.env.SESSION_KEY2],
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    rootValue: root,
  }),
);

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new GitHubStrategy(
    {
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: `${API_BASE_URL}/auth/github/callback`,
    },
    (accessToken, refreshToken, profile, done) => {
      process.env.TKN = accessToken;
      process.nextTick(() => done(null, profile));
    },
  ),
);

app.get(
  '/auth/github',
  passport.authenticate('github', { scope: ['user:email', 'read:org', 'notifications', 'repo'] }),
);

app.get(
  '/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  /* eslint-disable no-underscore-dangle */
  (req, res) => {
    res.cookie('githubUserName', req.session.passport.user._json.login, {
      httpOnly: false,
      domain: DOMAIN_FOR_COOKIES,
    });
    res.cookie('githubAccessToken', process.env.TKN, {
      httpOnly: false,
      domain: DOMAIN_FOR_COOKIES,
    });
    res.redirect(REDIRECT_URL);
  },
);

// NOTE: Logout is handled on the client side, preventing page redirect on logout, for better UX
// app.get('/logout', (req, res) => {
//   res.clearCookie('githubAccessToken', { domain: DOMAIN_FOR_COOKIES });
//   res.clearCookie('githubUserName', { domain: DOMAIN_FOR_COOKIES });
//   res.redirect(REDIRECT_URL);
// });

app.use('/', (req, res) => {
  res.status(200).send('Github API appears to be working fine.');
});

app.use((req, res) => {
  res.sendStatus(404);
});
if (!module.parent) {
  app.listen(PORT, () => {
    /* eslint-disable no-console */
    console.log(`Express server listening on port ${PORT}`);
  });
}
