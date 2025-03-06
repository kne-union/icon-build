#!/usr/bin/env node

const iconBuild = require('./index');

iconBuild().catch(err => {
  throw err;
});
