// Per-application MongoDB provisioning. Reviewed, checked-in asset run
// unchanged by a one-shot job on the managed database's own image. Every value
// arrives through the environment or a mounted secret; nothing is interpolated
// into this file, and the driver — not string concatenation — carries the user
// name and password to the server.
//
// Idempotent: an existing user has its password and roles reset to what
// SwarmOps already sealed, so a repeated deployment or an interrupted earlier
// run both converge on the same state.
// cat() is mongosh's own file helper. Reading the mounted secrets through it
// avoids depending on require("fs"), which mongosh does not guarantee to a
// --file script.
const host = process.env.SWARMOPS_MONGO_HOST;
const port = process.env.SWARMOPS_MONGO_PORT;
const adminUser = process.env.SWARMOPS_MONGO_ADMIN_USER;
const appUser = process.env.SWARMOPS_APP_USER;
const appDatabase = process.env.SWARMOPS_APP_DB;
if (!host || !port || !adminUser || !appUser || !appDatabase) {
  throw new Error("managed MongoDB bootstrap parameters are incomplete");
}

const adminPassword = cat("/run/secrets/admin_password").trim();
const appPassword = cat("/run/secrets/app_password").trim();
const authority = `${encodeURIComponent(adminUser)}:${encodeURIComponent(adminPassword)}@${host}:${port}`;

// The Swarm task is gated on the database's healthcheck, but a stop-first
// update can still leave a moment where the port refuses. Waiting here is the
// difference between an application that starts and one that crash-loops.
let connection = null;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    connection = new Mongo(`mongodb://${authority}/admin?authSource=admin`);
    connection.getDB("admin").runCommand({ ping: 1 });
    break;
  } catch (error) {
    connection = null;
    sleep(2000);
  }
}
if (!connection) {
  throw new Error("managed MongoDB did not accept connections within two minutes");
}

// dbOwner on exactly one database: the application may read, write, and index
// its own data and nothing else on the cluster.
const target = connection.getDB(appDatabase);
const roles = [{ role: "dbOwner", db: appDatabase }];
if (target.getUser(appUser)) {
  target.updateUser(appUser, { pwd: appPassword, roles: roles });
} else {
  target.createUser({ user: appUser, pwd: appPassword, roles: roles });
}
print(`provisioned MongoDB user and database for ${appUser}`);
