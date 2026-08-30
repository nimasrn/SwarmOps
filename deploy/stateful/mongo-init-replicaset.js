// This immutable, non-secret initializer is executed by the dedicated
// mongo-init Swarm service. It reads the root account only from Swarm secrets
// at runtime, so credentials never enter the stack, service command, or logs.
const fs = require('fs');

const readSecret = (name) => fs.readFileSync(name, 'utf8').trim();
const admin = db.getSiblingDB('admin');
const username = readSecret('/run/secrets/mongo_root_username');
const password = readSecret('/run/secrets/mongo_root_password');

if (admin.auth(username, password) !== 1) {
  throw new Error('MongoDB root authentication failed');
}

const status = admin.runCommand({ replSetGetStatus: 1 });
if (status.ok === 1) {
  print('replica set is already initialized');
} else if (status.code === 94 || status.codeName === 'NotYetInitialized') {
  const result = rs.initiate({
    _id: 'rs0',
    members: [
      { _id: 0, host: 'mongo-1:27017', priority: 2 },
      { _id: 1, host: 'mongo-2:27017', priority: 1 },
      { _id: 2, host: 'mongo-3:27017', priority: 1 },
    ],
  });
  if (result.ok !== 1 && result.codeName !== 'AlreadyInitialized') {
    throw new Error(`replica set initialization failed: ${tojson(result)}`);
  }
  print('replica set initialization requested');
} else {
  throw new Error(`replica set status failed: ${tojson(status)}`);
}
